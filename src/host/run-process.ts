import type { ProcessResult } from '../windows/types.ts';

export async function runProcess(command: readonly string[]): Promise<ProcessResult> {
  const child = Bun.spawn([...command], { stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });

  const [stdout, stderr, exitCode] = await Promise.all([
    child.stdout.text(),
    child.stderr.text(),
    child.exited,
  ]);

  return { exitCode, stdout, stderr };
}
