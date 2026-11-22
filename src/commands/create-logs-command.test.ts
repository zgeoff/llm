import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';

async function setupTest(powerShellAnswers: Parameters<typeof buildFakePowerShell>[0] = []) {
  const root = await mkdtemp(join(tmpdir(), 'llm-serving-'));

  const printed: string[] = [];
  const powerShell = buildFakePowerShell(powerShellAnswers);

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const baseURL = 'http://172.28.80.1:8181';

  return {
    baseURL,
    root,
    printed,
    powerShell,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          mountRoot: join(root, 'mnt'),
          print: (text) => {
            printed.push(text);
          },
          runPowerShell: powerShell.run,
        }),
      ),
  };
}

test('it prints the last lines of the log with logs -n', async () => {
  const ctx = await setupTest();

  await Bun.write(
    join(ctx.root, 'mnt', 'c', 'llm', 'logs', 'llama-swap.log'),
    'one\r\ntwo\r\nthree\r\nfour\r\n',
  );

  await ctx.run(['logs', '-n', '2']);

  expect(ctx.printed).toStrictEqual(['three\nfour']);
});

test('it asks for llm up when the log does not exist', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['logs']);

  expect(result.errorMessage).toContain('run llm up first');
});

test('it rejects a line count below one', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['logs', '-n', '0']);

  expect(result.errorMessage).toContain('-n takes a whole number');
});
