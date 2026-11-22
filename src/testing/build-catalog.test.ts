import { expect, test } from 'bun:test';
import { catalogSchema } from '../catalog/catalog-schema.ts';
import { buildCatalog } from './build-catalog.ts';
import { buildModel } from './build-model.ts';

test('it builds a catalog that the catalog schema accepts', () => {
  expect(catalogSchema.safeParse(buildCatalog()).success).toBeTrue();
});

test('it replaces the models when asked', () => {
  const catalog = buildCatalog({ models: { 'other-model': buildModel({ ctx: 4096 }) } });

  expect(Object.keys(catalog.models)).toStrictEqual(['other-model']);
});
