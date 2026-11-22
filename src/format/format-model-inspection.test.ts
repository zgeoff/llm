import { expect, test } from 'bun:test';
import { buildKVCacheCost } from '../gguf/build-kv-cache-cost.ts';
import { buildModelSummary } from '../gguf/build-model-summary.ts';
import { formatModelInspection } from './format-model-inspection.ts';

function setupTest() {
  const dense = new Map<string, string | number>([
    ['general.architecture', 'llama'],
    ['general.parameter_count', 8_030_000_000],
    ['general.size_label', '8B'],
    ['llama.block_count', 32],
    ['llama.attention.head_count', 32],
    ['llama.attention.head_count_kv', 8],
    ['llama.attention.key_length', 128],
    ['llama.attention.value_length', 128],
    ['llama.context_length', 131_072],
  ]);

  return { dense };
}

test('it prints each key of a ctx.dense model and its KV cache cost at both cache types', () => {
  const ctx = setupTest();
  const summary = buildModelSummary(ctx.dense);

  expect(formatModelInspection(summary, buildKVCacheCost(summary))).toBe(
    [
      'Architecture: llama',
      'Parameters: 8.0 B (8B)',
      'Blocks: 32',
      'Attention heads: 32',
      'KV heads: 8',
      'Key length: 128',
      'Value length: 128',
      'Context length: 131072',
      'Sliding window: -',
      'KV cache per 1k tokens: 131.1 MB at f16, 69.6 MB at q8_0',
    ].join('\n'),
  );
});

test('it says the KV cache figure is an upper bound for a model with sliding-window layers', () => {
  const ctx = setupTest();

  const summary = buildModelSummary(
    new Map([...ctx.dense, ['llama.attention.sliding_window', 4096]]),
  );

  const text = formatModelInspection(summary, buildKVCacheCost(summary));

  expect(text).toContain('Sliding window: 4096');

  expect(text).toEndWith(
    'The model has hybrid or sliding-window layers (llama.attention.sliding_window), so the KV cache figure is an upper bound.',
  );
});

test('it says the cost is unknown when the file lacks a key', () => {
  const summary = buildModelSummary(new Map([['general.architecture', 'llama']]));

  expect(formatModelInspection(summary, null)).toContain(
    'KV cache per 1k tokens: unknown, the file lacks a key the cost needs',
  );
});

test('it summarises a per-layer KV head list', () => {
  const summary = buildModelSummary(
    new Map<string, string | number | readonly number[]>([
      ['general.architecture', 'hybrid'],
      ['hybrid.attention.head_count_kv', [0, 0, 0, 4]],
    ]),
  );

  expect(formatModelInspection(summary, null)).toContain(
    'KV heads: 4 in the widest layer, 1 of 4 layers',
  );
});
