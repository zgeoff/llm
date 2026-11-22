import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildLlamaSwapCommand } from './build-llama-swap-command.ts';

test('it runs llama-swap with the generated config on the listen address', () => {
  expect(buildLlamaSwapCommand(buildCatalog().machine)).toBe(
    String.raw`"C:\llm\bin\llama-swap\llama-swap.exe" --config "C:\llm\llama-swap.yaml" --listen 0.0.0.0:8181`,
  );
});
