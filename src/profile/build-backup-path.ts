// config.json.bak-<UTC stamp>-<reason>, the name that the atc profile decision fixes.
export function buildBackupPath(configPath: string, now: Date, reason: string): string {
  const stamp = now.toISOString().replaceAll(/[-:]|\.\d{3}/gu, '');

  return `${configPath}.bak-${stamp}-${reason}`;
}
