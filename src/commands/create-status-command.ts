import { define } from 'gunshi';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { buildLlamaSwapURL } from '../serving/build-llama-swap-url.ts';
import { probeLlamaSwap } from '../serving/probe-llama-swap.ts';
import { readRunningModels } from '../serving/read-running-models.ts';
import { readWindowsHostIP } from '../windows/read-windows-host-ip.ts';

export function createStatusCommand(dependencies: CLIDependencies) {
  return define({
    name: 'status',
    description:
      'Show where llama-swap listens, whether WSL reaches it and which models are loaded',
    run: async () => {
      const catalog = await readCatalog(dependencies.catalogPath);
      const hostIP = await readWindowsHostIP(dependencies.readDefaultRoute);

      const url = buildLlamaSwapURL(catalog.machine, hostIP);

      if (!(await probeLlamaSwap(url))) {
        dependencies.print([`URL        ${url}`, 'reachable  no', 'loaded     -'].join('\n'));

        return;
      }

      const running = await readRunningModels(url);

      dependencies.print(
        [`URL        ${url}`, 'reachable  yes', `loaded     ${running.join(', ') || '-'}`].join(
          '\n',
        ),
      );
    },
  });
}
