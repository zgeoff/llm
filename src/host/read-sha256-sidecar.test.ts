import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSHA256Sidecar } from './read-sha256-sidecar.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-sha-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { root };
}

test('it reads the digest from a bare sidecar', async () => {
  const ctx = await setupTest();

  const digest = 'a'.repeat(64);

  await Bun.write(join(ctx.root, 'model.gguf.sha256'), `${digest}\n`);

  const result = await readSHA256Sidecar(join(ctx.root, 'model.gguf'));

  expect(result).toBe(digest);
});

test('it reads the digest from a sidecar that names the file', async () => {
  const ctx = await setupTest();

  const digest = 'B'.repeat(64);

  await Bun.write(join(ctx.root, 'model.gguf.sha256'), `${digest}  model.gguf\n`);

  const result = await readSHA256Sidecar(join(ctx.root, 'model.gguf'));

  expect(result).toBe('b'.repeat(64));
});

test('it reads a missing sidecar as null', async () => {
  const ctx = await setupTest();
  const result = await readSHA256Sidecar(join(ctx.root, 'model.gguf'));

  expect(result).toBeNull();
});

test('it reads a sidecar without a digest as null', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'model.gguf.sha256'), 'not a digest\n');

  const result = await readSHA256Sidecar(join(ctx.root, 'model.gguf'));

  expect(result).toBeNull();
});
