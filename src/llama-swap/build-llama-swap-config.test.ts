import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModel } from '../testing/build-model.ts';
import { buildLlamaSwapConfig } from './build-llama-swap-config.ts';

test('it carries the start port and the global TTL from the machine block', () => {
  const config = buildLlamaSwapConfig(buildCatalog({ models: {} }));

  expect(config).toStrictEqual({ startPort: 10_001, globalTTL: 900, models: {} });
});

test('it builds the command of a Vulkan model that fits in VRAM', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: {
        'gpt-oss-20b': buildModel({
          repo: 'ggml-org/gpt-oss-20b-GGUF',
          file: 'gpt-oss-20b-MXFP4.gguf',
          ctx: 32_768,
        }),
      },
    }),
  );

  expect(config.models['gpt-oss-20b']).toStrictEqual({
    cmd: [
      String.raw`"C:\llm\bin\vulkan\llama-server.exe"`,
      `--port \${PORT}`,
      '--host 127.0.0.1',
      String.raw`-m "D:\models\ggml-org\gpt-oss-20b-GGUF\gpt-oss-20b-MXFP4.gguf"`,
      '--device Vulkan0 -ngl 99 -fa on --jinja -np 1 -c 32768',
    ].join(' '),
    disableKeepAlives: true,
  });
});

test('it gives a ROCm model its device, its library path and --n-cpu-moe', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: { 'moe-model': buildModel({ backend: 'rocm', nCpuMoe: 20 }) },
    }),
  );

  expect(config.models['moe-model']).toStrictEqual({
    cmd: [
      String.raw`"C:\llm\bin\rocm\llama-server.exe"`,
      `--port \${PORT}`,
      '--host 127.0.0.1',
      String.raw`-m "D:\models\example-org\example-model-GGUF\example-model-Q4_K_M.gguf"`,
      '--device ROCm1 -ngl 99 -fa on --jinja -np 1 -c 8192 --n-cpu-moe 20',
    ].join(' '),
    env: [String.raw`PATH=C:\llm\rocm\bin;C:\Windows\System32;C:\Windows`],
    disableKeepAlives: true,
  });
});

test('it sets no environment for a Vulkan model', () => {
  const config = buildLlamaSwapConfig(buildCatalog());

  expect(config.models['example-model']?.env).toBeUndefined();
});

test('it keeps --n-cpu-moe 0 when the catalog sets it to zero', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({ models: { 'moe-model': buildModel({ nCpuMoe: 0 }) } }),
  );

  expect(config.models['moe-model']?.cmd).toContain('--n-cpu-moe 0');
});

test('it leaves --n-cpu-moe out when the catalog sets none', () => {
  const config = buildLlamaSwapConfig(buildCatalog());

  expect(config.models['example-model']?.cmd).not.toContain('--n-cpu-moe');
});

test('it adds both cache type flags for a q8_0 KV cache', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({ models: { 'small-kv': buildModel({ kvCache: 'q8_0' }) } }),
  );

  expect(config.models['small-kv']?.cmd).toEndWith('-c 8192 -ctk q8_0 -ctv q8_0');
});

test('it adds no cache type flag for an f16 KV cache', () => {
  const config = buildLlamaSwapConfig(buildCatalog());

  expect(config.models['example-model']?.cmd).not.toContain('-ctk');
});

test('it points --mmproj at the file in the model folder', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({ models: { 'vision-model': buildModel({ mmproj: 'mmproj-F16.gguf' }) } }),
  );

  expect(config.models['vision-model']?.cmd).toEndWith(
    String.raw`--mmproj "D:\models\example-org\example-model-GGUF\mmproj-F16.gguf"`,
  );
});

test('it points --chat-template-file at the template path of the catalog', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: {
        'patched-template': buildModel({
          chatTemplateFile: String.raw`C:\llm\templates\system-anywhere.jinja`,
          samplers: { temperature: 0.6 },
        }),
      },
    }),
  );

  expect(config.models['patched-template']?.cmd).toEndWith(
    String.raw`-c 8192 --chat-template-file "C:\llm\templates\system-anywhere.jinja" --temp 0.6`,
  );
});

test('it leaves --chat-template-file out when the catalog sets no template', () => {
  const config = buildLlamaSwapConfig(buildCatalog());

  expect(config.models['example-model']?.cmd).not.toContain('--chat-template-file');
});

test('it passes the samplers as flags, then the extra arguments', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: {
        'tuned-model': buildModel({
          samplers: { temperature: 0.6, top_p: 0.95, top_k: 20 },
          extraArgs: ['--no-warmup', '--chat-template-kwargs', '{"enable_thinking":false}'],
        }),
      },
    }),
  );

  expect(config.models['tuned-model']?.cmd).toEndWith(
    String.raw`-c 8192 --temp 0.6 --top-p 0.95 --top-k 20 --no-warmup --chat-template-kwargs "{\"enable_thinking\":false}"`,
  );
});

test('it quotes an extra argument that is empty, has spaces or holds quotes', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: {
        'quoted-args': buildModel({
          extraArgs: ['--alias', 'two words', '', String.raw`my "dir\"`],
        }),
      },
    }),
  );

  expect(config.models['quoted-args']?.cmd).toEndWith(
    String.raw`--alias "two words" "" "my \"dir\\\""`,
  );
});

test('it sets the TTL of a model that overrides the global one', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({ models: { 'short-lived': buildModel({ ttl: 60 }) } }),
  );

  expect(config.models['short-lived']?.ttl).toBe(60);
});

test('it leaves the TTL out of a model that uses the global one', () => {
  const config = buildLlamaSwapConfig(buildCatalog());

  expect(config.models['example-model']).not.toHaveProperty('ttl');
});

test('it builds one entry for each catalog model', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({ models: { 'first-model': buildModel(), 'second-model': buildModel() } }),
  );

  expect(Object.keys(config.models)).toStrictEqual(['first-model', 'second-model']);
});

test('it is deterministic', () => {
  const catalog = buildCatalog();

  expect(buildLlamaSwapConfig(catalog)).toStrictEqual(buildLlamaSwapConfig(catalog));
});

test('it quotes an extra argument that holds a backslash, so a trailing one survives', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: {
        'slot-model': buildModel({
          extraArgs: ['--slot-save-path', 'D:\\slots\\'],
        }),
      },
    }),
  );

  expect(config.models['slot-model']?.cmd).toEndWith(String.raw`--slot-save-path "D:\slots\\"`);
});
