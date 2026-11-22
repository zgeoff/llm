import type { Catalog } from '../catalog/types.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { probeLlamaSwap } from './probe-llama-swap.ts';
import { readLlamaSwapURL } from './read-llama-swap-url.ts';

// For a command that talks to llama-swap and never starts it.
export async function readReachableLlamaSwapURL(
  catalog: Catalog,
  dependencies: CLIDependencies,
): Promise<string> {
  const url = await readLlamaSwapURL(catalog, dependencies);

  if (!(await probeLlamaSwap(url))) {
    throw new CLIError(`llama-swap does not answer at ${url}; run llm up first`);
  }

  return url;
}
