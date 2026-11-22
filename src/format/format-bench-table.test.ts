import { expect, test } from 'bun:test';
import { formatBenchTable } from './format-bench-table.ts';

test('it puts the prompt and generation speed of each depth on one row', () => {
  const table = formatBenchTable([
    { n_prompt: 512, n_gen: 0, n_depth: 8192, avg_ts: 900.25 },
    { n_prompt: 0, n_gen: 128, n_depth: 8192, avg_ts: 70 },
    { n_prompt: 512, n_gen: 0, n_depth: 0, avg_ts: 1500 },
  ]);

  expect(table).toBe(
    [
      'depth  prompt tok/s  generation tok/s',
      '0      1500.0        -',
      '8192   900.3         70.0',
    ].join('\n'),
  );
});
