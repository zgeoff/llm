import { expect, test } from 'bun:test';
import { isProfileAgent } from './is-profile-agent.ts';

test('it accepts an agent that carries the profile marker', () => {
  expect(isProfileAgent({ env: { LLM_PROFILE_AGENT: '1' } })).toBeTrue();
});

test('it accepts a marked agent whatever its baseURL, so a changed proxy port keeps it removable', () => {
  expect(
    isProfileAgent({ baseURL: 'http://127.0.0.1:9999', env: { LLM_PROFILE_AGENT: '1' } }),
  ).toBeTrue();
});

test('it refuses a hand-made agent that points at the proxy', () => {
  expect(
    isProfileAgent({
      baseURL: 'http://127.0.0.1:8182',
      env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'x' },
    }),
  ).toBeFalse();
});

test('it refuses an agent with no env', () => {
  expect(isProfileAgent({ kind: 'claude' })).toBeFalse();
});

test('it refuses a missing agent', () => {
  expect(isProfileAgent(undefined)).toBeFalse();
});
