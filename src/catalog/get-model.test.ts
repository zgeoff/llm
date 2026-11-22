import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModel } from '../testing/build-model.ts';
import { getModel } from './get-model.ts';

test('it returns the model with the id', () => {
  const model = buildModel({ ctx: 4096 });

  expect(getModel(buildCatalog({ models: { 'first-model': model } }), 'first-model')).toBe(model);
});

test('it names the known ids when the id is not in the catalog', () => {
  const catalog = buildCatalog({
    models: { 'first-model': buildModel(), 'second-model': buildModel() },
  });

  expect(() => getModel(catalog, 'third-model')).toThrow(
    'no model "third-model" in the catalog; the ids are first-model, second-model',
  );
});

test('it does not treat an inherited property name as a model id', () => {
  expect(() => getModel(buildCatalog(), 'toString')).toThrow('no model "toString"');
});
