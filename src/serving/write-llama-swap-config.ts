import type { Catalog } from '../catalog/types.ts';
import { buildLlamaSwapConfig } from '../llama-swap/build-llama-swap-config.ts';
import { formatLlamaSwapConfig } from '../llama-swap/format-llama-swap-config.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

// The config is small text, so it goes through /mnt; model bytes never do. Returns the text.
export async function writeLlamaSwapConfig(catalog: Catalog, mountRoot: string): Promise<string> {
  const text = formatLlamaSwapConfig(buildLlamaSwapConfig(catalog));

  await Bun.write(toWSLPath(catalog.machine.llamaSwap.configPath, mountRoot), text);

  return text;
}
