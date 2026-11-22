import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildAutostartRegisterScript } from './build-autostart-register-script.ts';

test('it doubles a single quote in the user name', () => {
  const script = buildAutostartRegisterScript(buildCatalog().machine, String.raw`HOST\o'brien`);

  expect(script).toContain(String.raw`-User 'HOST\o''brien'`);
});

test('it runs the task without a time limit and without elevation', () => {
  const script = buildAutostartRegisterScript(buildCatalog().machine, String.raw`HOST\owner`);

  expect(script).toContain('-ExecutionTimeLimit ([TimeSpan]::Zero)');
  expect(script).toContain('-RunLevel Limited');
});

test('it triggers at logon and registers under the task name', () => {
  const script = buildAutostartRegisterScript(buildCatalog().machine, String.raw`HOST\owner`);

  expect(script).toContain('New-ScheduledTaskTrigger -AtLogOn');
  expect(script).toContain("Register-ScheduledTask -TaskName 'llm llama-swap'");
});
