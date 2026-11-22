import { z } from 'zod';

export const profileMarkerKey = 'LLM_PROFILE_AGENT';
const agentSchema = z.looseObject({ env: z.looseObject({ [profileMarkerKey]: z.literal('1') }) });

export function isProfileAgent(agent: unknown): boolean {
  return agentSchema.safeParse(agent).success;
}
