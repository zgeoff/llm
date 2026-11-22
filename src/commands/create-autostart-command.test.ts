import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { encodePowerShellScript } from '../windows/encode-powershell-script.ts';

// The fake machine: a task that the elevated register and unregister scripts create and delete.
async function setupTest(isRegistered: boolean, elevatedFails = false) {
  const root = await mkdtemp(join(tmpdir(), 'llm-autostart-'));

  const printed: string[] = [];
  const task = { isRegistered };

  const registered = JSON.stringify({
    registered: true,
    state: 'Ready',
    lastRunTime: 'never',
    lastTaskResult: 267_011,
  });

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const powerShell = buildFakePowerShell();

  return {
    printed,
    powerShell,
    root,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          mountRoot: join(root, 'mnt'),
          print: (text) => {
            printed.push(text);
          },
          runPowerShell: async (script) => {
            await powerShell.run(script);

            if (
              script === String.raw`[Environment]::UserDomainName + '\' + [Environment]::UserName`
            ) {
              return { exitCode: 0, stdout: String.raw`HOST\owner`, stderr: '' };
            }

            if (script.includes('-Verb RunAs')) {
              if (elevatedFails) {
                return { exitCode: 1, stdout: '', stderr: 'The operation was canceled' };
              }

              task.isRegistered = !script.includes(
                encodePowerShellScript(
                  "$ErrorActionPreference = 'Stop'\nUnregister-ScheduledTask -TaskName 'llm llama-swap' -Confirm:$false",
                ),
              );

              return { exitCode: 0, stdout: '', stderr: '' };
            }

            return {
              exitCode: 0,
              stdout: task.isRegistered ? registered : '{"registered":false}',
              stderr: '',
            };
          },
        }),
      ),
  };
}

test('it prints the task before the elevated registration, then confirms it', async () => {
  const ctx = await setupTest(false);
  const result = await ctx.run(['autostart', 'on']);

  expect(result.exitCode).toBe(0);
  expect(ctx.printed[0]).toContain('name     llm llama-swap');
  expect(ctx.printed[0]).toContain(String.raw`when HOST\owner logs on`);

  expect(ctx.printed[0]).toContain(
    String.raw`--config "C:\llm\llama-swap.yaml" --listen 0.0.0.0:8181`,
  );

  expect(ctx.printed.at(-1)).toContain('autostart is on: the task is Ready');
  expect(ctx.powerShell.scripts.filter((script) => script.includes('-Verb RunAs'))).toHaveLength(1);
});

test('it registers the task in the encoded elevated script', async () => {
  const ctx = await setupTest(false);

  await ctx.run(['autostart', 'on']);

  const elevated = ctx.powerShell.scripts.find((script) => script.includes('-Verb RunAs')) ?? '';
  const encoded = /'-EncodedCommand', '(?<script>[^']+)'/u.exec(elevated)?.groups?.['script'] ?? '';
  const inner = Buffer.from(encoded, 'base64').toString('utf16le');

  expect(inner).toContain("Register-ScheduledTask -TaskName 'llm llama-swap'");
  expect(inner).toContain(String.raw`New-ScheduledTaskTrigger -AtLogOn -User 'HOST\owner'`);
  expect(inner).toContain('-RunLevel Limited');
});

test('it writes the llama-swap config the task starts with', async () => {
  const ctx = await setupTest(false);

  await ctx.run(['autostart', 'on']);

  const exists = await Bun.file(join(ctx.root, 'mnt', 'c', 'llm', 'llama-swap.yaml')).exists();

  expect(exists).toBeTrue();
});

test('it fails when the elevated step does not finish', async () => {
  const ctx = await setupTest(false, true);
  const result = await ctx.run(['autostart', 'on']);

  expect(result.exitCode).toBe(1);
  expect(result.errorMessage).toContain('The operation was canceled');
});

test('it removes a registered task through one elevated step', async () => {
  const ctx = await setupTest(true);
  const result = await ctx.run(['autostart', 'off']);

  expect(result.exitCode).toBe(0);
  expect(ctx.printed.at(-1)).toBe('autostart is off: no Scheduled Task is registered');
  expect(ctx.powerShell.scripts.filter((script) => script.includes('-Verb RunAs'))).toHaveLength(1);
});

test('it asks for no elevation to remove a task that is not there', async () => {
  const ctx = await setupTest(false);

  await ctx.run(['autostart', 'off']);

  expect(ctx.powerShell.scripts.some((script) => script.includes('-Verb RunAs'))).toBeFalse();
});

test('it reports the task state with status', async () => {
  const ctx = await setupTest(true);

  await ctx.run(['autostart', 'status']);

  expect(ctx.printed).toStrictEqual([
    'autostart is on: the task is Ready\nlast run   never\nlast exit  267011',
  ]);
});

test('it rejects an action it does not know', async () => {
  const ctx = await setupTest(false);
  const result = await ctx.run(['autostart', 'later']);

  expect(result.errorMessage).toBe('name what autostart should do: on, off, status');
});
