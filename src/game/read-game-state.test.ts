import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGameState } from './read-game-state.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-read-game-state-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { path: join(root, 'game-mode.json') };
}

test('it reads the state that the file holds', async () => {
  const ctx = await setupTest();

  const state = { servingWasUp: true, startedAt: '2026-11-03T10:20:30.000Z' };

  await Bun.write(ctx.path, JSON.stringify(state));

  const result = await readGameState(ctx.path);

  expect(result).toStrictEqual(state);
});

test('it reads null when the file is absent', async () => {
  const ctx = await setupTest();
  const result = await readGameState(ctx.path);

  expect(result).toBeNull();
});

test('it reads null when the file is not a game state', async () => {
  const ctx = await setupTest();

  await Bun.write(ctx.path, '{"servingWasUp": "yes"}');

  const result = await readGameState(ctx.path);

  expect(result).toBeNull();
});
