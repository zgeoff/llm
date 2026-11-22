import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDriveUsage } from './read-drive-usage.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-drive-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { root };
}

test('it reads the total, used and free bytes of the filesystem under a path', async () => {
  const ctx = await setupTest();
  const usage = await readDriveUsage(ctx.root);

  expect(usage.totalBytes).toBeGreaterThan(0);
  expect(usage.freeBytes).toBeLessThanOrEqual(usage.totalBytes);
  expect(usage.usedBytes + usage.freeBytes).toBeLessThanOrEqual(usage.totalBytes);
});

test('it rejects a path that does not exist', async () => {
  const ctx = await setupTest();

  expect(readDriveUsage(join(ctx.root, 'missing'))).rejects.toThrow();
});
