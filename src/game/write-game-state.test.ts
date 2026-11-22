import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGameState } from './read-game-state.ts';
import { writeGameState } from './write-game-state.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-write-game-state-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { path: join(root, 'nested', 'game-mode.json') };
}

test('it creates the folder and writes a state that reads back', async () => {
  const ctx = await setupTest();

  const state = { servingWasUp: false, startedAt: '2026-11-03T10:20:30.000Z' };

  await writeGameState(ctx.path, state);

  const result = await readGameState(ctx.path);

  expect(result).toStrictEqual(state);
});
