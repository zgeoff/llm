import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runClockUntil } from '@zgeoff/testing/clock';
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
    run: async (argv: readonly string[]) => {
      const dependencies = buildCLIDependencies({
        catalogPath: join(root, 'models.yaml'),
        mountRoot: join(root, 'mnt'),
        print: (text) => {
          printed.push(text);
        },
        runPowerShell: powerShell.run,
      });

      // the health poll sleeps on the fake clock between real requests
      const state = { isSettled: false };

      const work = (async () => {
        try {
          return await runCLI(argv, dependencies);
        } finally {
          state.isSettled = true;
        }
      })();

      await runClockUntil(dependencies.clock, () => state.isSettled, { maxMs: 600_000 });

      return work;
    },
  };
}

test('it starts llama-swap detached and reports the URL once /health answers', async () => {
  const ctx = await setupTest();

  const answers = [false, false, true];

  network.use(
    http.get(`${ctx.baseURL}/health`, () =>
      answers.shift() === true ? new HttpResponse('OK') : HttpResponse.error(),
    ),
  );

  const result = await ctx.run(['up']);
  const config = await Bun.file(join(ctx.root, 'mnt', 'c', 'llm', 'llama-swap.yaml')).text();

  expect(result.exitCode).toBe(0);
  expect(config).toContain('example-model');
  expect(ctx.powerShell.scripts).toHaveLength(1);

  expect(ctx.powerShell.scripts[0]).toContain(
    String.raw`"C:\llm\bin\llama-swap\llama-swap.exe" --config "C:\llm\llama-swap.yaml" --listen 0.0.0.0:8181 > "C:\llm\logs\llama-swap.log" 2>&1`,
  );

  expect(ctx.printed).toStrictEqual([`llama-swap is ready at ${ctx.baseURL}`]);
});

test('it starts nothing when llama-swap already answers', async () => {
  const ctx = await setupTest();

  network.use(http.get(`${ctx.baseURL}/health`, () => new HttpResponse('OK')));

  await ctx.run(['up']);

  expect(ctx.powerShell.scripts).toStrictEqual([]);
  expect(ctx.printed[0]).toContain('already running');
});

test('it prints the firewall command when only Windows reaches llama-swap', async () => {
  const ctx = await setupTest([
    { whenScriptIncludes: '127.0.0.1', result: { stdout: '200' } },
    {
      whenScriptIncludes: 'Get-NetAdapter',
      result: { stdout: 'vEthernet (WSL (Hyper-V firewall))\n' },
    },
  ]);

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  const result = await ctx.run(['up']);

  expect(result.exitCode).toBe(1);
  expect(result.errorMessage).toContain('-Action Allow -InterfaceAlias');
  expect(result.errorMessage).toContain("'vEthernet (WSL (Hyper-V firewall))' -Profile Any");

  expect(
    ctx.powerShell.scripts.filter((script) => script.includes('New-NetFirewallRule')),
  ).toStrictEqual([]);
});

test('it points at the log when llama-swap answers nowhere', async () => {
  const ctx = await setupTest();

  network.use(http.get(`${ctx.baseURL}/health`, () => HttpResponse.error()));

  const result = await ctx.run(['up']);

  expect(result.errorMessage).toBe(
    `llama-swap did not answer at ${ctx.baseURL}/health; run llm logs to see why`,
  );
});
