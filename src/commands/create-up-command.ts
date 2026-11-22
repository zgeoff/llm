import { define } from 'gunshi';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { startLlamaSwap } from '../serving/start-llama-swap.ts';

export function createUpCommand(dependencies: CLIDependencies) {
  return define({
    name: 'up',
    description: 'Regenerate the llama-swap config and start llama-swap on the Windows host',
    run: async () => {
      const catalog = await readCatalog(dependencies.catalogPath);
      const started = await startLlamaSwap(catalog, dependencies);

      const message = started.alreadyRunning
        ? `llama-swap is already running at ${started.url}; the config is written, and a restart loads it`
        : `llama-swap is ready at ${started.url}`;

      dependencies.print(message);
    },
  });
}
