import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGGUFBytes } from '../testing/build-gguf-bytes.ts';
import { readGGUFMetadata } from './read-gguf-metadata.ts';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'llm-gguf-'));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  return { directory };
}

test('it reads the metadata of a file on disk', async () => {
  const ctx = await setupTest();

  await Bun.write(
    join(ctx.directory, 'model.gguf'),
    buildGGUFBytes([{ key: 'general.architecture', value: { type: 'string', value: 'qwen3' } }]),
  );

  const metadata = await readGGUFMetadata(join(ctx.directory, 'model.gguf'));

  expect(metadata.values.get('general.architecture')).toBe('qwen3');
});

test('it grows its window until the key-value section fits', async () => {
  const ctx = await setupTest();

  const template = 'x'.repeat(5000);

  await Bun.write(
    join(ctx.directory, 'model.gguf'),
    buildGGUFBytes([
      { key: 'general.architecture', value: { type: 'string', value: 'qwen3' } },
      { key: 'tokenizer.chat_template', value: { type: 'string', value: template } },
    ]),
  );

  const metadata = await readGGUFMetadata(join(ctx.directory, 'model.gguf'), {
    firstWindowBytes: 64,
  });

  expect(metadata.values.get('tokenizer.chat_template')).toBe(template);
});

test('it rejects a file that ends inside the key-value section', async () => {
  const ctx = await setupTest();

  const bytes = buildGGUFBytes([
    { key: 'general.name', value: { type: 'string', value: 'a long enough model name' } },
  ]);

  await Bun.write(join(ctx.directory, 'model.gguf'), bytes.subarray(0, -5));

  expect(readGGUFMetadata(join(ctx.directory, 'model.gguf'))).rejects.toThrow(
    'the file ends inside the key-value section',
  );
});

test('it rejects a file that is not GGUF', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.directory, 'model.gguf'), 'this is plain text, not a model');

  expect(readGGUFMetadata(join(ctx.directory, 'model.gguf'))).rejects.toThrow('not a GGUF file');
});
