import type { Machine } from '../catalog/types.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { quotePowerShellString } from '../windows/quote-powershell-string.ts';

// The rule is scoped to the WSL adapter, never to a subnet, because the WSL NAT subnet can change
// between WSL starts.
export function buildFirewallCommand(machine: Machine, adapterName: string): string {
  const program = joinWindowsPath(machine.binDir, 'llama-swap', 'llama-swap.exe');

  return [
    'New-NetFirewallRule',
    "-DisplayName 'llm llama-swap (WSL)'",
    '-Direction Inbound',
    `-Program ${quotePowerShellString(program)}`,
    '-Action Allow',
    `-InterfaceAlias ${quotePowerShellString(adapterName)}`,
    '-Profile Any',
  ].join(' ');
}
