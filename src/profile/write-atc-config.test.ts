import { expect, onTestFinished, test } from 'bun:test';
import { chmod, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeATCConfig } from './write-atc-config.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-write-atc-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { configPath: join(root, 'config.json'), backupPath: join(root, 'config.json.bak') };
}

test.each([0o600, 0o640, 0o644])('it keeps the mode %o of the existing config', async (mode) => {
  const ctx = await setupTest();

  await Bun.write(ctx.configPath, '{"agents":{}}');

  await chmod(ctx.configPath, mode);
  await writeATCConfig(ctx.configPath, ctx.backupPath, { agents: { example: {} } });

  const info = await stat(ctx.configPath);

  expect(info.mode & 0o777).toBe(mode);
});

test('it replaces the config and backs up the old one', async () => {
  const ctx = await setupTest();

  await Bun.write(ctx.configPath, '{"agents":{}}');

  await writeATCConfig(ctx.configPath, ctx.backupPath, { agents: { example: {} } });

  const backup = await Bun.file(ctx.backupPath).text();
  const written: unknown = await Bun.file(ctx.configPath).json();

  expect(backup).toBe('{"agents":{}}');
  expect(written).toStrictEqual({ agents: { example: {} } });
});
