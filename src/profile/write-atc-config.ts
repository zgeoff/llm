import { chmod, copyFile, rename, stat, writeFile } from 'node:fs/promises';
import type { ATCConfig } from './read-atc-config.ts';

// Copies the config to backupPath, then replaces it in one rename so atc never reads half a file.
export async function writeATCConfig(
  configPath: string,
  backupPath: string,
  config: ATCConfig,
): Promise<void> {
  const original = await stat(configPath);

  await copyFile(configPath, backupPath);

  const temporaryPath = `${configPath}.tmp-${process.pid}`;

  // The file holds credentials, so it starts owner-only and takes the old mode before the rename.
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, original.mode);
  await rename(temporaryPath, configPath);
}
