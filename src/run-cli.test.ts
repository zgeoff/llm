import { expect, test } from 'bun:test';
import { runCLI } from './run-cli.ts';
import { buildCLIDependencies } from './testing/build-cli-dependencies.ts';

function setupTest() {
  const printed: string[] = [];

  return {
    printed,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}

test('it lists the commands for --help', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['--help']);

  expect(result.exitCode).toBe(0);
  expect(ctx.printed[0]).toMatch(/ls .*\n/u);
  expect(ctx.printed[0]).toContain('disk');
  expect(ctx.printed[0]).toContain('config');
});

test('it asks for a command when none is given and exits 1', async () => {
  const ctx = setupTest();

  const result = await ctx.run([]);

  expect(result).toStrictEqual({
    exitCode: 1,
    errorMessage: 'name a command, or pass --help to list them',
  });
});

test('it exits 1 with the message of a command that fails', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['ls']);

  expect(result).toStrictEqual({
    exitCode: 1,
    errorMessage: 'cannot find the catalog at /nonexistent/models.yaml',
  });
});
