import { expect, test } from 'bun:test';
import { buildKVCacheCost } from './build-kv-cache-cost.ts';
import { buildModelSummary } from './build-model-summary.ts';
import type { GGUFValue } from './parse-gguf-metadata.ts';

test('it multiplies layers, KV heads and key plus value length by the bytes per element', () => {
  const summary = buildModelSummary(
    new Map<string, GGUFValue>([
      ['general.architecture', 'llama'],
      ['llama.block_count', 32],
      ['llama.attention.head_count', 32],
      ['llama.attention.head_count_kv', 8],
      ['llama.attention.key_length', 128],
      ['llama.attention.value_length', 128],
    ]),
  );

  // 32 layers x 8 heads x 256 values per head x 2 bytes x 1000 tokens
  expect(buildKVCacheCost(summary)).toStrictEqual({
    f16BytesPer1kTokens: 131_072_000,
    q8BytesPer1kTokens: 69_632_000,
  });
});

test('it derives the head length from the embedding width when the file has no key length', () => {
  const summary = buildModelSummary(
    new Map<string, GGUFValue>([
      ['general.architecture', 'llama'],
      ['llama.block_count', 2],
      ['llama.embedding_length', 4096],
      ['llama.attention.head_count', 32],
    ]),
  );

  // KV heads fall back to the head count: 2 x 32 x 256 x 2 x 1000
  expect(buildKVCacheCost(summary)?.f16BytesPer1kTokens).toBe(32_768_000);
});

test('it sums the per-layer KV head counts of a hybrid model', () => {
  const summary = buildModelSummary(
    new Map<string, GGUFValue>([
      ['general.architecture', 'hybrid'],
      ['hybrid.block_count', 4],
      ['hybrid.attention.head_count_kv', [0, 0, 0, 2]],
      ['hybrid.attention.key_length', 100],
      ['hybrid.attention.value_length', 100],
    ]),
  );

  // 2 heads x 200 values x 2 bytes x 1000 tokens
  expect(buildKVCacheCost(summary)?.f16BytesPer1kTokens).toBe(800_000);
});

test('it returns null when the file lacks the block count', () => {
  const summary = buildModelSummary(
    new Map<string, GGUFValue>([['general.architecture', 'llama']]),
  );

  expect(buildKVCacheCost(summary)).toBeNull();
});
