import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModel } from '../testing/build-model.ts';
import { catalogSchema } from './catalog-schema.ts';
import type { Catalog } from './types.ts';

test('it accepts a complete catalog and returns it unchanged', () => {
  const payload: Catalog = {
    machine: {
      modelsDir: String.raw`D:\models`,
      binDir: String.raw`C:\llm\bin`,
      rocmLibDir: String.raw`C:\llm\rocm\bin`,
      devices: { vulkan: 'Vulkan0', rocm: 'ROCm1' },
      llamaSwap: {
        listen: '0.0.0.0:8181',
        configPath: String.raw`C:\llm\llama-swap.yaml`,
        logPath: String.raw`C:\llm\logs\llama-swap.log`,
        startPort: 10_001,
        globalTTL: 900,
      },
      proxy: { port: 8182 },
    },
    models: {
      'qwen3.6-35b-a3b': {
        name: 'Qwen3.6 35B',
        repo: 'unsloth/Qwen3.6-35B-A3B-MTP-GGUF',
        file: 'Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf',
        upstream: 'Qwen/Qwen3.6-35B-A3B',
        tags: ['coding', 'moe'],
        backend: 'rocm',
        ctx: 32_768,
        nCpuMoe: 20,
        kvCache: 'f16',
        mmproj: 'mmproj-F16.gguf',
        chatTemplateFile: String.raw`C:\llm\templates\system-anywhere.jinja`,
        samplers: { temperature: 0.6, top_p: 0.95 },
        extraArgs: ['--no-warmup'],
        ttl: 900,
      },
    },
  };

  expect(catalogSchema.safeParse(payload).data).toStrictEqual(payload);
});

test('it rejects an unknown key on a model', () => {
  const result = catalogSchema.safeParse({
    ...buildCatalog(),
    models: { 'example-model': { ...buildModel(), quant: 'Q4' } },
  });

  expect(result.error?.issues).toPartiallyContain({
    code: 'unrecognized_keys',
    path: ['models', 'example-model'],
  });
});

test('it rejects an unknown key in the machine block', () => {
  const catalog = buildCatalog();

  const result = catalogSchema.safeParse({
    ...catalog,
    machine: { ...catalog.machine, gpu: 'RX 9070 XT' },
  });

  expect(result.error?.issues).toPartiallyContain({ code: 'unrecognized_keys', path: ['machine'] });
});

test('it rejects a catalog with no proxy port', () => {
  const catalog = buildCatalog();
  const { proxy: _proxy, ...withoutProxy } = catalog.machine;
  const result = catalogSchema.safeParse({ ...catalog, machine: withoutProxy });

  expect(result.error?.issues).toPartiallyContain({ path: ['machine', 'proxy'] });
});

test('it rejects a proxy port above 65535', () => {
  const catalog = buildCatalog();

  const result = catalogSchema.safeParse({
    ...catalog,
    machine: { ...catalog.machine, proxy: { port: 70_000 } },
  });

  expect(result.error?.issues).toPartiallyContain({ path: ['machine', 'proxy', 'port'] });
});

test('it rejects a model id that is not kebab-case', () => {
  const result = catalogSchema.safeParse(buildCatalog({ models: { Example_Model: buildModel() } }));

  expect(result.error?.issues).toPartiallyContain({ path: ['models', 'Example_Model'] });
});

test('it accepts a model id with a dot inside a segment', () => {
  const result = catalogSchema.safeParse(buildCatalog({ models: { 'qwen3.6-35b': buildModel() } }));

  expect(result.success).toBeTrue();
});

test('it rejects an empty model name', () => {
  const result = catalogSchema.safeParse(
    buildCatalog({ models: { 'example-model': buildModel({ name: '' }) } }),
  );

  expect(result.error?.issues).toPartiallyContain({ path: ['models', 'example-model', 'name'] });
});

test('it rejects an nCpuMoe below zero', () => {
  const result = catalogSchema.safeParse(
    buildCatalog({ models: { 'example-model': buildModel({ nCpuMoe: -1 }) } }),
  );

  expect(result.error?.issues).toPartiallyContain({
    path: ['models', 'example-model', 'nCpuMoe'],
  });
});

test('it accepts an nCpuMoe of zero', () => {
  const result = catalogSchema.safeParse(
    buildCatalog({ models: { 'example-model': buildModel({ nCpuMoe: 0 }) } }),
  );

  expect(result.success).toBeTrue();
});

test('it rejects a backend other than vulkan or rocm', () => {
  const result = catalogSchema.safeParse({
    ...buildCatalog(),
    models: { 'example-model': { ...buildModel(), backend: 'cuda' } },
  });

  expect(result.error?.issues).toPartiallyContain({
    path: ['models', 'example-model', 'backend'],
  });
});

test('it rejects a models directory that is not an absolute Windows path', () => {
  const catalog = buildCatalog();

  const result = catalogSchema.safeParse({
    ...catalog,
    machine: { ...catalog.machine, modelsDir: '/mnt/d/models' },
  });

  expect(result.error?.issues).toPartiallyContain({ path: ['machine', 'modelsDir'] });
});

test('it rejects a model file with a folder in its name', () => {
  const result = catalogSchema.safeParse(
    buildCatalog({ models: { 'example-model': buildModel({ file: 'sub/model.gguf' }) } }),
  );

  expect(result.error?.issues).toPartiallyContain({ path: ['models', 'example-model', 'file'] });
});

test('it rejects a model file that climbs out of its folder', () => {
  const result = catalogSchema.safeParse(
    buildCatalog({ models: { 'example-model': buildModel({ file: '..' }) } }),
  );

  expect(result.error?.issues).toPartiallyContain({ path: ['models', 'example-model', 'file'] });
});

test.each(['../escape', 'owner/..', './owner'])(
  'it rejects the repo %s that climbs out of the models folder',
  (repo) => {
    const result = catalogSchema.safeParse(
      buildCatalog({ models: { 'example-model': buildModel({ repo }) } }),
    );

    expect(result.error?.issues).toPartiallyContain({ path: ['models', 'example-model', 'repo'] });
  },
);

test('it rejects a chat template file that is not an absolute Windows path', () => {
  const result = catalogSchema.safeParse(
    buildCatalog({
      models: { 'example-model': buildModel({ chatTemplateFile: 'templates/x.jinja' }) },
    }),
  );

  expect(result.error?.issues).toPartiallyContain({
    path: ['models', 'example-model', 'chatTemplateFile'],
  });
});
