import { rm } from 'node:fs/promises';
import { define } from 'gunshi';
import { match } from 'ts-pattern';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { buildGameStatePath } from '../game/build-game-state-path.ts';
import { readGameState } from '../game/read-game-state.ts';
import { writeGameState } from '../game/write-game-state.ts';
import { probeLlamaSwap } from '../serving/probe-llama-swap.ts';
import { readLlamaSwapURL } from '../serving/read-llama-swap-url.ts';
import { startLlamaSwap } from '../serving/start-llama-swap.ts';
import { stopLlamaSwap } from '../serving/stop-llama-swap.ts';
import { unloadModels } from '../serving/unload-models.ts';

const actions = ['on', 'off'] as const;

export function createGameCommand(dependencies: CLIDependencies) {
  return define({
    name: 'game',
    description: 'Free the GPU for a game (on), then restore serving afterwards (off)',
    args: {
      action: { type: 'positional', description: `One of ${actions.join(', ')}` },
    },
    run: async (ctx) => {
      const action = actions.find((candidate) => candidate === ctx.values.action);

      if (action === undefined) {
        throw new CLIError(`name the game mode to set: ${actions.join(' or ')}`);
      }

      await match(action)
        .with('on', () => turnGameModeOn(dependencies))
        .with('off', () => turnGameModeOff(dependencies))
        .exhaustive();
    },
  });
}

async function turnGameModeOn(dependencies: CLIDependencies): Promise<void> {
  const catalog = await readCatalog(dependencies.catalogPath);
  const url = await readLlamaSwapURL(catalog, dependencies);

  const statePath = buildGameStatePath(dependencies.homeDir);

  const previous = await readGameState(statePath);
  const isServing = await probeLlamaSwap(url);

  // A second `game on` while serving is down must not forget that serving was up before the first.
  await writeGameState(statePath, {
    servingWasUp: isServing || previous?.servingWasUp === true,
    startedAt: new Date(dependencies.clock.now()).toISOString(),
  });

  if (isServing) {
    try {
      await unloadModels(url, null);
    } catch (error) {
      // The stop below ends every model anyway.
      dependencies.print(
        `could not unload through llama-swap, stopping it instead: ${String(error)}`,
      );
    }
  }

  await stopLlamaSwap(dependencies.runPowerShell);

  const isStillServing = await probeLlamaSwap(url);

  if (isStillServing) {
    throw new CLIError(`llama-swap still answers at ${url} after it was stopped`);
  }

  dependencies.print('game mode is on: no model is loaded, and llama-swap is stopped');
}

async function turnGameModeOff(dependencies: CLIDependencies): Promise<void> {
  const statePath = buildGameStatePath(dependencies.homeDir);

  const state = await readGameState(statePath);

  if (state === null) {
    dependencies.print('game mode is not on; nothing to restore');

    return;
  }

  if (state.servingWasUp) {
    const catalog = await readCatalog(dependencies.catalogPath);
    const started = await startLlamaSwap(catalog, dependencies);

    dependencies.print(`game mode is off: llama-swap is ready at ${started.url}`);
  } else {
    dependencies.print('game mode is off: serving was not up before, so llama-swap stays stopped');
  }

  await rm(statePath);
}
