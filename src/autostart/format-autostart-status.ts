import type { AutostartStatus } from './parse-autostart-status.ts';

export function formatAutostartStatus(status: AutostartStatus): string {
  if (!status.registered) {
    return 'autostart is off: no Scheduled Task is registered';
  }

  return [
    `autostart is on: the task is ${status.state}`,
    `last run   ${status.lastRunTime}`,
    `last exit  ${status.lastTaskResult}`,
  ].join('\n');
}
