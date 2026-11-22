import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { readRunningModels } from './read-running-models.ts';

test('it lists each running model with its state', async () => {
  network.use(
    http.get('http://172.28.80.1:8181/running', () =>
      HttpResponse.json({ running: [{ model: 'gpt-oss-20b', state: 'ready', proxy: 'x' }] }),
    ),
  );

  const result = await readRunningModels('http://172.28.80.1:8181');

  expect(result).toStrictEqual(['gpt-oss-20b (ready)']);
});

test('it returns an empty list when nothing is loaded', async () => {
  network.use(
    http.get('http://172.28.80.1:8181/running', () => HttpResponse.json({ running: [] })),
  );

  const result = await readRunningModels('http://172.28.80.1:8181');

  expect(result).toStrictEqual([]);
});
