import { expect, test } from 'bun:test';
import { buildGameStatePath } from './build-game-state-path.ts';

test('it keeps the state file in the XDG state folder of the home directory', () => {
  expect(buildGameStatePath('/home/someone')).toBe('/home/someone/.local/state/llm/game-mode.json');
});
