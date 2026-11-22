import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { network } from '../testing/network.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-ttft-'));

  const printed: string[] = [];
  const events: string[] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const baseURL = 'http://172.28.80.1:8181';

  network.use(
    http.get(`${baseURL}/health`, () => new HttpResponse('OK')),
    http.post(`${baseURL}/api/models/unload/:id`, () => {
      events.push('unload');

      return new HttpResponse('OK');
    }),
    http.post(`${baseURL}/v1/chat/completions`, () => {
      events.push('stream');

      return new HttpResponse(
        [
          'data: {"choices":[{"delta":{"content":"a"}}]}',
          'data: {"choices":[],"usage":{"completion_tokens":5}}',
          'data: [DONE]',
          '',
        ].join('\n\n'),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    }),
  );

  return {
    events,
    printed,
    resultsPath: join(root, 'results', 'example-model-ttft.jsonl'),
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          repoRoot: root,
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}

test('it unloads the model, then times one cold and each warm run', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['ttft', 'example-model', '--reps', '2']);

  expect(result.exitCode).toBe(0);
  expect(ctx.events).toStrictEqual(['unload', 'stream', 'stream', 'stream']);

  const text = await Bun.file(ctx.resultsPath).text();

  const rows = text
    .trim()
    .split('\n')
    .map((line): unknown => JSON.parse(line));

  expect(rows).toMatchObject([
    { model_id: 'example-model', backend: 'vulkan', phase: 'cold', completion_tokens: 5 },
    { phase: 'warm', rep: 1 },
    { phase: 'warm', rep: 2 },
  ]);
});

test('it appends to the file on a second run', async () => {
  const ctx = await setupTest();

  await ctx.run(['ttft', 'example-model', '--reps', '1']);
  await ctx.run(['ttft', 'example-model', '--reps', '1']);

  const text = await Bun.file(ctx.resultsPath).text();

  const lines = text.trim().split('\n');

  expect(lines).toHaveLength(4);
});

test('it rejects a repetition count that is not a whole number', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['ttft', 'example-model', '--reps', '0']);

  expect(result.errorMessage).toBe('--reps takes a whole number, one or more');
});
