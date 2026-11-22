import { define } from 'gunshi';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { writeLlamaSwapConfig } from '../serving/write-llama-swap-config.ts';

export function createConfigCommand(dependencies: CLIDependencies) {
  return define({
    name: 'config',
    description: 'Write the llama-swap config generated from the catalog to the Windows host',
    args: {
      print: { type: 'boolean', description: 'Also print the generated config' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);
      const text = await writeLlamaSwapConfig(catalog, dependencies.mountRoot);

      const output =
        ctx.values.print === true ? text : `wrote ${catalog.machine.llamaSwap.configPath}`;

      dependencies.print(output);
    },
  });
}
