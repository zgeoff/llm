import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GameState } from './read-game-state.ts';

export async function writeGameState(path: string, state: GameState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  await Bun.write(path, `${JSON.stringify(state, null, 2)}\n`);
}
