import { define } from 'gunshi';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { loadModel } from '../serving/load-model.ts';
import { readReachableLlamaSwapURL } from '../serving/read-reachable-llama-swap-url.ts';

export function createLoadCommand(dependencies: CLIDependencies) {
  return define({
    name: 'load',
    description: 'Load a model in llama-swap, swapping out the one that runs',
    args: {
      id: { type: 'positional', description: 'The model id from models.yaml' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      getModel(catalog, ctx.values.id);

      const url = await readReachableLlamaSwapURL(catalog, dependencies);

      dependencies.print(`Loading ${ctx.values.id}`);

      await loadModel(url, ctx.values.id);

      dependencies.print(`${ctx.values.id} is loaded`);
    },
  });
}
