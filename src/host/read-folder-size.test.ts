import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFolderSize } from './read-folder-size.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-folder-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { root };
}

test('it sums the files below the folder, subfolders included', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'a.gguf'), '12345');
  await Bun.write(join(ctx.root, 'sub', 'b.gguf'), '123');

  const result = await readFolderSize(ctx.root);

  expect(result).toBe(8);
});

test('it reads an empty folder as zero bytes', async () => {
  const ctx = await setupTest();
  const result = await readFolderSize(ctx.root);

  expect(result).toBe(0);
});

test('it reads a missing folder as null', async () => {
  const ctx = await setupTest();
  const result = await readFolderSize(join(ctx.root, 'missing'));

  expect(result).toBeNull();
});
