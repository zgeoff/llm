import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModelPath } from './build-model-path.ts';

test('it puts the model file in the folder of its repo', () => {
  const catalog = buildCatalog();

  expect(
    buildModelPath(catalog.machine, {
      repo: 'unsloth/Qwen3.8-27B-GGUF',
      file: 'Qwen3.8-27B-UD-Q3_K_XL.gguf',
    }),
  ).toBe(String.raw`D:\models\unsloth\Qwen3.8-27B-GGUF\Qwen3.8-27B-UD-Q3_K_XL.gguf`);
});
