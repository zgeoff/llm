import { parse } from 'yaml';
import { catalogSchema } from './catalog-schema.ts';
import type { Catalog } from './types.ts';

export type CatalogParseResult =
  | { readonly success: true; readonly catalog: Catalog }
  | { readonly success: false; readonly issues: readonly string[] };

export function parseCatalog(text: string): CatalogParseResult {
  let document: unknown;

  // Bun.YAML.parse keeps the last of two equal mapping keys without a warning. The yaml library
  // throws on a duplicate key however it is written, so a repeated model id fails here.
  try {
    document = parse(text);
  } catch (error) {
    return { success: false, issues: [`not valid YAML: ${errorMessage(error)}`] };
  }

  const parsed = catalogSchema.safeParse(document);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || 'catalog'}: ${issue.message}`,
    );

    return { success: false, issues };
  }

  return { success: true, catalog: parsed.data };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
