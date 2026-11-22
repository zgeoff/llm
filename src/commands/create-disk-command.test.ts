import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildModel } from '../testing/build-model.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-disk-'));

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

test('it prints the drive usage and the size of each model folder', async () => {
  const ctx = await setupTest();

  const models = join(ctx.root, 'mnt', 'd', 'models');

  const catalog = buildCatalog({
    models: {
      'present-model': buildModel({ repo: 'org-a/present-GGUF' }),
      'absent-model': buildModel({ repo: 'org-b/absent-GGUF' }),
    },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await Bun.write(join(models, 'org-a', 'present-GGUF', 'model.gguf'), 'x'.repeat(1500));
  await Bun.write(join(models, 'org-a', 'present-GGUF', 'model.gguf.sha256'), 'x'.repeat(500));

  const result = await ctx.run(['disk']);

  expect(result.exitCode).toBe(0);
  expect(ctx.printed[0]).toMatch(/^Drive D: .+ used, .+ free of .+\n\nFOLDER {14}SIZE\n/u);

  expect(ctx.printed[0]).toEndWith(
    ['org-a/present-GGUF  2.0 KB', 'org-b/absent-GGUF   -'].join('\n'),
  );
});

test('it lists a folder once when two models share a repo', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: {
      'quant-four': buildModel({ repo: 'org-a/shared-GGUF', file: 'q4.gguf' }),
      'quant-two': buildModel({ repo: 'org-a/shared-GGUF', file: 'q2.gguf' }),
    },
  });

  const folder = join(ctx.root, 'mnt', 'd', 'models', 'org-a', 'shared-GGUF');

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await Bun.write(join(folder, 'q4.gguf'), 'x');
  await ctx.run(['disk']);

  expect(ctx.printed[0]?.match(/org-a\/shared-GGUF/gu)).toHaveLength(1);
});

test('it reports a drive that is not mounted and exits 1', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({ models: { 'any-model': buildModel() } });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));

  const result = await ctx.run(['disk']);

  expect(result.exitCode).toBe(1);
  expect(result.errorMessage).toContain('cannot read the space of drive D:');
});
