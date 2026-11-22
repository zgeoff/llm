import type { Machine } from '../catalog/types.ts';
import { buildLlamaSwapCommand } from '../serving/build-llama-swap-command.ts';

// The task runs cmd.exe so the log redirect works, the same way `llm up` starts llama-swap.
export function buildAutostartTaskArguments(machine: Machine): string {
  return `/d /s /c "${buildLlamaSwapCommand(machine)} > "${machine.llamaSwap.logPath}" 2>&1"`;
}
