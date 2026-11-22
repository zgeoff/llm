import { CLIError } from '../cli-error.ts';
import { parseCatalog } from './parse-catalog.ts';
import type { Catalog } from './types.ts';

export async function readCatalog(catalogPath: string): Promise<Catalog> {
  const file = Bun.file(catalogPath);

  if (!(await file.exists())) {
    throw new CLIError(`cannot find the catalog at ${catalogPath}`);
  }

  const text = await file.text();

  const result = parseCatalog(text);

  if (!result.success) {
    throw new CLIError(
      [
        `${catalogPath} is not a valid catalog:`,
        ...result.issues.map((issue) => `  ${issue}`),
      ].join('\n'),
    );
  }

  return result.catalog;
}
