import { win32 } from 'node:path';
import { CLIError } from '../cli-error.ts';
import { quotePowerShellString } from './quote-powershell-string.ts';
import type { PowerShellRunner } from './types.ts';

export interface StartDetachedOptions {
  readonly command: string;
  readonly logPath: string;
  readonly workingDirectory: string;

  // A folder put in front of PATH for this process only, such as the ROCm library folder.
  readonly pathPrefix?: string;
}

// Win32_Process.Create makes the process a child of WMI, not of the PowerShell that WSL launched.
// A child of that PowerShell inherits its stdout pipe and keeps the WSL call open.
export async function startDetached(
  runPowerShell: PowerShellRunner,
  options: StartDetachedOptions,
): Promise<void> {
  const environment =
    options.pathPrefix === undefined ? '' : `set "PATH=${options.pathPrefix};%PATH%" && `;

  const commandLine = `cmd.exe /d /s /c "${environment}${options.command} > "${options.logPath}" 2>&1"`;

  const result = await runPowerShell(
    [
      "$ErrorActionPreference = 'Stop'",
      `New-Item -ItemType Directory -Force -Path ${quotePowerShellString(win32.dirname(options.logPath))} | Out-Null`,
      `$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${quotePowerShellString(commandLine)}; CurrentDirectory = ${quotePowerShellString(options.workingDirectory)} }`,
      'if ($result.ReturnValue -ne 0) { throw "Win32_Process.Create returned $($result.ReturnValue)" }',
    ].join('\n'),
  );

  if (result.exitCode !== 0) {
    throw new CLIError(`cannot start ${options.command}: ${result.stderr.trim()}`);
  }
}
