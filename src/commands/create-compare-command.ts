import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { define } from 'gunshi';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { buildCompareRows } from '../compare/build-compare-rows.ts';
import { parseResultRows } from '../compare/parse-result-rows.ts';
import { formatCompareTable } from '../format/format-compare-table.ts';

export function createCompareCommand(dependencies: CLIDependencies) {
  return define({
    name: 'compare',
    description: 'Tabulate the latest bench and ttft rows in results/ per model and backend',
    args: {
      ids: {
        type: 'positional',
        required: false,
        description: 'Model ids to keep; all by default',
      },
    },
    run: async (ctx) => {
      const resultsDir = join(dependencies.repoRoot, 'results');

      const names = await readdir(resultsDir).catch(() => []);

      const files = names.filter((name) => name.endsWith('.jsonl')).toSorted();

      const texts = await Promise.all(files.map((name) => Bun.file(join(resultsDir, name)).text()));

      const results = texts.flatMap((text) => parseResultRows(text));
      const rows = buildCompareRows(results, ctx.positionals.slice(1));

      const output =
        rows.length === 0 ? `no bench or ttft rows in ${resultsDir}` : formatCompareTable(rows);

      dependencies.print(output);
    },
  });
}
