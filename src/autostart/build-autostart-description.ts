import { win32 } from 'node:path';
import type { Machine } from '../catalog/types.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { autostartTaskName } from './autostart-task-name.ts';
import { buildAutostartTaskArguments } from './build-autostart-task-arguments.ts';

// What `llm autostart on` registers, printed before the UAC prompt.
export function buildAutostartDescription(machine: Machine, user: string): string {
  return [
    'llm will register this Windows Scheduled Task, which needs one UAC prompt:',
    `  name     ${autostartTaskName}`,
    `  trigger  when ${user} logs on`,
    '  runs as  that user, without elevation',
    `  starts   cmd.exe ${buildAutostartTaskArguments(machine)}`,
    `  in       ${joinWindowsPath(machine.binDir, 'llama-swap')}`,
    `  log      ${win32.normalize(machine.llamaSwap.logPath)}`,
  ].join('\n');
}
