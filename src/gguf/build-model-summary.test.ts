import { expect, test } from 'bun:test';
import { buildModelSummary } from './build-model-summary.ts';

test('it reads the keys under the architecture prefix', () => {
  const summary = buildModelSummary(
    new Map<string, string | number | boolean | readonly number[]>([
      ['general.architecture', 'qwen3'],
      ['general.parameter_count', 27_000_000_000],
      ['general.size_label', '27B'],
      ['qwen3.block_count', 64],
      ['qwen3.attention.head_count', 24],
      ['qwen3.attention.head_count_kv', 4],
      ['qwen3.attention.key_length', 256],
      ['qwen3.attention.value_length', 256],
      ['qwen3.context_length', 262_144],
      ['tokenizer.chat_template', '{{ messages }}'],
    ]),
  );

  expect(summary).toStrictEqual({
    architecture: 'qwen3',
    parameterCount: 27_000_000_000,
    sizeLabel: '27B',
    blockCount: 64,
    headCount: 24,
    headCountKV: 4,
    keyLength: 256,
    valueLength: 256,
    contextLength: 262_144,
    slidingWindow: null,
    layerPatternKeys: [],
    chatTemplate: '{{ messages }}',
  });
});

test('it lists the keys that mark sliding-window and hybrid layers', () => {
  const summary = buildModelSummary(
    new Map<string, string | number | boolean | readonly boolean[]>([
      ['general.architecture', 'mixed'],
      ['mixed.attention.sliding_window', 1024],
      ['mixed.attention.sliding_window_pattern', [true, false]],
      ['mixed.ssm.state_size', 128],
      ['mixed.full_attention_interval', 4],
      ['other.ssm.state_size', 64],
    ]),
  );

  expect(summary.slidingWindow).toBe(1024);

  expect(summary.layerPatternKeys).toStrictEqual([
    'mixed.attention.sliding_window',
    'mixed.attention.sliding_window_pattern',
    'mixed.ssm.state_size',
    'mixed.full_attention_interval',
  ]);
});

test('it names the architecture unknown when the file has none', () => {
  expect(buildModelSummary(new Map()).architecture).toBe('unknown');
});
