import { expect, test } from 'bun:test';
import { parseGGUFMetadata } from '../gguf/parse-gguf-metadata.ts';
import { buildGGUFBytes } from './build-gguf-bytes.ts';

test('it builds a file that the parser reads back', () => {
  const bytes = buildGGUFBytes([
    { key: 'general.architecture', value: { type: 'string', value: 'llama' } },
    { key: 'llama.block_count', value: { type: 'uint32', value: 32 } },
  ]);

  const result = parseGGUFMetadata(bytes);

  expect(result.status === 'ok' && Object.fromEntries(result.metadata.values)).toStrictEqual({
    'general.architecture': 'llama',
    'llama.block_count': 32,
  });
});
