import { z } from 'zod';

const rowSchema = z.looseObject({
  n_prompt: z.number(),
  n_gen: z.number(),
  n_depth: z.number().default(0),
  avg_ts: z.number(),
});

export type BenchRow = z.infer<typeof rowSchema>;

// The rows are the output lines that start with `{`. Any other line is llama-bench's log.
export function parseBenchRows(output: string): BenchRow[] {
  return output
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      try {
        const row = rowSchema.safeParse(JSON.parse(line));

        return row.success ? [row.data] : [];
      } catch {
        return [];
      }
    });
}
