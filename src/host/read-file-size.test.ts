import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSize } from './read-file-size.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-size-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { root };
}

test('it reads the size of a file in bytes', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'model.gguf'), 'twelve bytes');

  const result = await readFileSize(join(ctx.root, 'model.gguf'));

  expect(result).toBe(12);
});

test('it reads a missing file as null', async () => {
  const ctx = await setupTest();
  const result = await readFileSize(join(ctx.root, 'missing.gguf'));

  expect(result).toBeNull();
});
