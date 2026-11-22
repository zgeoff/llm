import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { define } from 'gunshi';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { formatTable } from '../format/format-table.ts';
import { readReachableLlamaSwapURL } from '../serving/read-reachable-llama-swap-url.ts';
import { unloadModels } from '../serving/unload-models.ts';
import { measureTTFT } from '../ttft/measure-ttft.ts';

const prompt =
  'Explain in about a hundred words why the sky is blue, in plain language, with no list.';

const maxTokens = 128;

export function createTTFTCommand(dependencies: CLIDependencies) {
  return define({
    name: 'ttft',
    description:
      'Time the first streamed token of a model through llama-swap, cold then warm, and the output rate',
    args: {
      id: { type: 'positional', description: 'The model id from models.yaml' },
      reps: { type: 'number', description: 'Warm repetitions, 3 by default' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const model = getModel(catalog, ctx.values.id);
      const repetitions = ctx.values.reps ?? 3;

      if (!Number.isInteger(repetitions) || repetitions < 1) {
        throw new CLIError('--reps takes a whole number, one or more');
      }

      const url = await readReachableLlamaSwapURL(catalog, dependencies);

      // The cold run loads the model from disk, so nothing may hold it first.
      await unloadModels(url, ctx.values.id);

      const run = new Date(dependencies.clock.now()).toISOString();

      const phases: readonly ('cold' | 'warm')[] = [
        'cold',
        ...Array.from({ length: repetitions }, () => 'warm' as const),
      ];

      const rows = [];

      for (const [index, phase] of phases.entries()) {
        const measurement = await measureTTFT({
          baseURL: url,
          modelID: ctx.values.id,
          prompt,
          maxTokens,
          clock: dependencies.clock,
        });

        rows.push({
          run,
          model_id: ctx.values.id,
          backend: model.backend,
          phase,
          rep: index,
          ttft_ms: Math.round(measurement.ttftMs),
          completion_tokens: measurement.completionTokens,
          tok_s: measurement.tokensPerSecond,
        });
      }

      const resultsDir = join(dependencies.repoRoot, 'results');
      const resultsPath = join(resultsDir, `${ctx.values.id}-ttft.jsonl`);

      await mkdir(resultsDir, { recursive: true });
      await appendFile(resultsPath, rows.map((row) => `${JSON.stringify(row)}\n`).join(''));

      dependencies.print(
        formatTable(
          ['phase', 'ttft ms', 'tokens', 'tok/s'],
          rows.map((row) => [
            row.phase,
            String(row.ttft_ms),
            String(row.completion_tokens),
            row.tok_s === null ? '-' : row.tok_s.toFixed(1),
          ]),
        ),
      );

      dependencies.print(`Appended ${rows.length} rows to ${resultsPath}`);
    },
  });
}
