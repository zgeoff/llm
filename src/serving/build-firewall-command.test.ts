import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildFirewallCommand } from './build-firewall-command.ts';

test('it allows llama-swap.exe inbound on the WSL adapter only', () => {
  expect(buildFirewallCommand(buildCatalog().machine, 'vEthernet (WSL (Hyper-V firewall))')).toBe(
    String.raw`New-NetFirewallRule -DisplayName 'llm llama-swap (WSL)' -Direction Inbound -Program 'C:\llm\bin\llama-swap\llama-swap.exe' -Action Allow -InterfaceAlias 'vEthernet (WSL (Hyper-V firewall))' -Profile Any`,
  );
});

test('it never scopes the rule to an address', () => {
  expect(buildFirewallCommand(buildCatalog().machine, 'vEthernet (WSL)')).not.toContain(
    'RemoteAddress',
  );
});
