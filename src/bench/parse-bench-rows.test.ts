import { expect, test } from 'bun:test';
import { parseBenchRows } from './parse-bench-rows.ts';

test('it keeps the JSON lines and drops the log lines around them', () => {
  const rows = parseBenchRows(
    [
      'ggml_vulkan: Found 1 Vulkan devices',
      '{"n_prompt":512,"n_gen":0,"n_depth":0,"avg_ts":1500.5,"model_type":"example"}',
      '{not json',
      '{"unrelated":true}',
      'exit=0',
    ].join('\n'),
  );

  expect(rows).toStrictEqual([
    { n_prompt: 512, n_gen: 0, n_depth: 0, avg_ts: 1500.5, model_type: 'example' },
  ]);
});

test('it treats a row with no depth as depth 0', () => {
  expect(parseBenchRows('{"n_prompt":0,"n_gen":128,"avg_ts":80}')).toStrictEqual([
    { n_prompt: 0, n_gen: 128, n_depth: 0, avg_ts: 80 },
  ]);
});
