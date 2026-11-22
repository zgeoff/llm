import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildGGUFBytes } from '../testing/build-gguf-bytes.ts';
import { buildModel } from '../testing/build-model.ts';
import { network } from '../testing/network.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-inspect-'));

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

test('it prints the GGUF metadata and the KV cache cost of the model', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  await Bun.write(
    join(ctx.folder, 'example-model-Q4_K_M.gguf'),
    buildGGUFBytes([
      { key: 'general.architecture', value: { type: 'string', value: 'qwen3' } },
      { key: 'qwen3.block_count', value: { type: 'uint32', value: 64 } },
      { key: 'qwen3.attention.head_count', value: { type: 'uint32', value: 24 } },
      { key: 'qwen3.attention.head_count_kv', value: { type: 'uint32', value: 4 } },
      { key: 'qwen3.attention.key_length', value: { type: 'uint32', value: 256 } },
      { key: 'qwen3.attention.value_length', value: { type: 'uint32', value: 256 } },
      { key: 'qwen3.context_length', value: { type: 'uint32', value: 262_144 } },
      { key: 'tokenizer.chat_template', value: { type: 'string', value: '{{ messages }}' } },
    ]),
  );

  const result = await ctx.run(['inspect', 'example-model']);

  expect(result.errorMessage).toBeNull();
  expect(ctx.printed).toHaveLength(1);
  expect(ctx.printed[0]).toContain('example-model: example-org/example-model-GGUF/');
  expect(ctx.printed[0]).toContain('Architecture: qwen3');
  expect(ctx.printed[0]).toContain('Blocks: 64');
  expect(ctx.printed[0]).toContain('KV cache per 1k tokens:');

  expect(ctx.printed[0]).toContain(
    'Chat template: 14 characters; the catalog sets no upstream repo to compare it with',
  );
});

test('it reports a chat template that differs from the upstream repo', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'example-model': buildModel({ upstream: 'example-org/example-model' }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));

  await Bun.write(
    join(ctx.folder, 'example-model-Q4_K_M.gguf'),
    buildGGUFBytes([
      { key: 'general.architecture', value: { type: 'string', value: 'qwen3' } },
      { key: 'qwen3.block_count', value: { type: 'uint32', value: 64 } },
      { key: 'qwen3.attention.head_count', value: { type: 'uint32', value: 24 } },
      { key: 'qwen3.attention.head_count_kv', value: { type: 'uint32', value: 4 } },
      { key: 'qwen3.attention.key_length', value: { type: 'uint32', value: 256 } },
      { key: 'qwen3.attention.value_length', value: { type: 'uint32', value: 256 } },
      { key: 'qwen3.context_length', value: { type: 'uint32', value: 262_144 } },
      { key: 'tokenizer.chat_template', value: { type: 'string', value: '{{ patched }}' } },
    ]),
  );

  network.use(
    http.get(
      'https://huggingface.co/example-org/example-model/raw/main/chat_template.jinja',
      () => new HttpResponse('{{ original }}'),
    ),
  );

  await ctx.run(['inspect', 'example-model']);

  expect(ctx.printed[0]).toContain('differs from upstream');
  expect(ctx.printed[0]).toContain('{{ original }}');
  expect(ctx.printed[0]).toContain('{{ patched }}');
});

test('it reports a chat template that matches the upstream repo', async () => {
  const ctx = await setupTest();

  const catalog = buildCatalog({
    models: { 'example-model': buildModel({ upstream: 'example-org/example-model' }) },
  });

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(catalog));

  await Bun.write(
    join(ctx.folder, 'example-model-Q4_K_M.gguf'),
    buildGGUFBytes([
      { key: 'general.architecture', value: { type: 'string', value: 'qwen3' } },
      { key: 'qwen3.block_count', value: { type: 'uint32', value: 64 } },
      { key: 'qwen3.attention.head_count', value: { type: 'uint32', value: 24 } },
      { key: 'qwen3.attention.head_count_kv', value: { type: 'uint32', value: 4 } },
      { key: 'qwen3.attention.key_length', value: { type: 'uint32', value: 256 } },
      { key: 'qwen3.attention.value_length', value: { type: 'uint32', value: 256 } },
      { key: 'qwen3.context_length', value: { type: 'uint32', value: 262_144 } },
      { key: 'tokenizer.chat_template', value: { type: 'string', value: '{{ messages }}' } },
    ]),
  );

  network.use(
    http.get(
      'https://huggingface.co/example-org/example-model/raw/main/chat_template.jinja',
      () => new HttpResponse('{{ messages }}\n'),
    ),
  );

  await ctx.run(['inspect', 'example-model']);

  expect(ctx.printed[0]).toContain('template matches upstream');
});

test('it asks for llm pull when the model is not on disk', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const result = await ctx.run(['inspect', 'example-model']);

  expect(result.errorMessage).toContain('run llm pull example-model');
});

test('it rejects a file that is not a GGUF file', async () => {
  const ctx = await setupTest();

  await Bun.write(join(ctx.root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));
  await Bun.write(join(ctx.folder, 'example-model-Q4_K_M.gguf'), 'this is not a gguf file');

  const result = await ctx.run(['inspect', 'example-model']);

  expect(result.errorMessage).toContain('example-model-Q4_K_M.gguf');
});
