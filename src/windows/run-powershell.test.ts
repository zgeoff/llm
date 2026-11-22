import { expect, test } from 'bun:test';
import { runPowerShell } from './run-powershell.ts';
import type { ProcessSpawner } from './run-powershell.ts';

function setupTest() {
  const commands: (readonly string[])[] = [];

  const spawnProcess: ProcessSpawner = (command) => {
    commands.push(command);

    return Promise.resolve({ exitCode: 3, stdout: 'one\r\ntwo\r\n', stderr: 'bad\r\n' });
  };

  return { commands, spawnProcess };
}

test('it runs powershell.exe by its full path with the non-interactive flags', async () => {
  const ctx = setupTest();

  await runPowerShell('Get-Date', ctx.spawnProcess);

  expect(ctx.commands[0]?.slice(0, 6)).toStrictEqual([
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
  ]);
});

test('it encodes the script as base64 UTF-16LE after the progress preference', async () => {
  const ctx = setupTest();

  await runPowerShell('Write-Output "héllo"', ctx.spawnProcess);

  const encoded = ctx.commands[0]?.[6] ?? '';

  expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe(
    `$ProgressPreference = 'SilentlyContinue'\nWrite-Output "héllo"`,
  );
});

test('it returns the exit code and the output with carriage returns removed', async () => {
  const ctx = setupTest();

  const result = await runPowerShell('Get-Date', ctx.spawnProcess);

  expect(result).toStrictEqual({ exitCode: 3, stdout: 'one\ntwo\n', stderr: 'bad\n' });
});
