import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { define } from 'gunshi';
import { buildBenchScript } from '../bench/build-bench-script.ts';
import { parseBenchExitCode } from '../bench/parse-bench-exit-code.ts';
import { parseBenchRows } from '../bench/parse-bench-rows.ts';
import { buildModelPath } from '../catalog/build-model-path.ts';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { formatBenchTable } from '../format/format-bench-table.ts';
import { buildLlamaSwapURL } from '../serving/build-llama-swap-url.ts';
import { probeLlamaSwap } from '../serving/probe-llama-swap.ts';
import { startLlamaSwap } from '../serving/start-llama-swap.ts';
import { stopLlamaSwap } from '../serving/stop-llama-swap.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { readWindowsHostIP } from '../windows/read-windows-host-ip.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

const defaultDepths = '0,8192,32768';
const logTailLines = 30;

export function createBenchCommand(dependencies: CLIDependencies) {
  return define({
    name: 'bench',
    description: 'Run llama-bench on a model and append the rows to results/',
    args: {
      id: { type: 'positional', description: 'The model id from models.yaml' },
      backend: {
        type: 'string',
        description: "vulkan or rocm; the model's own backend by default",
      },
      depths: {
        type: 'string',
        description: `Context depths, comma separated; ${defaultDepths} by default`,
      },
      reps: { type: 'number', description: 'Repetitions per test, 3 by default' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const machine = catalog.machine;
      const model = getModel(catalog, ctx.values.id);
      const backend = parseBackend(ctx.values.backend) ?? model.backend;
      const depths = parseDepths(ctx.values.depths ?? defaultDepths);
      const repetitions = ctx.values.reps ?? 3;

      if (!Number.isInteger(repetitions) || repetitions < 1) {
        throw new CLIError('--reps takes a whole number, one or more');
      }

      const build = await readBuild(dependencies, joinWindowsPath(machine.binDir, backend));
      const hostIP = await readWindowsHostIP(dependencies.readDefaultRoute);

      const url = buildLlamaSwapURL(machine, hostIP);

      const wasRunning = await probeLlamaSwap(url);

      // llama-swap holds the GPU memory the benchmark needs, so it stops until the run ends.
      if (wasRunning) {
        dependencies.print('Stopping llama-swap for the benchmark');

        await stopLlamaSwap(dependencies.runPowerShell);
      }

      try {
        const result = await dependencies.runPowerShell(
          buildBenchScript({
            benchPath: joinWindowsPath(machine.binDir, backend, 'llama-bench.exe'),
            modelPath: buildModelPath(machine, model),
            device: machine.devices[backend],
            nCpuMoe: model.nCpuMoe,
            depths,
            repetitions,
            pathPrefix: backend === 'rocm' ? machine.rocmLibDir : undefined,
          }),
        );

        const rows = parseBenchRows(result.stdout);
        const tail = result.stdout.trim().split('\n').slice(-logTailLines).join('\n');

        // A depth that fails after earlier ones passed still leaves rows, and they are a partial run.
        if (result.exitCode !== 0 || parseBenchExitCode(result.stdout) !== 0) {
          throw new CLIError(`llama-bench failed; no rows were saved; its output ends:\n${tail}`);
        }

        if (rows.length === 0) {
          throw new CLIError(`llama-bench returned no rows; its output ends:\n${tail}`);
        }

        const resultsDir = join(dependencies.repoRoot, 'results');
        const resultsPath = join(resultsDir, `${ctx.values.id}-${backend}.jsonl`);

        await mkdir(resultsDir, { recursive: true });

        const tagged = rows.map((row) => ({
          ...row,
          llamacpp_build: build,
          backend,
          model_id: ctx.values.id,
        }));

        const text = tagged.map((row) => `${JSON.stringify(row)}\n`).join('');

        await appendFile(resultsPath, text);

        dependencies.print(formatBenchTable(rows));
        dependencies.print(`Appended ${rows.length} rows to ${resultsPath}`);
      } finally {
        if (wasRunning) {
          await startLlamaSwap(catalog, dependencies);

          dependencies.print(`llama-swap is running again at ${url}`);
        }
      }
    },
  });
}

function parseBackend(value: string | undefined): 'vulkan' | 'rocm' | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'vulkan' && value !== 'rocm') {
    throw new CLIError('--backend takes vulkan or rocm');
  }

  return value;
}

function parseDepths(value: string): number[] {
  const depths = value.split(',').map((part) => Number(part.trim()));

  if (depths.some((depth) => !Number.isInteger(depth) || depth < 0)) {
    throw new CLIError('--depths takes whole numbers of tokens, such as 0,8192,32768');
  }

  return depths;
}

// The BUILD file that `llm install` writes names the llama.cpp build the rows come from.
async function readBuild(dependencies: CLIDependencies, folder: string): Promise<string> {
  try {
    const text = await readFile(
      toWSLPath(joinWindowsPath(folder, 'BUILD'), dependencies.mountRoot),
      'utf8',
    );

    return text.trim();
  } catch {
    throw new CLIError(`no BUILD file in ${folder}; run llm install first`);
  }
}
