import { join } from 'node:path';
import type { Model } from '../catalog/types.ts';
import { profileMarkerKey } from './is-profile-agent.ts';

interface ATCAgentOptions {
  readonly modelID: string;
  readonly label: string;
  readonly model: Model;
  readonly proxyURL: string;

  // atc runs `bin` as given and never expands `~`, so the path is absolute.
  readonly homeDir: string;

  // The `settings` of the hand-made agent that this one copies, when the config has it.
  readonly settings: Readonly<Record<string, unknown>> | undefined;
}

export function buildATCAgent(options: ATCAgentOptions): Record<string, unknown> {
  return {
    kind: 'claude',
    label: options.label,
    bin: join(options.homeDir, '.local', 'bin', 'claude-bare'),
    args: ['--system-prompt', ''],
    baseURL: options.proxyURL,
    apiKeyHelper: 'echo local',
    ...(options.settings === undefined ? {} : { settings: options.settings }),
    env: {
      // llama-swap routes by model name, so every Claude tier asks for the catalog id.
      ANTHROPIC_DEFAULT_OPUS_MODEL: options.modelID,
      ANTHROPIC_DEFAULT_SONNET_MODEL: options.modelID,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: options.modelID,
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: String(options.model.ctx),
      CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
      CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS: '1',
      API_TIMEOUT_MS: '1800000',
      [profileMarkerKey]: '1',
    },
  };
}
