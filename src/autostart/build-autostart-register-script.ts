import { win32 } from 'node:path';
import type { Machine } from '../catalog/types.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { quotePowerShellString } from '../windows/quote-powershell-string.ts';
import { autostartTaskName } from './autostart-task-name.ts';
import { buildAutostartTaskArguments } from './build-autostart-task-arguments.ts';

// Runs elevated: a logon trigger needs administrator rights to register. The task itself runs as
// the user, with limited rights, and never times out.
export function buildAutostartRegisterScript(machine: Machine, user: string): string {
  const quotedUser = quotePowerShellString(user);

  return [
    "$ErrorActionPreference = 'Stop'",
    `New-Item -ItemType Directory -Force -Path ${quotePowerShellString(win32.dirname(machine.llamaSwap.logPath))} | Out-Null`,
    `$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ${quotePowerShellString(buildAutostartTaskArguments(machine))} -WorkingDirectory ${quotePowerShellString(joinWindowsPath(machine.binDir, 'llama-swap'))}`,
    `$trigger = New-ScheduledTaskTrigger -AtLogOn -User ${quotedUser}`,
    `$principal = New-ScheduledTaskPrincipal -UserId ${quotedUser} -LogonType Interactive -RunLevel Limited`,
    '$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew',
    `Register-ScheduledTask -TaskName ${quotePowerShellString(autostartTaskName)} -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null`,
  ].join('\n');
}
