import { define } from 'gunshi';
import { match } from 'ts-pattern';
import { buildAutostartDescription } from '../autostart/build-autostart-description.ts';
import { buildAutostartRegisterScript } from '../autostart/build-autostart-register-script.ts';
import { buildAutostartUnregisterScript } from '../autostart/build-autostart-unregister-script.ts';
import { formatAutostartStatus } from '../autostart/format-autostart-status.ts';
import { readAutostartStatus } from '../autostart/read-autostart-status.ts';
import { runElevated } from '../autostart/run-elevated.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { writeLlamaSwapConfig } from '../serving/write-llama-swap-config.ts';

const actions = ['on', 'off', 'status'] as const;

export function createAutostartCommand(dependencies: CLIDependencies) {
  return define({
    name: 'autostart',
    description: 'Start llama-swap at Windows logon through a Scheduled Task',
    args: {
      action: { type: 'positional', description: `One of ${actions.join(', ')}` },
    },
    run: async (ctx) => {
      const action = actions.find((candidate) => candidate === ctx.values.action);

      if (action === undefined) {
        throw new CLIError(`name what autostart should do: ${actions.join(', ')}`);
      }

      await match(action)
        .with('on', () => turnAutostartOn(dependencies))
        .with('off', () => turnAutostartOff(dependencies))
        .with('status', () => printAutostartStatus(dependencies))
        .exhaustive();
    },
  });
}

async function turnAutostartOn(dependencies: CLIDependencies): Promise<void> {
  const catalog = await readCatalog(dependencies.catalogPath);
  const user = await readWindowsUser(dependencies);

  // The task starts llama-swap with this file, so it exists before the first logon.
  await writeLlamaSwapConfig(catalog, dependencies.mountRoot);

  dependencies.print(buildAutostartDescription(catalog.machine, user));
  dependencies.print('Waiting for the UAC prompt');

  await runElevated(
    dependencies.runPowerShell,
    buildAutostartRegisterScript(catalog.machine, user),
  );

  const status = await readAutostartStatus(dependencies.runPowerShell);

  if (!status.registered) {
    throw new CLIError('the elevated step finished, but the Scheduled Task is not registered');
  }

  dependencies.print(formatAutostartStatus(status));
}

async function readWindowsUser(dependencies: CLIDependencies): Promise<string> {
  const result = await dependencies.runPowerShell(
    String.raw`[Environment]::UserDomainName + '\' + [Environment]::UserName`,
  );

  const user = result.stdout.trim();

  if (result.exitCode !== 0 || user === '') {
    throw new CLIError(`cannot read the Windows user name: ${result.stderr.trim()}`);
  }

  return user;
}

async function turnAutostartOff(dependencies: CLIDependencies): Promise<void> {
  const before = await readAutostartStatus(dependencies.runPowerShell);

  if (!before.registered) {
    dependencies.print(formatAutostartStatus(before));

    return;
  }

  dependencies.print('Removing the Scheduled Task; this needs one UAC prompt');

  await runElevated(dependencies.runPowerShell, buildAutostartUnregisterScript());

  const after = await readAutostartStatus(dependencies.runPowerShell);

  if (after.registered) {
    throw new CLIError('the elevated step finished, but the Scheduled Task is still registered');
  }

  dependencies.print(formatAutostartStatus(after));
}

async function printAutostartStatus(dependencies: CLIDependencies): Promise<void> {
  const status = await readAutostartStatus(dependencies.runPowerShell);

  dependencies.print(formatAutostartStatus(status));
}
