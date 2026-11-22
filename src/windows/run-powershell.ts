import { encodePowerShellScript } from './encode-powershell-script.ts';
import type { ProcessResult } from './types.ts';

const powerShellPath = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

// Runs a command in the WSL process table and collects its output.
export type ProcessSpawner = (command: readonly string[]) => Promise<ProcessResult>;

export async function runPowerShell(
  script: string,
  spawnProcess: ProcessSpawner,
): Promise<ProcessResult> {
  const result = await spawnProcess([
    powerShellPath,
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    encodePowerShellScript(`$ProgressPreference = 'SilentlyContinue'\n${script}`),
  ]);

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.replaceAll('\r', ''),
    stderr: result.stderr.replaceAll('\r', ''),
  };
}
