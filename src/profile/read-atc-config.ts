import { z } from 'zod';
import { CLIError } from '../cli-error.ts';

const atcConfigSchema = z.looseObject({
  agents: z.record(z.string(), z.unknown()).default({}),
});

export type ATCConfig = z.infer<typeof atcConfigSchema>;

export async function readATCConfig(configPath: string): Promise<ATCConfig> {
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    throw new CLIError(`no atc config at ${configPath}`);
  }

  const text = await file.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CLIError(`${configPath} is not valid JSON`);
  }

  const result = atcConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new CLIError(`${configPath} has no usable "agents" object`);
  }

  return result.data;
}
