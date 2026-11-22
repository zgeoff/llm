import { define } from 'gunshi';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { stopLlamaSwap } from '../serving/stop-llama-swap.ts';

export function createDownCommand(dependencies: CLIDependencies) {
  return define({
    name: 'down',
    description: 'Stop llama-swap and every llama-server',
    run: async () => {
      await stopLlamaSwap(dependencies.runPowerShell);

      dependencies.print('llama-swap and llama-server are stopped');
    },
  });
}
