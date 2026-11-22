import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModelFolderPath } from './build-model-folder-path.ts';

test('it joins the models directory, the owner and the repo name', () => {
  const catalog = buildCatalog();

  expect(buildModelFolderPath(catalog.machine, { repo: 'unsloth/Qwen3.8-27B-GGUF' })).toBe(
    String.raw`D:\models\unsloth\Qwen3.8-27B-GGUF`,
  );
});
