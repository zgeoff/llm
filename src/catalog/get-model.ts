import { CLIError } from '../cli-error.ts';
import type { Catalog, Model } from './types.ts';

export function getModel(catalog: Catalog, id: string): Model {
  const model = Object.hasOwn(catalog.models, id) ? catalog.models[id] : undefined;

  if (model === undefined) {
    throw new CLIError(
      `no model "${id}" in the catalog; the ids are ${Object.keys(catalog.models).join(', ')}`,
    );
  }

  return model;
}
