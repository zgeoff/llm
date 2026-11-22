import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildFakePowerShell } from '../testing/build-fake-powershell.ts';
import { network } from '../testing/network.ts';

async function setupTest(powerShellAnswers: Parameters<typeof buildFakePowerShell>[0] = []) {
  const root = await mkdtemp(join(tmpdir(), 'llm-install-'));

  const printed: string[] = [];
  const powerShell = buildFakePowerShell(powerShellAnswers);

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(buildCatalog()));

  const downloadHost = 'https://example.test';
  const llamaCppReleases = 'https://api.github.com/repos/ggml-org/llama.cpp/releases';

  const asset = (name: string) => ({
    name,
    browser_download_url: `${downloadHost}/${name}`,
    digest: `sha256:${name.length.toString(16).padStart(64, '0')}`,
  });

  const serveReleases = (build: string) => {
    network.use(
      http.get(llamaCppReleases, () =>
        HttpResponse.json([
          {
            tag_name: build,
            assets: [
              asset(`llama-${build}-bin-win-vulkan-x64.zip`),
              asset(`llama-${build}-bin-win-rocm-10.0-x64.zip`),
            ],
          },
        ]),
      ),
      http.get(`${llamaCppReleases}/tags/${build}`, () =>
        HttpResponse.json({
          tag_name: build,
          assets: [
            asset(`llama-${build}-bin-win-vulkan-x64.zip`),
            asset(`llama-${build}-bin-win-rocm-10.0-x64.zip`),
          ],
        }),
      ),
      http.get('https://api.github.com/repos/mostlygeek/llama-swap/releases', () =>
        HttpResponse.json([
          { tag_name: 'v200', assets: [asset('llama-swap_200_windows_amd64.zip')] },
        ]),
      ),
    );
  };

  return {
    serveReleases,
    printed,
    powerShell,
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          repoRoot: '/home/test/llm',
          print: (text) => {
            printed.push(text);
          },
          runPowerShell: powerShell.run,
        }),
      ),
  };
}

test('it installs both llama.cpp builds, llama-swap and the templates', async () => {
  const ctx = await setupTest();

  ctx.serveReleases('b9000');

  const result = await ctx.run(['install']);

  expect(result.exitCode).toBe(0);
  expect(ctx.powerShell.scripts).toHaveLength(4);
  expect(ctx.powerShell.scripts[0]).toContain(String.raw`$dest = 'C:\llm\bin\vulkan'`);
  expect(ctx.powerShell.scripts[1]).toContain(String.raw`$dest = 'C:\llm\bin\rocm'`);
  expect(ctx.powerShell.scripts[2]).toContain(String.raw`$dest = 'C:\llm\bin\llama-swap'`);
});

test('it copies the repo templates folder to the templates folder on Windows', async () => {
  const ctx = await setupTest();

  ctx.serveReleases('b9000');

  await ctx.run(['install']);

  expect(ctx.powerShell.scripts[3]).toContain(
    String.raw`Copy-Item -Path (Join-Path '\\wsl.localhost\Test\home\test\llm\templates' '*') -Destination 'C:\llm\templates'`,
  );
});

test('it installs the build that --llamacpp names', async () => {
  const ctx = await setupTest();

  ctx.serveReleases('b9100');

  await ctx.run(['install', '--llamacpp', 'b9100']);

  expect(ctx.powerShell.scripts[0]).toContain('llama-b9100-bin-win-vulkan-x64.zip');
});

test('it refuses a build older than b7824 and installs nothing', async () => {
  const ctx = await setupTest();

  ctx.serveReleases('b7000');

  const result = await ctx.run(['install']);

  expect(result.errorMessage).toContain('older than b7824');
  expect(ctx.powerShell.scripts).toStrictEqual([]);
});

test('it reports an install that PowerShell fails', async () => {
  const ctx = await setupTest([
    { whenScriptIncludes: 'curl.exe', result: { exitCode: 1, stderr: 'SHA256 mismatch' } },
  ]);

  ctx.serveReleases('b9000');

  const result = await ctx.run(['install']);

  expect(result.errorMessage).toBe(
    'cannot install llama-b9000-bin-win-vulkan-x64.zip: SHA256 mismatch',
  );
});
