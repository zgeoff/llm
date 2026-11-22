import { expect, test } from 'bun:test';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { stopLlamaSwap } from './stop-llama-swap.ts';

test('it stops llama-swap and every llama-server', async () => {
  const powerShell = buildFakePowerShell();

  await stopLlamaSwap(powerShell.run);

  expect(powerShell.scripts[0]).toContain('Get-Process llama-swap, llama-server');
  expect(powerShell.scripts[0]).toContain('Stop-Process -Force');
});

test('it decides its exit code from the processes still running, not from Get-Process', async () => {
  const powerShell = buildFakePowerShell();

  await stopLlamaSwap(powerShell.run);

  expect(powerShell.scripts[0]).toContain('if ($left.Count -gt 0)');
  expect(powerShell.scripts[0]?.trimEnd().endsWith('exit 0')).toBe(true);
});

test('it waits up to 15 seconds for the processes to exit', async () => {
  const powerShell = buildFakePowerShell();

  await stopLlamaSwap(powerShell.run);

  expect(powerShell.scripts[0]).toContain('$deadline = (Get-Date).AddSeconds(15)');

  expect(powerShell.scripts[0]).toContain(
    'while ($left.Count -gt 0 -and (Get-Date) -lt $deadline)',
  );
});

test('it rejects when PowerShell fails', () => {
  const powerShell = buildFakePowerShell([
    { whenScriptIncludes: 'Stop-Process', result: { exitCode: 1, stderr: 'denied' } },
  ]);

  expect(stopLlamaSwap(powerShell.run)).rejects.toThrow('cannot stop llama-swap: denied');
});
