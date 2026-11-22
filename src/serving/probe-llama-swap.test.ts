import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { probeLlamaSwap } from './probe-llama-swap.ts';

test('it is true when /health answers 200', async () => {
  network.use(http.get('http://172.28.80.1:8181/health', () => new HttpResponse('OK')));

  const result = await probeLlamaSwap('http://172.28.80.1:8181');

  expect(result).toBeTrue();
});

test('it is false when /health answers an error status', async () => {
  network.use(
    http.get('http://172.28.80.1:8181/health', () => new HttpResponse(null, { status: 503 })),
  );

  const result = await probeLlamaSwap('http://172.28.80.1:8181');

  expect(result).toBeFalse();
});

test('it is false when the connection fails', async () => {
  network.use(http.get('http://172.28.80.1:8181/health', () => HttpResponse.error()));

  const result = await probeLlamaSwap('http://172.28.80.1:8181');

  expect(result).toBeFalse();
});
