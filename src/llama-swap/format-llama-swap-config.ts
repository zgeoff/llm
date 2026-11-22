import type { LlamaSwapConfig } from './build-llama-swap-config.ts';

export function formatLlamaSwapConfig(config: LlamaSwapConfig): string {
  return Bun.YAML.stringify(config, null, 2);
}
