import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLlamaSwapConfig } from '../llama-swap/build-llama-swap-config.ts';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildModel } from '../testing/build-model.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-config-'));

  const printed: string[] = [];

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return {
    root,
    printed,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          mountRoot: join(root, 'mnt'),
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}

test('it writes the generated config to the config path on the Windows drive', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'moe-model': buildModel({ backend: 'rocm', nCpuMoe: 20 }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));

  const result = await ctx.run(['config']);
  const written = await Bun.file(join(ctx.root, 'mnt', 'c', 'llm', 'llama-swap.yaml')).text();

  expect(result.exitCode).toBe(0);
  expect(Bun.YAML.parse(written)).toStrictEqual(buildLlamaSwapConfig(catalog));
  expect(ctx.printed).toStrictEqual([String.raw`wrote C:\llm\llama-swap.yaml`]);
});

test('it also prints the config with --print', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'moe-model': buildModel({ backend: 'rocm', nCpuMoe: 20 }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await ctx.run(['config', '--print']);

  expect(Bun.YAML.parse(ctx.printed[0] ?? '')).toStrictEqual(buildLlamaSwapConfig(catalog));
});
