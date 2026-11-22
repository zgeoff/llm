import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('it lists the commands for --help', async () => {
  const cliPath = fileURLToPath(new URL('cli.ts', import.meta.url));
  const child = Bun.spawn(['bun', cliPath, '--help'], { stdout: 'pipe', stderr: 'pipe' });

  const [stdout, stderr, exitCode] = await Promise.all([
    child.stdout.text(),
    child.stderr.text(),
    child.exited,
  ]);

  expect(stderr).toBe('');
  expect(exitCode).toBe(0);
  expect(stdout).toContain('bench');
  expect(stdout).toContain('install');
});

test('it exits 1 and names the problem when no command is given', async () => {
  const cliPath = fileURLToPath(new URL('cli.ts', import.meta.url));
  const child = Bun.spawn(['bun', cliPath], { stdout: 'pipe', stderr: 'pipe' });

  const [stderr, exitCode] = await Promise.all([child.stderr.text(), child.exited]);

  expect(stderr).toBe('llm: name a command, or pass --help to list them\n');
  expect(exitCode).toBe(1);
});
