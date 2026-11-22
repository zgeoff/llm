import { mkdir, rm } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { define } from 'gunshi';
import { match } from 'ts-pattern';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { buildProxyUnitPath } from '../proxy/build-proxy-unit-path.ts';
import { buildSystemdUnit } from '../proxy/build-systemd-unit.ts';
import { createProxyServer } from '../proxy/create-proxy-server.ts';
import { probeLlamaSwap } from '../serving/probe-llama-swap.ts';

const actions = ['run', 'install', 'uninstall', 'status'] as const;

export function createProxyCommand(dependencies: CLIDependencies) {
  return define({
    name: 'proxy',
    description:
      'Run the proxy between Claude Code and llama-swap, or install it as a systemd user service',
    args: {
      action: {
        type: 'positional',
        description: `One of ${actions.join(', ')}`,
      },
    },
    run: async (ctx) => {
      const action = pickAction(ctx.values.action);

      await match(action)
        .with('run', () => runProxy(dependencies))
        .with('install', () => installProxy(dependencies))
        .with('uninstall', () => uninstallProxy(dependencies))
        .with('status', () => printProxyStatus(dependencies))
        .exhaustive();
    },
  });
}

type Action = (typeof actions)[number];

function pickAction(value: string | undefined): Action {
  const action = actions.find((candidate) => candidate === value);

  if (action === undefined) {
    throw new CLIError(`name what the proxy should do: ${actions.join(', ')}`);
  }

  return action;
}

async function runProxy(dependencies: CLIDependencies): Promise<void> {
  const catalog = await readCatalog(dependencies.catalogPath);

  const server = createProxyServer({
    machine: catalog.machine,
    readDefaultRoute: dependencies.readDefaultRoute,
    port: catalog.machine.proxy.port,
  });

  dependencies.print(`llm proxy listens on ${server.url.href}`);
}

async function installProxy(dependencies: CLIDependencies): Promise<void> {
  const unitPath = buildProxyUnitPath(dependencies.homeDir);

  await mkdir(dirname(unitPath), { recursive: true });

  await Bun.write(
    unitPath,
    buildSystemdUnit({ bunPath: dependencies.bunPath, repoRoot: dependencies.repoRoot }),
  );

  await runSystemctl(dependencies, ['daemon-reload']);
  await runSystemctl(dependencies, ['enable', '--now', basename(unitPath)]);

  dependencies.print(`installed and started ${unitPath}`);
}

async function runSystemctl(dependencies: CLIDependencies, args: readonly string[]): Promise<void> {
  const result = await dependencies.runProcess(['systemctl', '--user', ...args]);

  if (result.exitCode !== 0) {
    throw new CLIError(
      `systemctl --user ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
}

async function uninstallProxy(dependencies: CLIDependencies): Promise<void> {
  const unitPath = buildProxyUnitPath(dependencies.homeDir);

  if (!(await Bun.file(unitPath).exists())) {
    dependencies.print(`${unitPath} is not installed`);

    return;
  }

  await runSystemctl(dependencies, ['disable', '--now', basename(unitPath)]);
  await rm(unitPath);
  await runSystemctl(dependencies, ['daemon-reload']);

  dependencies.print(`stopped and removed ${unitPath}`);
}

async function printProxyStatus(dependencies: CLIDependencies): Promise<void> {
  const catalog = await readCatalog(dependencies.catalogPath);

  const unitName = basename(buildProxyUnitPath(dependencies.homeDir));
  const url = `http://127.0.0.1:${catalog.machine.proxy.port}`;

  const active = await dependencies.runProcess(['systemctl', '--user', 'is-active', unitName]);
  const enabled = await dependencies.runProcess(['systemctl', '--user', 'is-enabled', unitName]);
  const reachable = await probeLlamaSwap(url);

  dependencies.print(
    [
      `unit       ${active.stdout.trim() || 'unknown'} (${enabled.stdout.trim() || 'unknown'})`,
      `URL        ${url}`,
      `health     ${reachable ? 'ok, llama-swap answers through the proxy' : 'no answer through the proxy'}`,
    ].join('\n'),
  );
}
