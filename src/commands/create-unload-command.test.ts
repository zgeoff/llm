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
  const root = await mkdtemp(join(tmpdir(), 'llm-unload-'));

  const printed: string[] = [];
  const paths: string[] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const baseURL = 'http://172.28.80.1:8181';

  network.use(
    http.get(`${baseURL}/health`, () => new HttpResponse('OK')),
    http.post(`${baseURL}/api/models/unload*`, (info) => {
      paths.push(new URL(info.request.url).pathname);

      return new HttpResponse('OK');
    }),
  );

  return {
    paths,
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

test('it unloads every model when no id is given', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['unload']);

  expect(result.exitCode).toBe(0);
  expect(ctx.paths).toStrictEqual(['/api/models/unload']);
  expect(ctx.printed).toStrictEqual(['every model is unloaded']);
});

test('it unloads one model when an id is given', async () => {
  const ctx = await setupTest();

  await ctx.run(['unload', 'example-model']);

  expect(ctx.paths).toStrictEqual(['/api/models/unload/example-model']);
  expect(ctx.printed).toStrictEqual(['example-model is unloaded']);
});

test('it fails for an id that is not in the catalog', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['unload', 'nope']);

  expect(result.exitCode).toBe(1);
  expect(ctx.paths).toStrictEqual([]);
});
