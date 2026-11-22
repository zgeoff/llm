import type { Catalog } from '../catalog/types.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { readWindowsHostIP } from '../windows/read-windows-host-ip.ts';
import { buildLlamaSwapURL } from './build-llama-swap-url.ts';

export async function readLlamaSwapURL(
  catalog: Catalog,
  dependencies: CLIDependencies,
): Promise<string> {
  const hostIP = await readWindowsHostIP(dependencies.readDefaultRoute);

  return buildLlamaSwapURL(catalog.machine, hostIP);
}
