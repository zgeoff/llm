import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildAutostartDescription } from './build-autostart-description.ts';

test('it names the task, the trigger, the user and the command', () => {
  const text = buildAutostartDescription(buildCatalog().machine, String.raw`HOST\owner`);

  expect(text).toContain('name     llm llama-swap');
  expect(text).toContain(String.raw`when HOST\owner logs on`);
  expect(text).toContain(String.raw`--config "C:\llm\llama-swap.yaml"`);
});
