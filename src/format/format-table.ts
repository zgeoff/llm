export function formatTable(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [header, ...rows];

  const widths = header.map((_, column) =>
    Math.max(...lines.map((line) => (line[column] ?? '').length)),
  );

  return lines
    .map((line) =>
      line
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}
