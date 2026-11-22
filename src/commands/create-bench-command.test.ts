import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { buildModel } from '../testing/build-model.ts';
import { network } from '../testing/network.ts';

async function setupTest(benchStdout?: string) {
  const root = await mkdtemp(join(tmpdir(), 'llm-bench-'));

  const printed: string[] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, 'mnt', 'c', 'llm', 'bin', 'rocm'), { recursive: true });
  await mkdir(join(root, 'mnt', 'c', 'llm', 'bin', 'vulkan'), { recursive: true });

  await Bun.write(join(root, 'mnt', 'c', 'llm', 'bin', 'rocm', 'BUILD'), 'b9000\n');

  const rocmModel = buildModel({ backend: 'rocm', nCpuMoe: 20 });
  const catalog = buildCatalog({ models: { 'rocm-model': rocmModel } });

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(catalog));

  const baseURL = 'http://172.28.80.1:8181';

  const defaultOutput = [
    'load_backend: loaded ROCm backend',
    '{"n_prompt":512,"n_gen":0,"n_depth":0,"avg_ts":1200.5}',
    '{"n_prompt":0,"n_gen":128,"n_depth":0,"avg_ts":60.25}',
    'exit=0',
  ].join('\n');

  const powerShell = buildFakePowerShell([
    { whenScriptIncludes: 'llama-bench', result: { stdout: benchStdout ?? defaultOutput } },
  ]);

  return {
    baseURL,
    root,
    printed,
    powerShell,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          mountRoot: join(root, 'mnt'),
          repoRoot: join(root, 'repo'),
          print: (text) => {
            printed.push(text);
          },
          runPowerShell: powerShell.run,
        }),
      ),
  };
}

test('it benchmarks the model and appends tagged rows to results', async () => {
  const ctx = await setupTest();

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  const result = await ctx.run(['bench', 'rocm-model', '--depths', '0', '--reps', '2']);
  const written = await Bun.file(join(ctx.root, 'repo', 'results', 'rocm-model-rocm.jsonl')).text();

  const lines = written
    .trim()
    .split('\n')
    .map((line): unknown => JSON.parse(line));

  expect(result.errorMessage).toBeNull();
  expect(ctx.powerShell.scripts).toHaveLength(1);
  expect(ctx.powerShell.scripts[0]).toContain("-dev 'ROCm1'");
  expect(ctx.powerShell.scripts[0]).toContain('--n-cpu-moe 20');
  expect(ctx.powerShell.scripts[0]).toContain('-d 0 -r 2');
  expect(ctx.powerShell.scripts[0]).toContain('$env:PATH');

  expect(lines).toStrictEqual([
    {
      n_prompt: 512,
      n_gen: 0,
      n_depth: 0,
      avg_ts: 1200.5,
      llamacpp_build: 'b9000',
      backend: 'rocm',
      model_id: 'rocm-model',
    },
    {
      n_prompt: 0,
      n_gen: 128,
      n_depth: 0,
      avg_ts: 60.25,
      llamacpp_build: 'b9000',
      backend: 'rocm',
      model_id: 'rocm-model',
    },
  ]);

  expect(ctx.printed[0]).toBe(
    ['depth  prompt tok/s  generation tok/s', '0      1200.5        60.3'].join('\n'),
  );
});

test('it stops llama-swap for the run and starts it again afterwards', async () => {
  const ctx = await setupTest();

  // llama-swap answers before the benchmark, is down while it runs, and answers once restarted.
  const answers = [true, false, true];

  network.use(
    http.get(`${ctx.baseURL}/health`, () =>
      answers.shift() === true ? new HttpResponse('OK') : HttpResponse.error(),
    ),
  );

  await ctx.run(['bench', 'rocm-model']);

  expect(ctx.powerShell.scripts).toHaveLength(3);
  expect(ctx.powerShell.scripts[0]).toContain('Stop-Process -Force');
  expect(ctx.powerShell.scripts[1]).toContain('llama-bench');
  expect(ctx.powerShell.scripts[2]).toContain('Win32_Process');
});

test('it reports the end of the output when llama-bench returns no rows', async () => {
  const ctx = await setupTest('warning: nothing to run\nexit=0');

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  const result = await ctx.run(['bench', 'rocm-model']);

  expect(result.errorMessage).toBe(
    'llama-bench returned no rows; its output ends:\nwarning: nothing to run\nexit=0',
  );
});

test('it saves no rows when a later depth fails after an earlier one passed', async () => {
  const ctx = await setupTest(
    [
      '{"n_prompt":512,"n_gen":0,"n_depth":0,"avg_ts":1200.5}',
      'error: out of memory',
      'exit=1',
    ].join('\n'),
  );

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  const result = await ctx.run(['bench', 'rocm-model']);

  expect(result.errorMessage).toBe(
    'llama-bench failed; no rows were saved; its output ends:\n{"n_prompt":512,"n_gen":0,"n_depth":0,"avg_ts":1200.5}\nerror: out of memory\nexit=1',
  );

  const resultsExist = await Bun.file(
    join(ctx.root, 'repo', 'results', 'rocm-model-rocm.jsonl'),
  ).exists();

  expect(resultsExist).toBe(false);
});

test('it rejects a backend that is not vulkan or rocm', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['bench', 'rocm-model', '--backend', 'cuda']);

  expect(result.errorMessage).toBe('--backend takes vulkan or rocm');
});

test('it asks for llm install when the backend has no BUILD file', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['bench', 'rocm-model', '--backend', 'vulkan']);

  expect(result.errorMessage).toContain('run llm install first');
});
