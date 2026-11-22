import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildLlamaSwapURL } from './build-llama-swap-url.ts';

test('it joins the host IP and the port of the listen address', () => {
  expect(buildLlamaSwapURL(buildCatalog().machine, '172.28.80.1')).toBe('http://172.28.80.1:8181');
});
