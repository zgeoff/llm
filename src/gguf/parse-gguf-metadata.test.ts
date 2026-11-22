import { expect, test } from 'bun:test';
import { buildGGUFBytes } from '../testing/build-gguf-bytes.ts';
import { parseGGUFMetadata } from './parse-gguf-metadata.ts';

function setupTest() {
  const failed = null;

  // The values of the parsed file by key, or null when the bytes do not parse.
  const toValues = (bytes: Uint8Array): Record<string, unknown> | null => {
    const result = parseGGUFMetadata(bytes);

    return result.status === 'ok' ? Object.fromEntries(result.metadata.values) : failed;
  };

  return { toValues };
}

test('it reads strings, numbers and booleans', () => {
  const ctx = setupTest();

  const bytes = buildGGUFBytes([
    { key: 'general.name', value: { type: 'string', value: 'Tëst model' } },
    { key: 'llama.context_length', value: { type: 'uint32', value: 131_072 } },
    { key: 'general.parameter_count', value: { type: 'uint64', value: 35_000_000_000 } },
    { key: 'llama.rope.freq_base', value: { type: 'float32', value: 0.5 } },
    { key: 'tokenizer.ggml.add_bos_token', value: { type: 'bool', value: true } },
  ]);

  expect(ctx.toValues(bytes)).toStrictEqual({
    'general.name': 'Tëst model',
    'llama.context_length': 131_072,
    'general.parameter_count': 35_000_000_000,
    'llama.rope.freq_base': 0.5,
    'tokenizer.ggml.add_bos_token': true,
  });
});

test('it reads the version and the tensor count', () => {
  const result = parseGGUFMetadata(buildGGUFBytes([]));

  expect(result).toStrictEqual({
    status: 'ok',
    metadata: { version: 3, tensorCount: 0, values: new Map() },
  });
});

test('it reads an array of numbers and an array of booleans', () => {
  const ctx = setupTest();

  const bytes = buildGGUFBytes([
    {
      key: 'llama.attention.head_count_kv',
      value: {
        type: 'array',
        items: [
          { type: 'uint32', value: 0 },
          { type: 'uint32', value: 4 },
        ],
      },
    },
    {
      key: 'llama.attention.sliding_window_pattern',
      value: {
        type: 'array',
        items: [
          { type: 'bool', value: true },
          { type: 'bool', value: false },
        ],
      },
    },
  ]);

  expect(ctx.toValues(bytes)).toStrictEqual({
    'llama.attention.head_count_kv': [0, 4],
    'llama.attention.sliding_window_pattern': [true, false],
  });
});

test('it skips an array of strings and keeps the entries after it', () => {
  const ctx = setupTest();

  const bytes = buildGGUFBytes([
    {
      key: 'tokenizer.ggml.tokens',
      value: {
        type: 'array',
        items: [
          { type: 'string', value: '<s>' },
          { type: 'string', value: 'hello' },
        ],
      },
    },
    { key: 'tokenizer.chat_template', value: { type: 'string', value: '{{ messages }}' } },
  ]);

  expect(ctx.toValues(bytes)).toStrictEqual({ 'tokenizer.chat_template': '{{ messages }}' });
});

test('it ignores the bytes after the key-value section', () => {
  const ctx = setupTest();
  const header = buildGGUFBytes([{ key: 'general.name', value: { type: 'string', value: 'x' } }]);

  const withTensorData = new Uint8Array([...header, 1, 2, 3]);

  expect(ctx.toValues(withTensorData)).toStrictEqual({ 'general.name': 'x' });
});

test('it reports truncated bytes so the caller can read more', () => {
  const bytes = buildGGUFBytes([
    { key: 'general.name', value: { type: 'string', value: 'a long enough model name' } },
  ]);

  expect(parseGGUFMetadata(bytes.subarray(0, -5))).toStrictEqual({
    status: 'truncated',
  });
});

test('it rejects bytes without the GGUF magic', () => {
  expect(parseGGUFMetadata(new TextEncoder().encode('GGML and some more bytes'))).toStrictEqual({
    status: 'invalid',
    reason: 'not a GGUF file: the magic bytes are missing',
  });
});

test('it rejects an unsupported version', () => {
  const bytes = buildGGUFBytes([]);

  new DataView(bytes.buffer).setUint32(4, 9, true);

  expect(parseGGUFMetadata(bytes)).toStrictEqual({
    status: 'invalid',
    reason: 'unsupported GGUF version 9',
  });
});

test('it rejects an unknown value type', () => {
  const bytes = buildGGUFBytes([{ key: 'k', value: { type: 'uint32', value: 1 } }]);

  // the type code of the only entry sits after the 24-byte header, the 8-byte key length and the key
  new DataView(bytes.buffer).setUint32(24 + 8 + 1, 99, true);

  expect(parseGGUFMetadata(bytes)).toStrictEqual({
    status: 'invalid',
    reason: 'unknown value type 99',
  });
});
