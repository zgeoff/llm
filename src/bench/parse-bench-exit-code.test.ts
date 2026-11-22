import { expect, test } from 'bun:test';
import { parseBenchExitCode } from './parse-bench-exit-code.ts';

test.each([
  ['a zero exit marker', '{"n_prompt":512}\nexit=0\n', 0],
  ['a non-zero exit marker', 'error: out of memory\r\nexit=1\r\n', 1],
  ['no marker', '{"n_prompt":512}', null],
])('it reads %s', (_label, output, expected) => {
  expect(parseBenchExitCode(output)).toBe(expected);
});
