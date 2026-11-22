import type { Catalog } from '../catalog/types.ts';
import { buildModel } from './build-model.ts';

export function buildCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    machine: {
      modelsDir: String.raw`D:\models`,
      binDir: String.raw`C:\llm\bin`,
      rocmLibDir: String.raw`C:\llm\rocm\bin`,
      devices: { vulkan: 'Vulkan0', rocm: 'ROCm1' },
      llamaSwap: {
        listen: '0.0.0.0:8181',
        configPath: String.raw`C:\llm\llama-swap.yaml`,
        logPath: String.raw`C:\llm\logs\llama-swap.log`,
        startPort: 10_001,
        globalTTL: 900,
      },
      proxy: { port: 8182 },
    },
    models: { 'example-model': buildModel() },
    ...overrides,
  };
}
