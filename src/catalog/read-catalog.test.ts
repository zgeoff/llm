import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLIError } from '../cli-error.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { readCatalog } from './read-catalog.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-catalog-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return { root };
}

test('it reads and parses a catalog file', async () => {
  const ctx = await setupTest();

  const path = join(ctx.root, 'models.yaml');

  await Bun.write(path, Bun.YAML.stringify(buildCatalog({ models: {} })));

  const catalog = await readCatalog(path);

  expect(catalog.machine.modelsDir).toBe(String.raw`D:\models`);
});

test('it rejects a catalog file that does not exist', async () => {
  const ctx = await setupTest();

  const path = join(ctx.root, 'missing.yaml');

  expect(readCatalog(path)).rejects.toThrowWithMessage(
    CLIError,
    `cannot find the catalog at ${path}`,
  );
});

test('it rejects an invalid catalog with the issue and its path', async () => {
  const ctx = await setupTest();

  const path = join(ctx.root, 'models.yaml');

  await Bun.write(path, 'machine: {}\nmodels: {}\n');

  expect(readCatalog(path)).rejects.toThrowWithMessage(CLIError, /machine\.modelsDir/u);
});
