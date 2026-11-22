import { expect, test } from 'bun:test';
import { buildCompareRows } from './build-compare-rows.ts';
import type { ResultRow } from './parse-result-rows.ts';

function setupTest() {
  return {
    bench: (backend: string, kind: 'pp' | 'tg', depth: number, rate: number): ResultRow => ({
      kind: 'bench',
      row: {
        model_id: 'a',
        backend,
        n_prompt: kind === 'pp' ? 512 : 0,
        n_gen: kind === 'tg' ? 128 : 0,
        n_depth: depth,
        avg_ts: rate,
      },
    }),
    ttft: (run: string, phase: 'cold' | 'warm', ttftMs: number, rate: number): ResultRow => ({
      kind: 'ttft',
      row: {
        model_id: 'a',
        backend: 'vulkan',
        run,
        phase,
        ttft_ms: ttftMs,
        tok_s: rate,
      },
    }),
  };
}

test('it builds one row per model and backend from the latest bench rows', () => {
  const ctx = setupTest();

  const rows = buildCompareRows(
    [
      ctx.bench('vulkan', 'pp', 0, 100),
      ctx.bench('vulkan', 'tg', 0, 10),
      ctx.bench('vulkan', 'tg', 32_768, 7),
      ctx.bench('vulkan', 'pp', 0, 200),
      ctx.bench('rocm', 'tg', 0, 9),
    ],
    [],
  );

  expect(rows).toStrictEqual([
    {
      modelID: 'a',
      backend: 'rocm',
      promptTokensPerSecond: null,
      generationTokensPerSecond: 9,
      deepGeneration: null,
      coldTTFTMs: null,
      warmTTFTMs: null,
      ttftTokensPerSecond: null,
    },
    {
      modelID: 'a',
      backend: 'vulkan',
      promptTokensPerSecond: 200,
      generationTokensPerSecond: 10,
      deepGeneration: { depth: 32_768, tokensPerSecond: 7 },
      coldTTFTMs: null,
      warmTTFTMs: null,
      ttftTokensPerSecond: null,
    },
  ]);
});

test('it uses only the latest ttft run, averaging its warm rows', () => {
  const ctx = setupTest();

  const rows = buildCompareRows(
    [
      ctx.ttft('run-1', 'cold', 9000, 50),
      ctx.ttft('run-1', 'warm', 900, 50),
      ctx.ttft('run-2', 'cold', 4000, 60),
      ctx.ttft('run-2', 'warm', 100, 60),
      ctx.ttft('run-2', 'warm', 300, 80),
    ],
    [],
  );

  expect(rows[0]).toMatchObject({ coldTTFTMs: 4000, warmTTFTMs: 200, ttftTokensPerSecond: 70 });
});

test('it keeps only the asked ids', () => {
  const ctx = setupTest();
  const other = ctx.bench('vulkan', 'tg', 0, 2);

  if (other.kind === 'bench') {
    other.row.model_id = 'b';
  }

  const rows = buildCompareRows([ctx.bench('vulkan', 'tg', 0, 1), other], ['b']);

  expect(rows.map((row) => row.modelID)).toStrictEqual(['b']);
});

test('it returns no rows for no results', () => {
  expect(buildCompareRows([], [])).toStrictEqual([]);
});
