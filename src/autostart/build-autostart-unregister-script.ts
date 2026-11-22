import { quotePowerShellString } from '../windows/quote-powershell-string.ts';
import { autostartTaskName } from './autostart-task-name.ts';

export function buildAutostartUnregisterScript(): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `Unregister-ScheduledTask -TaskName ${quotePowerShellString(autostartTaskName)} -Confirm:$false`,
  ].join('\n');
}
