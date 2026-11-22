import { expect, test } from 'bun:test';
import { buildModel } from '../testing/build-model.ts';
import { buildATCAgent } from './build-atc-agent.ts';

test('it builds a Claude gateway agent for the model', () => {
  const agent = buildATCAgent({
    modelID: 'example-model',
    label: 'Example 9B (vision)',
    model: buildModel({ ctx: 65_536 }),
    proxyURL: 'http://127.0.0.1:8182',
    homeDir: '/home/example',
    settings: { outputStyle: 'terse' },
  });

  expect(agent).toStrictEqual({
    kind: 'claude',
    label: 'Example 9B (vision)',
    bin: '/home/example/.local/bin/claude-bare',
    args: ['--system-prompt', ''],
    baseURL: 'http://127.0.0.1:8182',
    apiKeyHelper: 'echo local',
    settings: { outputStyle: 'terse' },
    env: {
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'example-model',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'example-model',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'example-model',
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: '65536',
      CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
      CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS: '1',
      API_TIMEOUT_MS: '1800000',
      LLM_PROFILE_AGENT: '1',
    },
  });
});

test('it omits settings when there are none to copy', () => {
  const agent = buildATCAgent({
    modelID: 'example-model',
    label: 'Example 9B (vision)',
    model: buildModel(),
    proxyURL: 'http://127.0.0.1:8182',
    homeDir: '/home/example',
    settings: undefined,
  });

  expect(agent).not.toHaveProperty('settings');
});
