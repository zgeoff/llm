const units = ['B', 'KB', 'MB', 'GB', 'TB'];

// Decimal units, to match the sizes Hugging Face lists.
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}
