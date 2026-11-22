import { define } from 'gunshi';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { readReachableLlamaSwapURL } from '../serving/read-reachable-llama-swap-url.ts';
import { unloadModels } from '../serving/unload-models.ts';

export function createUnloadCommand(dependencies: CLIDependencies) {
  return define({
    name: 'unload',
    description: 'Unload one model from llama-swap, or every model when no id is given',
    args: {
      id: { type: 'positional', required: false, description: 'The model id from models.yaml' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const id = ctx.values.id ?? null;

      if (id !== null) {
        getModel(catalog, id);
      }

      const url = await readReachableLlamaSwapURL(catalog, dependencies);

      await unloadModels(url, id);

      const message = id === null ? 'every model is unloaded' : `${id} is unloaded`;

      dependencies.print(message);
    },
  });
}
