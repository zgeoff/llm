import { z } from 'zod';

const runningEntrySchema = z.object({ model: z.string(), state: z.string() });
const runningSchema = z.object({ running: z.array(runningEntrySchema) });

// llama-swap lists the models it has loaded at GET /running.
export async function readRunningModels(baseURL: string): Promise<string[]> {
  const response = await fetch(`${baseURL}/running`, { signal: AbortSignal.timeout(2000) });
  const json: unknown = await response.json();

  const body = runningSchema.parse(json);

  return body.running.map((entry) => `${entry.model} (${entry.state})`);
}
