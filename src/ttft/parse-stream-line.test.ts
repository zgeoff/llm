import { expect, test } from 'bun:test';
import { parseStreamLine } from './parse-stream-line.ts';

test('it reads generated text from a content delta', () => {
  expect(parseStreamLine('data: {"choices":[{"delta":{"content":"Hi"}}]}')).toStrictEqual({
    hasText: true,
    completionTokens: null,
    errorMessage: null,
  });
});

test('it counts reasoning text as generated text', () => {
  expect(
    parseStreamLine('data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}')?.hasText,
  ).toBeTrue();
});

test('it reports no text for a role-only delta and an empty content', () => {
  expect(
    parseStreamLine('data: {"choices":[{"delta":{"role":"assistant","content":""}}]}')?.hasText,
  ).toBeFalse();
});

test('it reads the completion token count from the usage chunk', () => {
  expect(
    parseStreamLine('data: {"choices":[],"usage":{"completion_tokens":42,"prompt_tokens":9}}'),
  ).toStrictEqual({ hasText: false, completionTokens: 42, errorMessage: null });
});

test('it returns null for a blank line, [DONE] and a comment', () => {
  expect([
    parseStreamLine(''),
    parseStreamLine('data: [DONE]'),
    parseStreamLine(': ping'),
  ]).toStrictEqual([null, null, null]);
});

test('it reports a server error chunk as an error message', () => {
  expect(parseStreamLine('data: {"error":{"message":"out of memory","code":500}}')).toStrictEqual({
    hasText: false,
    completionTokens: null,
    errorMessage: '{"message":"out of memory","code":500}',
  });
});
