import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildModel } from '../testing/build-model.ts';
import { buildLlamaSwapConfig } from './build-llama-swap-config.ts';
import { formatLlamaSwapConfig } from './format-llama-swap-config.ts';

test('it formats a config as YAML that parses back to the same config', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({
      models: {
        'moe-model': buildModel({ backend: 'rocm', nCpuMoe: 20, ttl: 60 }),
        'vulkan-model': buildModel({ kvCache: 'q8_0' }),
      },
    }),
  );

  expect(Bun.YAML.parse(formatLlamaSwapConfig(config))).toStrictEqual(config);
});

test('it keeps the backslashes of a Windows path through the YAML round trip', () => {
  const config = buildLlamaSwapConfig(
    buildCatalog({ models: { 'moe-model': buildModel({ backend: 'rocm' }) } }),
  );

  const parsed = Bun.YAML.parse(formatLlamaSwapConfig(config));

  expect(parsed).toHaveProperty(
    ['models', 'moe-model', 'env', '0'],
    String.raw`PATH=C:\llm\rocm\bin;C:\Windows\System32;C:\Windows`,
  );
});
