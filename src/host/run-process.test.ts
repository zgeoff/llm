import { expect, test } from 'bun:test';
import { runProcess } from './run-process.ts';

test('it collects the output and the exit code of a process', async () => {
  const result = await runProcess(['sh', '-c', 'printf out; printf err >&2; exit 4']);

  expect(result).toStrictEqual({ exitCode: 4, stdout: 'out', stderr: 'err' });
});
