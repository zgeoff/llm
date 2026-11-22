import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';

async function setupTest(modelIDs: readonly string[]) {
  const root = await mkdtemp(join(tmpdir(), 'llm-compare-'));

  const printed: string[] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  for (const modelID of modelIDs) {
    const rows = [
      { model_id: modelID, backend: 'vulkan', n_prompt: 512, n_gen: 0, n_depth: 0, avg_ts: 1000 },
      { model_id: modelID, backend: 'vulkan', n_prompt: 0, n_gen: 128, n_depth: 0, avg_ts: 100 },
    ];

    await Bun.write(
      join(root, 'results', `${modelID}-vulkan.jsonl`),
      rows.map((row) => `${JSON.stringify(row)}\n`).join(''),
    );
  }

  return {
    root,
    printed,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          repoRoot: root,
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}

test('it tabulates the bench and ttft rows of every model', async () => {
  const ctx = await setupTest(['a', 'b']);

  const ttft = {
    run: 'r1',
    model_id: 'a',
    backend: 'vulkan',
    phase: 'cold',
    ttft_ms: 5000,
    tok_s: 90,
  };

  await Bun.write(join(ctx.root, 'results', 'a-ttft.jsonl'), `${JSON.stringify(ttft)}\n`);

  const result = await ctx.run(['compare']);

  expect(result.exitCode).toBe(0);
  expect(ctx.printed[0]).toContain('a      vulkan   1000.0  100.0');
  expect(ctx.printed[0]).toContain('5000');
  expect(ctx.printed[0]).toContain('b      vulkan');
});

test('it keeps the models it is asked for', async () => {
  const ctx = await setupTest(['a', 'b']);

  await ctx.run(['compare', 'b']);

  expect(ctx.printed[0]).not.toContain('a      vulkan');
  expect(ctx.printed[0]).toContain('b      vulkan');
});

test('it says so when results/ has no rows', async () => {
  const ctx = await setupTest([]);

  await ctx.run(['compare']);

  expect(ctx.printed[0]).toContain('no bench or ttft rows in');
});
