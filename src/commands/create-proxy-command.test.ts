import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claimFreePorts } from '@zgeoff/testing/process';
import { startStubServer } from '@zgeoff/testing/server';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';

interface SystemctlAnswers {
  readonly failOn?: string;
  readonly stdoutByVerb?: Readonly<Record<string, string>>;
}

async function setupTest(answers: SystemctlAnswers = {}, proxyPort = 8182) {
  const root = await mkdtemp(join(tmpdir(), 'llm-proxy-'));

  const printed: string[] = [];
  const commands: string[][] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const catalog = buildCatalog();

  await Bun.write(
    join(root, 'models.yaml'),
    Bun.YAML.stringify({
      ...catalog,
      machine: { ...catalog.machine, proxy: { port: proxyPort } },
    }),
  );

  return {
    root,
    printed,
    commands,
    unitPath: join(root, 'home/.config/systemd/user/llm-proxy.service'),
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          homeDir: join(root, 'home'),
          bunPath: '/opt/bun/bin/bun',
          repoRoot: '/home/test/llm/',
          print: (text) => {
            printed.push(text);
          },
          runProcess: (command) => {
            commands.push([...command]);

            const verb = command[2] ?? '';
            const failed = verb === answers.failOn;

            return Promise.resolve({
              exitCode: failed ? 1 : 0,
              stdout: answers.stdoutByVerb?.[verb] ?? '',
              stderr: failed ? 'boom' : '',
            });
          },
        }),
      ),
  };
}

test('it writes the unit, reloads systemd and enables the service with install', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['proxy', 'install']);

  expect(result.exitCode).toBe(0);

  const unit = await Bun.file(ctx.unitPath).text();

  expect(unit).toContain('ExecStart="/opt/bun/bin/bun" "/home/test/llm/src/cli.ts" "proxy" "run"');

  expect(ctx.commands).toStrictEqual([
    ['systemctl', '--user', 'daemon-reload'],
    ['systemctl', '--user', 'enable', '--now', 'llm-proxy.service'],
  ]);
});

test('it fails install with the systemctl message when systemctl fails', async () => {
  const ctx = await setupTest({ failOn: 'enable' });
  const result = await ctx.run(['proxy', 'install']);

  expect(result.errorMessage).toBe('systemctl --user enable --now llm-proxy.service failed: boom');
});

test('it disables the service and removes the unit with uninstall', async () => {
  const ctx = await setupTest();

  await ctx.run(['proxy', 'install']);

  ctx.commands.length = 0;

  const result = await ctx.run(['proxy', 'uninstall']);

  expect(result.exitCode).toBe(0);

  const unitExists = await Bun.file(ctx.unitPath).exists();

  expect(unitExists).toBeFalse();

  expect(ctx.commands).toStrictEqual([
    ['systemctl', '--user', 'disable', '--now', 'llm-proxy.service'],
    ['systemctl', '--user', 'daemon-reload'],
  ]);
});

test('it does nothing on uninstall when the unit is not installed', async () => {
  const ctx = await setupTest();

  await ctx.run(['proxy', 'uninstall']);

  expect(ctx.commands).toStrictEqual([]);
  expect(ctx.printed[0]).toContain('is not installed');
});

test('it prints the unit state and probes /health through the proxy with status', async () => {
  // the proxy's real port: the kit's network lets a loopback request through to a real server
  const proxy = startStubServer(() => new Response('OK'));
  const port = Number(new URL(proxy.url).port);

  const ctx = await setupTest(
    { stdoutByVerb: { 'is-active': 'active\n', 'is-enabled': 'enabled\n' } },
    port,
  );

  await ctx.run(['proxy', 'status']);

  expect(ctx.printed).toStrictEqual([
    [
      'unit       active (enabled)',
      `URL        http://127.0.0.1:${port}`,
      'health     ok, llama-swap answers through the proxy',
    ].join('\n'),
  ]);
});

test('it reports no answer when the proxy is down', async () => {
  // a claimed port that nothing listens on
  const ctx = await setupTest({}, claimFreePorts(1).take());

  await ctx.run(['proxy', 'status']);

  expect(ctx.printed[0]).toContain('health     no answer through the proxy');
});

test('it rejects an action it does not know', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['proxy', 'restart']);

  expect(result.errorMessage).toBe(
    'name what the proxy should do: run, install, uninstall, status',
  );
});
