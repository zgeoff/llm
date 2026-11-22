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
  const root = await mkdtemp(join(tmpdir(), 'llm-load-'));

  const printed: string[] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const baseURL = 'http://172.28.80.1:8181';

  return {
    baseURL,
    printed,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}

test('it loads the model through llama-swap', async () => {
  const ctx = await setupTest();

  const models: unknown[] = [];

  network.use(
    http.get(`${ctx.baseURL}/health`, () => new HttpResponse('OK')),
    http.post(`${ctx.baseURL}/v1/chat/completions`, async (info) => {
      const body: unknown = await info.request.json();

      models.push(body);

      return HttpResponse.json({ choices: [] });
    }),
  );

  const result = await ctx.run(['load', 'example-model']);

  expect(result.exitCode).toBe(0);
  expect(models).toMatchObject([{ model: 'example-model' }]);
  expect(ctx.printed).toStrictEqual(['Loading example-model', 'example-model is loaded']);
});

test('it fails for an id that is not in the catalog', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['load', 'nope']);

  expect(result.exitCode).toBe(1);
  expect(result.errorMessage).toContain('no model "nope" in the catalog');
});

test('it tells the owner to run llm up when llama-swap does not answer', async () => {
  const ctx = await setupTest();

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  const result = await ctx.run(['load', 'example-model']);

  expect(result.errorMessage).toBe(
    `llama-swap does not answer at ${ctx.baseURL}; run llm up first`,
  );
});
