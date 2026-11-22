import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModel } from '../testing/build-model.ts';
import { collectModelFiles } from './collect-model-files.ts';

test('it lists the weights alone for a model with no projector', () => {
  const catalog = buildCatalog();

  expect(collectModelFiles(catalog.machine, buildModel())).toStrictEqual([
    {
      kind: 'model',
      fileName: 'example-model-Q4_K_M.gguf',
      path: String.raw`D:\models\example-org\example-model-GGUF\example-model-Q4_K_M.gguf`,
    },
  ]);
});

test('it lists the projector after the weights, in the same folder', () => {
  const catalog = buildCatalog();

  expect(
    collectModelFiles(catalog.machine, buildModel({ mmproj: 'mmproj-F16.gguf' })),
  ).toHaveLength(2);

  expect(
    collectModelFiles(catalog.machine, buildModel({ mmproj: 'mmproj-F16.gguf' }))[1],
  ).toStrictEqual({
    kind: 'projector',
    fileName: 'mmproj-F16.gguf',
    path: String.raw`D:\models\example-org\example-model-GGUF\mmproj-F16.gguf`,
  });
});
