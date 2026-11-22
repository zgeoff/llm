import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// The sum of every file below the folder, or null when the folder does not exist.
export async function readFolderSize(folderPath: string): Promise<number | null> {
  let entries;

  try {
    entries = await readdir(folderPath, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  const sizes = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const stats = await stat(join(entry.parentPath, entry.name));

        return stats.size;
      }),
  );

  return sizes.reduce((total, size) => total + size, 0);
}
