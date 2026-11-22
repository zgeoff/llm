import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { network } from '../testing/network.ts';

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

test('it shows the URL, reachability and loaded models with status', async () => {
  const ctx = await setupTest();

  network.use(
    http.get(`${ctx.baseURL}/health`, () => new HttpResponse('OK')),
    http.get(`${ctx.baseURL}/running`, () =>
      HttpResponse.json({ running: [{ model: 'example-model', state: 'ready' }] }),
    ),
  );

  await ctx.run(['status']);

  expect(ctx.printed).toStrictEqual([
    [`URL        ${ctx.baseURL}`, 'reachable  yes', 'loaded     example-model (ready)'].join('\n'),
  ]);
});

test('it reports llama-swap as unreachable with status', async () => {
  const ctx = await setupTest();

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  await ctx.run(['status']);

  expect(ctx.printed).toStrictEqual([
    [`URL        ${ctx.baseURL}`, 'reachable  no', 'loaded     -'].join('\n'),
  ]);
});
