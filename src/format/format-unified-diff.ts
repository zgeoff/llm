interface DiffLabels {
  readonly before: string;
  readonly after: string;
}

// A unified diff of two texts by line, or an empty string when the lines are the same.
export function formatUnifiedDiff(before: string, after: string, labels: DiffLabels): string {
  const lines = buildDiffLines(before.split('\n'), after.split('\n'));
  const changed = lines.flatMap((line, index) => (line.kind === ' ' ? [] : [index]));

  if (changed.length === 0) {
    return '';
  }

  const hunks = groupHunks(changed, lines.length).map((range) => formatHunk(lines, range));

  return [`--- ${labels.before}`, `+++ ${labels.after}`, ...hunks].join('\n');
}

interface DiffLine {
  readonly kind: ' ' | '-' | '+';
  readonly text: string;
}

// A longest common subsequence over the lines, walked from the start.
function buildDiffLines(before: readonly string[], after: readonly string[]): DiffLine[] {
  const width = after.length + 1;

  const common = new Uint32Array((before.length + 1) * width);

  for (let row = before.length - 1; row >= 0; row -= 1) {
    for (let column = after.length - 1; column >= 0; column -= 1) {
      common[row * width + column] =
        before[row] === after[column]
          ? (common[(row + 1) * width + column + 1] ?? 0) + 1
          : Math.max(
              common[(row + 1) * width + column] ?? 0,
              common[row * width + column + 1] ?? 0,
            );
    }
  }

  const lines: DiffLine[] = [];
  let row = 0;
  let column = 0;

  while (row < before.length || column < after.length) {
    const beforeLine = before[row];
    const afterLine = after[column];

    if (beforeLine !== undefined && beforeLine === afterLine) {
      lines.push({ kind: ' ', text: beforeLine });

      row += 1;
      column += 1;
    } else if (
      beforeLine !== undefined &&
      (afterLine === undefined ||
        (common[(row + 1) * width + column] ?? 0) >= (common[row * width + column + 1] ?? 0))
    ) {
      lines.push({ kind: '-', text: beforeLine });

      row += 1;
    } else if (afterLine !== undefined) {
      lines.push({ kind: '+', text: afterLine });

      column += 1;
    }
  }

  return lines;
}

interface HunkRange {
  readonly start: number;
  readonly end: number;
}

// Changes closer than twice the context share one hunk.
function groupHunks(changed: readonly number[], lineCount: number): HunkRange[] {
  const contextLines = 3;
  const ranges: { start: number; end: number }[] = [];

  for (const index of changed) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lineCount, index + contextLines + 1);
    const last = ranges.at(-1);

    if (last !== undefined && start <= last.end) {
      last.end = end;
    } else {
      ranges.push({ start, end });
    }
  }

  return ranges;
}

function formatHunk(lines: readonly DiffLine[], range: HunkRange): string {
  const before = lines.slice(0, range.start).filter((line) => line.kind !== '+').length;
  const after = lines.slice(0, range.start).filter((line) => line.kind !== '-').length;
  const hunk = lines.slice(range.start, range.end);
  const beforeCount = hunk.filter((line) => line.kind !== '+').length;
  const afterCount = hunk.filter((line) => line.kind !== '-').length;

  return [
    `@@ -${before + 1},${beforeCount} +${after + 1},${afterCount} @@`,
    ...hunk.map((line) => `${line.kind}${line.text}`),
  ].join('\n');
}
