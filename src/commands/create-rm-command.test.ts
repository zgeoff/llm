import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildModel } from '../testing/build-model.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-rm-'));

  const printed: string[] = [];
  const folder = join(root, 'mnt', 'd', 'models', 'example-org', 'example-model-GGUF');

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await mkdir(folder, { recursive: true });

  return {
    root,
    folder,
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

test('it keeps the files and asks for --yes when the deletion is not confirmed', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));
  await Bun.write(join(ctx.folder, 'example-model-Q4_K_M.gguf'), 'weights');

  const result = await ctx.run(['rm', 'example-model']);

  expect(result.errorMessage).toBe('pass --yes to delete example-model');

  const modelExists = await Bun.file(join(ctx.folder, 'example-model-Q4_K_M.gguf')).exists();

  expect(modelExists).toBe(true);
});

test('it deletes the model and its checksum sidecar when confirmed', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));
  await Bun.write(join(ctx.folder, 'example-model-Q4_K_M.gguf'), 'weights');
  await Bun.write(join(ctx.folder, 'example-model-Q4_K_M.gguf.sha256'), `${'a'.repeat(64)}\n`);

  const result = await ctx.run(['rm', 'example-model', '--yes']);

  expect(result.errorMessage).toBeNull();

  const modelExists = await Bun.file(join(ctx.folder, 'example-model-Q4_K_M.gguf')).exists();

  expect(modelExists).toBe(false);

  const sidecarExists = await Bun.file(
    join(ctx.folder, 'example-model-Q4_K_M.gguf.sha256'),
  ).exists();

  expect(sidecarExists).toBe(false);
  expect(ctx.printed.at(-1)).toBe('deleted example-model');
});

test('it deletes only the one model file and leaves its neighbours', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: {
      'first-model': buildModel({ file: 'first.gguf' }),
      'second-model': buildModel({ file: 'second.gguf', mmproj: 'proj.gguf' }),
    },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await Bun.write(join(ctx.folder, 'first.gguf'), 'one');
  await Bun.write(join(ctx.folder, 'second.gguf'), 'two');
  await Bun.write(join(ctx.folder, 'proj.gguf'), 'projector');
  await ctx.run(['rm', 'first-model', '--yes']);

  const firstExists = await Bun.file(join(ctx.folder, 'first.gguf')).exists();

  expect(firstExists).toBe(false);

  const secondExists = await Bun.file(join(ctx.folder, 'second.gguf')).exists();

  expect(secondExists).toBe(true);

  const projectorExists = await Bun.file(join(ctx.folder, 'proj.gguf')).exists();

  expect(projectorExists).toBe(true);
});

test('it refuses a catalog whose repo climbs out of the models folder', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'escape-model': buildModel({ repo: '../escape', file: 'victim.gguf' }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));
  await Bun.write(join(ctx.root, 'mnt', 'd', 'escape', 'victim.gguf'), 'precious');

  const result = await ctx.run(['rm', 'escape-model', '--yes']);

  expect(result.errorMessage).toContain('repo');

  const victimExists = await Bun.file(join(ctx.root, 'mnt', 'd', 'escape', 'victim.gguf')).exists();

  expect(victimExists).toBe(true);
});

test('it says so when the model is not on disk', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const result = await ctx.run(['rm', 'example-model', '--yes']);

  expect(result.errorMessage).toBeNull();

  expect(ctx.printed).toStrictEqual([
    String.raw`example-model is not on disk at D:\models\example-org\example-model-GGUF\example-model-Q4_K_M.gguf`,
  ]);
});
