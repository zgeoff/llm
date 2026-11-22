import type { z } from 'zod';
import type { catalogSchema } from './catalog-schema.ts';

export type Catalog = z.infer<typeof catalogSchema>;

export type Machine = Catalog['machine'];

export type Model = Catalog['models'][string];
