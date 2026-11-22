import { expect, test } from 'bun:test';
import { buildModel } from './build-model.ts';

test('it builds a model with the defaults', () => {
  expect(buildModel()).toStrictEqual({
    repo: 'example-org/example-model-GGUF',
    file: 'example-model-Q4_K_M.gguf',
    tags: ['coding'],
    backend: 'vulkan',
    ctx: 8192,
    kvCache: 'f16',
  });
});

test('it overrides a field and keeps the others', () => {
  expect(buildModel({ backend: 'rocm' }).backend).toBe('rocm');
  expect(buildModel({ backend: 'rocm' }).ctx).toBe(8192);
});
