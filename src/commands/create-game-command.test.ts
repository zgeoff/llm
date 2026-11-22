import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { buildGameStatePath } from '../game/build-game-state-path.ts';
import { readGameState } from '../game/read-game-state.ts';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { network } from '../testing/network.ts';

async function setupTest(stopWorks = true) {
  const root = await mkdtemp(join(tmpdir(), 'llm-game-'));

  const printed: string[] = [];
  const unloads: string[] = [];
  const powerShell = buildFakePowerShell();

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const baseURL = 'http://172.28.80.1:8181';
  const statePath = buildGameStatePath(join(root, 'home'));

  // llama-swap answers until the fake PowerShell is asked to stop it.
  const serving = { isUp: false };

  network.use(
    http.get(`${baseURL}/health`, () =>
      serving.isUp ? new HttpResponse('OK') : HttpResponse.error(),
    ),
    http.post(`${baseURL}/api/models/unload`, () => {
      unloads.push('all');

      return new HttpResponse('OK');
    }),
  );

  return {
    printed,
    unloads,
    powerShell,
    serving,
    statePath,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          mountRoot: join(root, 'mnt'),
          homeDir: join(root, 'home'),
          print: (text) => {
            printed.push(text);
          },
          runPowerShell: (script) => {
            if (script.includes('Stop-Process') && stopWorks) {
              serving.isUp = false;
            }

            if (script.includes('Win32_Process')) {
              serving.isUp = true;
            }

            return powerShell.run(script);
          },
        }),
      ),
  };
}

test('it unloads, stops llama-swap and records that serving was up', async () => {
  const ctx = await setupTest();

  ctx.serving.isUp = true;

  const result = await ctx.run(['game', 'on']);

  expect(result.exitCode).toBe(0);
  expect(ctx.unloads).toStrictEqual(['all']);

  expect(
    ctx.powerShell.scripts.some((script) => script.includes('Stop-Process -Force')),
  ).toBeTrue();

  const state = await readGameState(ctx.statePath);

  expect(state).toMatchObject({ servingWasUp: true });
});

test('it records that serving was down and does not contact llama-swap to unload', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['game', 'on']);

  expect(result.exitCode).toBe(0);
  expect(ctx.unloads).toStrictEqual([]);

  const state = await readGameState(ctx.statePath);

  expect(state).toMatchObject({ servingWasUp: false });
});

test('it keeps the serving-was-up record when game on runs twice', async () => {
  const ctx = await setupTest();

  ctx.serving.isUp = true;

  await ctx.run(['game', 'on']);
  await ctx.run(['game', 'on']);

  const state = await readGameState(ctx.statePath);

  expect(state).toMatchObject({ servingWasUp: true });
});

test('it starts llama-swap on game off when serving was up, and clears the state', async () => {
  const ctx = await setupTest();

  ctx.serving.isUp = true;

  await ctx.run(['game', 'on']);

  const result = await ctx.run(['game', 'off']);

  expect(result.exitCode).toBe(0);
  expect(ctx.powerShell.scripts.some((script) => script.includes('Win32_Process'))).toBeTrue();
  expect(ctx.serving.isUp).toBeTrue();

  const state = await readGameState(ctx.statePath);

  expect(state).toBeNull();
});

test('it leaves llama-swap stopped on game off when serving was down', async () => {
  const ctx = await setupTest();

  await ctx.run(['game', 'on']);
  await ctx.run(['game', 'off']);

  expect(ctx.powerShell.scripts.some((script) => script.includes('Win32_Process'))).toBeFalse();

  const state = await readGameState(ctx.statePath);

  expect(state).toBeNull();
});

test('it does nothing on game off when game mode was not on', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['game', 'off']);

  expect(result.exitCode).toBe(0);
  expect(ctx.printed).toStrictEqual(['game mode is not on; nothing to restore']);
  expect(ctx.powerShell.scripts).toStrictEqual([]);
});

test('it fails when llama-swap still answers after the stop', async () => {
  const ctx = await setupTest(false);

  ctx.serving.isUp = true;

  const result = await ctx.run(['game', 'on']);

  expect(result.exitCode).toBe(1);
  expect(result.errorMessage).toContain('still answers');
});

test('it rejects an action that is neither on nor off', async () => {
  const ctx = await setupTest();
  const result = await ctx.run(['game', 'maybe']);

  expect(result.errorMessage).toBe('name the game mode to set: on or off');
});
