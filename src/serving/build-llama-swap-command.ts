import type { Machine } from '../catalog/types.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';

export function buildLlamaSwapCommand(machine: Machine): string {
  const executable = joinWindowsPath(machine.binDir, 'llama-swap', 'llama-swap.exe');

  return `"${executable}" --config "${machine.llamaSwap.configPath}" --listen ${machine.llamaSwap.listen}`;
}
