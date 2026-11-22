import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGGUFMetadata } from '../gguf/read-gguf-metadata.ts';
import { createStubModelFile } from './create-stub-model-file.ts';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'llm-stub-model-'));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  return { directory };
}

test('it writes a file whose chat template the GGUF reader returns', async () => {
  const ctx = await setupTest();

  const path = join(ctx.directory, 'nested/model.gguf');

  await createStubModelFile(path, '{{ reasoning_effort }}');

  const metadata = await readGGUFMetadata(path);

  expect(metadata.values.get('tokenizer.chat_template')).toBe('{{ reasoning_effort }}');
});
