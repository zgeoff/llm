import type { BenchRow } from '../bench/parse-bench-rows.ts';
import { formatTable } from './format-table.ts';

// One row per context depth, with the prompt and generation speeds side by side.
export function formatBenchTable(rows: readonly BenchRow[]): string {
  const depths = [...new Set(rows.map((row) => row.n_depth))].toSorted(
    (left, right) => left - right,
  );

  const speed = (depth: number, kind: 'n_prompt' | 'n_gen'): string => {
    const row = rows.findLast((candidate) => candidate.n_depth === depth && candidate[kind] > 0);

    return row === undefined ? '-' : row.avg_ts.toFixed(1);
  };

  return formatTable(
    ['depth', 'prompt tok/s', 'generation tok/s'],
    depths.map((depth) => [String(depth), speed(depth, 'n_prompt'), speed(depth, 'n_gen')]),
  );
}
