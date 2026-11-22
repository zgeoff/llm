import { expect, test } from 'bun:test';
import { parseResultRows } from './parse-result-rows.ts';

function setupTest() {
  const bench = {
    model_id: 'a',
    backend: 'vulkan',
    n_prompt: 512,
    n_gen: 0,
    n_depth: 0,
    avg_ts: 5000.5,
    build_commit: 'abc',
  };

  const ttft = {
    run: '2026-11-03T10:00:00.000Z',
    model_id: 'a',
    backend: 'vulkan',
    phase: 'cold',
    ttft_ms: 900,
    tok_s: 120,
  };

  return { bench, ttft };
}

test('it tells bench rows from ttft rows', () => {
  const ctx = setupTest();
  const text = `${JSON.stringify(ctx.bench)}\n${JSON.stringify(ctx.ttft)}\n`;
  const kinds = parseResultRows(text).map((entry) => entry.kind);

  expect(kinds).toStrictEqual(['bench', 'ttft']);
});

test('it skips rows without a model id, text lines and broken JSON', () => {
  const oldRow = JSON.stringify({ n_prompt: 512, n_gen: 0, avg_ts: 1 });

  expect(parseResultRows(`${oldRow}\nnot json\n{broken\n\n`)).toStrictEqual([]);
});

test('it defaults the depth of a bench row to 0', () => {
  const line = JSON.stringify({
    model_id: 'a',
    backend: 'rocm',
    n_prompt: 512,
    n_gen: 0,
    avg_ts: 1,
  });

  const [entry] = parseResultRows(line);

  expect(entry).toMatchObject({ kind: 'bench', row: { n_depth: 0 } });
});
