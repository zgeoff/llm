import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildAutostartTaskArguments } from './build-autostart-task-arguments.ts';

test('it redirects the llama-swap log inside cmd.exe', () => {
  expect(buildAutostartTaskArguments(buildCatalog().machine)).toBe(
    String.raw`/d /s /c ""C:\llm\bin\llama-swap\llama-swap.exe" --config "C:\llm\llama-swap.yaml" --listen 0.0.0.0:8181 > "C:\llm\logs\llama-swap.log" 2>&1"`,
  );
});
