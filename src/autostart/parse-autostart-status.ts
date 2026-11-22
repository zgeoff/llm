import { z } from 'zod';

const statusSchema = z.discriminatedUnion('registered', [
  z.object({ registered: z.literal(false) }),
  z.object({
    registered: z.literal(true),
    state: z.string(),
    lastRunTime: z.string(),
    lastTaskResult: z.number(),
  }),
]);

export type AutostartStatus = z.infer<typeof statusSchema>;

export function parseAutostartStatus(output: string): AutostartStatus {
  return statusSchema.parse(JSON.parse(output.trim()));
}
