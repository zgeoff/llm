import { stat } from 'node:fs/promises';

export async function readFileSize(path: string): Promise<number | null> {
  try {
    const stats = await stat(path);

    return stats.size;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}
