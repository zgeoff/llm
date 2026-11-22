import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { unloadModels } from './unload-models.ts';

function setupTest() {
  const baseURL = 'http://172.28.80.1:8181';
  const paths: string[] = [];

  network.use(
    http.post(`${baseURL}/api/models/unload*`, (info) => {
      paths.push(new URL(info.request.url).pathname);

      return new HttpResponse('OK');
    }),
  );

  return { baseURL, paths };
}

test('it unloads every model when no id is given', async () => {
  const ctx = setupTest();

  await unloadModels(ctx.baseURL, null);

  expect(ctx.paths).toStrictEqual(['/api/models/unload']);
});

test('it unloads one model by id', async () => {
  const ctx = setupTest();

  await unloadModels(ctx.baseURL, 'example-model');

  expect(ctx.paths).toStrictEqual(['/api/models/unload/example-model']);
});

test('it rejects with the answer when llama-swap refuses', () => {
  const ctx = setupTest();

  network.use(
    http.post(`${ctx.baseURL}/api/models/unload`, () => new HttpResponse('busy', { status: 500 })),
  );

  expect(unloadModels(ctx.baseURL, null)).rejects.toThrow(
    'llama-swap could not unload its models: 500 busy',
  );
});
