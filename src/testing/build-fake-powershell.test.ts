import { expect, test } from 'bun:test';
import { buildFakePowerShell } from './build-fake-powershell.ts';

test('it answers with an empty success when no answer matches', async () => {
  const powerShell = buildFakePowerShell();

  const result = await powerShell.run('Get-Date');

  expect(result).toStrictEqual({ exitCode: 0, stdout: '', stderr: '' });
});

test('it answers with the first answer whose text the script includes', async () => {
  const powerShell = buildFakePowerShell([
    { whenScriptIncludes: 'Get-Process', result: { stdout: 'first' } },
    { whenScriptIncludes: 'Get-Process', result: { stdout: 'second' } },
  ]);

  const result = await powerShell.run('Get-Process llama-swap');

  expect(result.stdout).toBe('first');
});

test('it records each script in order', async () => {
  const powerShell = buildFakePowerShell();

  await powerShell.run('one');
  await powerShell.run('two');

  expect(powerShell.scripts).toStrictEqual(['one', 'two']);
});
