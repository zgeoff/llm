import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { buildModel } from '../testing/build-model.ts';
import { network } from '../testing/network.ts';

async function setupTest(powerShellAnswers: Parameters<typeof buildFakePowerShell>[0] = []) {
  const root = await mkdtemp(join(tmpdir(), 'llm-pull-'));

  const printed: string[] = [];
  const powerShell = buildFakePowerShell(powerShellAnswers);

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, 'mnt', 'd'), { recursive: true });

  const treeURL = 'https://huggingface.co/api/models/example-org/example-model-GGUF/tree/main';

  const serveTree = (sizes: Record<string, number>) => {
    network.use(
      http.get(treeURL, () =>
        HttpResponse.json(
          Object.entries(sizes).map(([path, size]) => ({
            type: 'file',
            path,
            size,
            lfs: { oid: `${path.length}`.padStart(64, 'c'), size },
          })),
        ),
      ),
    );
  };

  return {
    serveTree,
    root,
    printed,
    powerShell,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          mountRoot: join(root, 'mnt'),
          print: (text) => {
            printed.push(text);
          },
          runPowerShell: powerShell.run,
        }),
      ),
  };
}

test('it downloads the model and its projector through PowerShell', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'vision-model': buildModel({ file: 'vision.gguf', mmproj: 'proj.gguf' }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));

  ctx.serveTree({ 'vision.gguf': 1000, 'proj.gguf': 500 });

  const result = await ctx.run(['pull', 'vision-model', '--mmproj']);

  expect(result.exitCode).toBe(0);
  expect(ctx.powerShell.scripts).toHaveLength(2);
  expect(ctx.powerShell.scripts[0]).toContain('resolve/main/vision.gguf');
  expect(ctx.powerShell.scripts[1]).toContain('resolve/main/proj.gguf');
});

test('it leaves the projector out unless --mmproj is set', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'vision-model': buildModel({ file: 'vision.gguf', mmproj: 'proj.gguf' }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));

  ctx.serveTree({ 'vision.gguf': 1000, 'proj.gguf': 500 });

  await ctx.run(['pull', 'vision-model']);

  expect(ctx.powerShell.scripts).toHaveLength(1);
});

test('it refuses a pull that leaves less than 5 GB free', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  ctx.serveTree({ 'example-model-Q4_K_M.gguf': 10 ** 15 });

  const result = await ctx.run(['pull', 'example-model']);

  expect(result.errorMessage).toContain('the pull needs');
  expect(ctx.powerShell.scripts).toStrictEqual([]);
});

test('it reports a download that PowerShell fails', async () => {
  const ctx = await setupTest([
    { whenScriptIncludes: 'curl.exe', result: { exitCode: 1, stderr: 'SHA256 mismatch' } },
  ]);

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  ctx.serveTree({ 'example-model-Q4_K_M.gguf': 1000 });

  const result = await ctx.run(['pull', 'example-model']);

  expect(result.errorMessage).toBe('pulling example-model-Q4_K_M.gguf failed: SHA256 mismatch');
});

test('it rejects an id that is not in the catalog', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const result = await ctx.run(['pull', 'nope']);

  expect(result.errorMessage).toContain('no model "nope"');
});
