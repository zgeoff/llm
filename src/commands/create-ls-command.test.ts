import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildModel } from '../testing/build-model.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-ls-'));

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

test('it lists each catalog model with its size and checksum state', async () => {
  const ctx = await setupTest();

  const folder = join(ctx.root, 'mnt', 'd', 'models', 'example-org', 'example-model-GGUF');

  const catalog = buildCatalog({
    models: {
      'checked-model': buildModel({ file: 'checked.gguf', tags: ['coding', 'moe'] }),
      'unchecked-model': buildModel({ file: 'unchecked.gguf', backend: 'rocm', tags: [] }),
    },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await Bun.write(join(folder, 'checked.gguf'), 'x'.repeat(1500));
  await Bun.write(join(folder, 'checked.gguf.sha256'), `${'a'.repeat(64)}\n`);
  await Bun.write(join(folder, 'unchecked.gguf'), 'x'.repeat(2_000_000));

  const result = await ctx.run(['ls']);

  expect(result.exitCode).toBe(0);

  expect(ctx.printed).toStrictEqual([
    [
      'ID               TAGS        BACKEND  SIZE    SHA CHECKED',
      'checked-model    coding,moe  vulkan   1.5 KB  yes',
      'unchecked-model  -           rocm     2.0 MB  -',
    ].join('\n'),
  ]);
});

test('it shows a dash for a model that is not on disk', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({ models: { 'absent-model': buildModel() } });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await ctx.run(['ls']);

  expect(ctx.printed).toStrictEqual([
    [
      'ID            TAGS    BACKEND  SIZE  SHA CHECKED',
      'absent-model  coding  vulkan   -     -',
    ].join('\n'),
  ]);
});

test('it reports a catalog that does not parse and exits 1', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), 'machine: {}\nmodels: {}\n');

  const result = await ctx.run(['ls']);

  expect(result.exitCode).toBe(1);
  expect(result.errorMessage).toContain('machine.modelsDir');
});

test('it counts the projector in the size and needs its checksum too', async () => {
  const ctx = await setupTest();

  const folder = join(ctx.root, 'mnt', 'd', 'models', 'example-org', 'example-model-GGUF');

  const catalog = buildCatalog({
    models: {
      'vision-model': buildModel({ file: 'vision.gguf', mmproj: 'proj.gguf' }),
      'half-checked': buildModel({ file: 'half.gguf', mmproj: 'half-proj.gguf' }),
      'no-projector-yet': buildModel({ file: 'early.gguf', mmproj: 'early-proj.gguf' }),
    },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await Bun.write(join(folder, 'vision.gguf'), 'x'.repeat(1000));
  await Bun.write(join(folder, 'vision.gguf.sha256'), `${'a'.repeat(64)}\n`);
  await Bun.write(join(folder, 'proj.gguf'), 'x'.repeat(500));
  await Bun.write(join(folder, 'proj.gguf.sha256'), `${'b'.repeat(64)}\n`);
  await Bun.write(join(folder, 'half.gguf'), 'x'.repeat(1000));
  await Bun.write(join(folder, 'half.gguf.sha256'), `${'a'.repeat(64)}\n`);
  await Bun.write(join(folder, 'half-proj.gguf'), 'x'.repeat(500));
  await Bun.write(join(folder, 'early.gguf'), 'x'.repeat(1000));
  await ctx.run(['ls']);

  expect(ctx.printed).toStrictEqual([
    [
      'ID                TAGS    BACKEND  SIZE    SHA CHECKED',
      'vision-model      coding  vulkan   1.5 KB  yes',
      'half-checked      coding  vulkan   1.5 KB  -',
      'no-projector-yet  coding  vulkan   -       -',
    ].join('\n'),
  ]);
});
