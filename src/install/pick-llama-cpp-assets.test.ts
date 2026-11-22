import { expect, test } from 'bun:test';
import { pickLlamaCppAssets, pickLlamaSwapAsset } from './pick-llama-cpp-assets.ts';

function setupTest() {
  const host = 'https://example.test';
  const buildAsset = (name: string) => ({ name, url: `${host}/${name}`, sha256: null });

  return { buildAsset };
}

test('it picks the Vulkan and ROCm Windows zips of the build', () => {
  const ctx = setupTest();

  const assets = pickLlamaCppAssets({
    tag: 'b9000',
    assets: [
      ctx.buildAsset('llama-b9000-bin-win-cpu-x64.zip'),
      ctx.buildAsset('llama-b9000-bin-win-vulkan-x64.zip'),
      ctx.buildAsset('llama-b9000-bin-win-rocm-10.0-x64.zip'),
    ],
  });

  expect([assets.vulkan.name, assets.rocm.name]).toStrictEqual([
    'llama-b9000-bin-win-vulkan-x64.zip',
    'llama-b9000-bin-win-rocm-10.0-x64.zip',
  ]);
});

test('it refuses a build older than b7824', () => {
  expect(() => pickLlamaCppAssets({ tag: 'b7823', assets: [] })).toThrow('older than b7824');
});

test('it accepts b7824 itself', () => {
  const ctx = setupTest();

  expect(() =>
    pickLlamaCppAssets({
      tag: 'b7824',
      assets: [
        ctx.buildAsset('llama-b7824-bin-win-vulkan-x64.zip'),
        ctx.buildAsset('llama-b7824-bin-win-rocm-10.0-x64.zip'),
      ],
    }),
  ).not.toThrow();
});

test('it rejects a build that lacks a backend zip', () => {
  const ctx = setupTest();

  expect(() =>
    pickLlamaCppAssets({
      tag: 'b9000',
      assets: [ctx.buildAsset('llama-b9000-bin-win-vulkan-x64.zip')],
    }),
  ).toThrow('has no asset named llama-b9000-bin-win-rocm-10.0-x64.zip');
});

test('it picks the llama-swap windows_amd64 zip', () => {
  const ctx = setupTest();

  const asset = pickLlamaSwapAsset({
    tag: 'v200',
    assets: [
      ctx.buildAsset('llama-swap_200_linux_amd64.tar.gz'),
      ctx.buildAsset('llama-swap_200_windows_amd64.zip'),
    ],
  });

  expect(asset.name).toBe('llama-swap_200_windows_amd64.zip');
});

test('it rejects a llama-swap release with no windows zip', () => {
  expect(() => pickLlamaSwapAsset({ tag: 'v200', assets: [] })).toThrow('no windows_amd64 zip');
});
