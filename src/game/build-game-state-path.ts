import { join } from 'node:path';

export function buildGameStatePath(homeDir: string): string {
  return join(homeDir, '.local', 'state', 'llm', 'game-mode.json');
}
