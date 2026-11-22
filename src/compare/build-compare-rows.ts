import type { BenchResult, ResultRow, TTFTResult } from './parse-result-rows.ts';

export interface CompareRow {
  readonly modelID: string;
  readonly backend: string;
  readonly promptTokensPerSecond: number | null;
  readonly generationTokensPerSecond: number | null;
  readonly deepGeneration: { readonly depth: number; readonly tokensPerSecond: number } | null;
  readonly coldTTFTMs: number | null;
  readonly warmTTFTMs: number | null;
  readonly ttftTokensPerSecond: number | null;
}

// One row per model and backend, from the latest rows of each kind. Rows come in file order, so
// the last one of a kind is the latest. Bench rows have no run id, so the latest row for each test
// and depth wins; a ttft run is the rows that share the run id of the last ttft row.
export function buildCompareRows(
  results: readonly ResultRow[],
  ids: readonly string[],
): CompareRow[] {
  const keys = new Map<string, { modelID: string; backend: string }>();

  for (const result of results) {
    const modelID = result.row.model_id;

    if (ids.length === 0 || ids.includes(modelID)) {
      keys.set(`${modelID}\u0000${result.row.backend}`, { modelID, backend: result.row.backend });
    }
  }

  return [...keys.values()]
    .toSorted(
      (left, right) =>
        left.modelID.localeCompare(right.modelID) || left.backend.localeCompare(right.backend),
    )
    .map((key) => {
      const owned = results.filter(
        (result) => result.row.model_id === key.modelID && result.row.backend === key.backend,
      );

      return buildCompareRow(
        key.modelID,
        key.backend,
        owned.flatMap((result) => (result.kind === 'bench' ? [result.row] : [])),
        owned.flatMap((result) => (result.kind === 'ttft' ? [result.row] : [])),
      );
    });
}

function buildCompareRow(
  modelID: string,
  backend: string,
  bench: readonly BenchResult[],
  ttft: readonly TTFTResult[],
): CompareRow {
  const promptRows = bench.filter((row) => row.n_gen === 0 && row.n_prompt > 0);
  const generationRows = bench.filter((row) => row.n_prompt === 0 && row.n_gen > 0);

  const deepest = generationRows.reduce<BenchResult | null>(
    (best, row) => (best === null || row.n_depth >= best.n_depth ? row : best),
    null,
  );

  const latestRun = ttft.at(-1)?.run;
  const run = ttft.filter((row) => row.run === latestRun);
  const warm = run.filter((row) => row.phase === 'warm');
  const warmRates = warm.flatMap((row) => (row.tok_s === null ? [] : [row.tok_s]));

  return {
    modelID,
    backend,
    promptTokensPerSecond: promptRows.findLast((row) => row.n_depth === 0)?.avg_ts ?? null,
    generationTokensPerSecond: generationRows.findLast((row) => row.n_depth === 0)?.avg_ts ?? null,
    deepGeneration:
      deepest === null || deepest.n_depth === 0
        ? null
        : {
            depth: deepest.n_depth,
            tokensPerSecond:
              generationRows.findLast((row) => row.n_depth === deepest.n_depth)?.avg_ts ??
              deepest.avg_ts,
          },
    coldTTFTMs: run.find((row) => row.phase === 'cold')?.ttft_ms ?? null,
    warmTTFTMs: calculateMean(warm.map((row) => row.ttft_ms)),
    ttftTokensPerSecond: calculateMean(warmRates),
  };
}

function calculateMean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
