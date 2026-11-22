import { statfs } from 'node:fs/promises';

export interface DriveUsage {
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly freeBytes: number;
}

export async function readDriveUsage(mountPath: string): Promise<DriveUsage> {
  const stats = await statfs(mountPath);

  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bavail * stats.bsize;

  return { totalBytes, usedBytes: totalBytes - stats.bfree * stats.bsize, freeBytes };
}
