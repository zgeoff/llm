import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { loadModel } from './load-model.ts';

function setupTest() {
  const baseURL = 'http://172.28.80.1:8181';
  const bodies: unknown[] = [];

  network.use(
    http.post(`${baseURL}/v1/chat/completions`, async (info) => {
      const body: unknown = await info.request.json();

      bodies.push(body);

      return HttpResponse.json({ choices: [] });
    }),
  );

  return { baseURL, bodies };
}

test('it asks for one token from the named model', async () => {
  const ctx = setupTest();

  await loadModel(ctx.baseURL, 'example-model');

  expect(ctx.bodies).toMatchObject([{ model: 'example-model', max_tokens: 1 }]);
});

test('it rejects with the answer when llama-swap refuses', () => {
  const ctx = setupTest();

  network.use(
    http.post(
      `${ctx.baseURL}/v1/chat/completions`,
      () => new HttpResponse('upstream failed', { status: 502 }),
    ),
  );

  expect(loadModel(ctx.baseURL, 'example-model')).rejects.toThrow(
    'llama-swap could not load example-model: 502 upstream failed',
  );
});
