import { z } from 'zod';

const benchRowSchema = z.looseObject({
  model_id: z.string(),
  backend: z.string(),
  n_prompt: z.number(),
  n_gen: z.number(),
  n_depth: z.number().default(0),
  avg_ts: z.number(),
});

const ttftRowSchema = z.looseObject({
  model_id: z.string(),
  backend: z.string(),
  run: z.string(),
  phase: z.enum(['cold', 'warm']),
  ttft_ms: z.number(),
  tok_s: z.number().nullable(),
});

export type BenchResult = z.infer<typeof benchRowSchema>;

export type TTFTResult = z.infer<typeof ttftRowSchema>;

export type ResultRow =
  | { readonly kind: 'bench'; readonly row: BenchResult }
  | { readonly kind: 'ttft'; readonly row: TTFTResult };

// The lines of one results file. A line that is neither a bench row nor a ttft row, such as a
// row from before the rows carried a model id, is skipped.
export function parseResultRows(text: string): ResultRow[] {
  return text.split('\n').flatMap((line): ResultRow[] => {
    if (!line.startsWith('{')) {
      return [];
    }

    try {
      const json: unknown = JSON.parse(line);
      const ttft = ttftRowSchema.safeParse(json);

      if (ttft.success) {
        return [{ kind: 'ttft', row: ttft.data }];
      }

      const bench = benchRowSchema.safeParse(json);

      return bench.success ? [{ kind: 'bench', row: bench.data }] : [];
    } catch {
      return [];
    }
  });
}
