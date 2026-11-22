import type { Catalog } from '../catalog/types.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { readWindowsHostIP } from '../windows/read-windows-host-ip.ts';
import { startDetached } from '../windows/start-detached.ts';
import { buildFirewallCommand } from './build-firewall-command.ts';
import { buildLlamaSwapCommand } from './build-llama-swap-command.ts';
import { buildLlamaSwapURL } from './build-llama-swap-url.ts';
import { probeLlamaSwap } from './probe-llama-swap.ts';
import { writeLlamaSwapConfig } from './write-llama-swap-config.ts';

// Regenerates the config, starts llama-swap detached and waits until WSL reaches it. Returns the
// URL WSL reaches it at, and whether it was already running.
export async function startLlamaSwap(
  catalog: Catalog,
  dependencies: CLIDependencies,
): Promise<{ readonly url: string; readonly alreadyRunning: boolean }> {
  const machine = catalog.machine;

  const hostIP = await readWindowsHostIP(dependencies.readDefaultRoute);

  const url = buildLlamaSwapURL(machine, hostIP);

  await writeLlamaSwapConfig(catalog, dependencies.mountRoot);

  const alreadyRunning = await probeLlamaSwap(url);

  if (alreadyRunning) {
    return { url, alreadyRunning: true };
  }

  await startDetached(dependencies.runPowerShell, {
    command: buildLlamaSwapCommand(machine),
    logPath: machine.llamaSwap.logPath,
    workingDirectory: joinWindowsPath(machine.binDir, 'llama-swap'),
  });

  const deadline = dependencies.clock.now() + dependencies.healthPoll.timeoutMs;

  while (dependencies.clock.now() < deadline) {
    const ready = await probeLlamaSwap(url);

    if (ready) {
      return { url, alreadyRunning: false };
    }

    await dependencies.clock.sleep(dependencies.healthPoll.intervalMs);
  }

  const explanation = await explainUnreachable(catalog, dependencies, url);

  throw new CLIError(explanation);
}

async function explainUnreachable(
  catalog: Catalog,
  dependencies: CLIDependencies,
  url: string,
): Promise<string> {
  const defaultAdapterName = 'vEthernet (WSL (Hyper-V firewall))';
  const port = catalog.machine.llamaSwap.listen.split(':').at(-1);

  const loopback = await dependencies.runPowerShell(
    `curl.exe -s -o NUL -w '%{http_code}' http://127.0.0.1:${port}/health`,
  );

  if (loopback.stdout.trim() !== '200') {
    return `llama-swap did not answer at ${url}/health; run llm logs to see why`;
  }

  const adapter = await dependencies.runPowerShell(
    "Get-NetAdapter | Where-Object { $_.Name -like 'vEthernet (WSL*' } | Select-Object -First 1 -ExpandProperty Name",
  );

  const command = buildFirewallCommand(
    catalog.machine,
    adapter.stdout.trim() || defaultAdapterName,
  );

  return [
    `llama-swap runs on Windows but WSL cannot reach ${url}/health, so a firewall rule is missing.`,
    'Run this in an elevated PowerShell on Windows, then run llm up again:',
    command,
  ].join('\n');
}
