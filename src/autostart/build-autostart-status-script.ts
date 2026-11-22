import { quotePowerShellString } from '../windows/quote-powershell-string.ts';
import { autostartTaskName } from './autostart-task-name.ts';

// Reading a task needs no elevation.
export function buildAutostartStatusScript(): string {
  const name = quotePowerShellString(autostartTaskName);

  return [
    `$task = Get-ScheduledTask -TaskName ${name} -ErrorAction SilentlyContinue`,
    'if ($null -eq $task) { Write-Output \'{"registered":false}\'; exit 0 }',
    `$info = Get-ScheduledTaskInfo -TaskName ${name}`,
    "[pscustomobject]@{ registered = $true; state = [string]$task.State; lastRunTime = $(if ($info.LastRunTime) { $info.LastRunTime.ToString('o') } else { 'never' }); lastTaskResult = $info.LastTaskResult } | ConvertTo-Json -Compress",
  ].join('\n');
}
