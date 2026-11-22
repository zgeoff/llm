import { expect, test } from 'bun:test';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { startDetached } from './start-detached.ts';

test('it starts the command through Win32_Process.Create with its output in the log', async () => {
  const powerShell = buildFakePowerShell();

  await startDetached(powerShell.run, {
    command: String.raw`"C:\llm\bin\llama-swap\llama-swap.exe" --listen 0.0.0.0:8181`,
    logPath: String.raw`C:\llm\logs\llama-swap.log`,
    workingDirectory: String.raw`C:\llm`,
  });

  expect(powerShell.scripts).toHaveLength(1);
  expect(powerShell.scripts[0]).toContain('Invoke-CimMethod -ClassName Win32_Process');

  expect(powerShell.scripts[0]).toContain(
    String.raw`CommandLine = 'cmd.exe /d /s /c "` +
      String.raw`"C:\llm\bin\llama-swap\llama-swap.exe" --listen 0.0.0.0:8181 > "C:\llm\logs\llama-swap.log" 2>&1"'`,
  );

  expect(powerShell.scripts[0]).toContain(String.raw`CurrentDirectory = 'C:\llm'`);
});

test('it creates the folder of the log first', async () => {
  const powerShell = buildFakePowerShell();

  await startDetached(powerShell.run, {
    command: 'server.exe',
    logPath: String.raw`C:\llm\logs\server.log`,
    workingDirectory: String.raw`C:\llm`,
  });

  expect(powerShell.scripts[0]).toContain(
    String.raw`New-Item -ItemType Directory -Force -Path 'C:\llm\logs'`,
  );
});

test('it puts the path prefix in front of PATH for the started process only', async () => {
  const powerShell = buildFakePowerShell();

  await startDetached(powerShell.run, {
    command: 'server.exe',
    logPath: String.raw`C:\llm\logs\server.log`,
    workingDirectory: String.raw`C:\llm`,
    pathPrefix: String.raw`C:\llm\rocm\bin`,
  });

  expect(powerShell.scripts[0]).toContain(
    String.raw`/c "set "PATH=C:\llm\rocm\bin;%PATH%" && server.exe > `,
  );
});

test('it doubles a single quote in the command line', async () => {
  const powerShell = buildFakePowerShell();

  await startDetached(powerShell.run, {
    command: `server.exe --alias it's`,
    logPath: String.raw`C:\llm\logs\server.log`,
    workingDirectory: String.raw`C:\llm`,
  });

  expect(powerShell.scripts[0]).toContain(`server.exe --alias it''s`);
});

test('it rejects when PowerShell fails', () => {
  const powerShell = buildFakePowerShell([
    { whenScriptIncludes: 'Win32_Process', result: { exitCode: 1, stderr: 'access denied' } },
  ]);

  expect(
    startDetached(powerShell.run, {
      command: 'server.exe',
      logPath: String.raw`C:\llm\logs\server.log`,
      workingDirectory: String.raw`C:\llm`,
    }),
  ).rejects.toThrow('cannot start server.exe: access denied');
});
