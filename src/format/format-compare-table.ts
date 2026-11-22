import type { CompareRow } from '../compare/build-compare-rows.ts';
import { formatTable } from './format-table.ts';

export function formatCompareTable(rows: readonly CompareRow[]): string {
  return formatTable(
    [
      'model',
      'backend',
      'pp t/s',
      'tg t/s',
      'tg t/s deep',
      'cold ttft ms',
      'warm ttft ms',
      'ttft tok/s',
    ],
    rows.map((row) => [
      row.modelID,
      row.backend,
      formatRate(row.promptTokensPerSecond),
      formatRate(row.generationTokensPerSecond),
      row.deepGeneration === null
        ? '-'
        : `${formatRate(row.deepGeneration.tokensPerSecond)} @${row.deepGeneration.depth}`,
      formatMilliseconds(row.coldTTFTMs),
      formatMilliseconds(row.warmTTFTMs),
      formatRate(row.ttftTokensPerSecond),
    ]),
  );
}

function formatRate(value: number | null): string {
  return value === null ? '-' : value.toFixed(1);
}

function formatMilliseconds(value: number | null): string {
  return value === null ? '-' : String(Math.round(value));
}
