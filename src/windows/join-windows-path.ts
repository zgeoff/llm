export function joinWindowsPath(...segments: readonly string[]): string {
  return segments
    .map((segment, index) =>
      index === 0 ? segment.replace(/\\+$/u, '') : segment.replaceAll(/^\\+|\\+$/gu, ''),
    )
    .filter((segment) => segment !== '')
    .join('\\');
}
