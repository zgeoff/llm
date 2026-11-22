import { z } from 'zod';

const gameStateSchema = z.object({ servingWasUp: z.boolean(), startedAt: z.string() });

export type GameState = z.infer<typeof gameStateSchema>;

// Null when game mode is off. A file that does not parse counts as absent.
export async function readGameState(path: string): Promise<GameState | null> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  try {
    const json: unknown = await file.json();

    return gameStateSchema.parse(json);
  } catch {
    return null;
  }
}
