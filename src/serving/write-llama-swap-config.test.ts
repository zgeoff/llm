import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLlamaSwapConfig } from '../llama-swap/build-llama-swap-config.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { writeLlamaSwapConfig } from './write-llama-swap-config.ts';

test('it writes the generated config to the config path under the mount root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'llm-write-config-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const catalog = buildCatalog();

  const text = await writeLlamaSwapConfig(catalog, root);
  const written = await Bun.file(join(root, 'c', 'llm', 'llama-swap.yaml')).text();

  expect(written).toBe(text);
  expect(Bun.YAML.parse(written)).toStrictEqual(buildLlamaSwapConfig(catalog));
});
