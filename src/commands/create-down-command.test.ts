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

test('it stops llama-swap and llama-server with down', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['down']);

  expect(result.exitCode).toBe(0);
  expect(ctx.powerShell.scripts[0]).toContain('Stop-Process -Force');
});
