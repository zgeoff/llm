import type { Model } from '../catalog/types.ts';

export function buildModel(overrides: Partial<Model> = {}): Model {
  return {
    repo: 'example-org/example-model-GGUF',
    file: 'example-model-Q4_K_M.gguf',
    tags: ['coding'],
    backend: 'vulkan',
    ctx: 8192,
    kvCache: 'f16',
    ...overrides,
  };
}
