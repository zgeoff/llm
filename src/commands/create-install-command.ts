import { join, win32 } from 'node:path';
import { define } from 'gunshi';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { buildInstallScript } from '../install/build-install-script.ts';
import { pickLlamaCppAssets, pickLlamaSwapAsset } from '../install/pick-llama-cpp-assets.ts';
import { readGitHubRelease } from '../install/read-github-release.ts';
import type { GitHubAsset } from '../install/read-github-release.ts';
import { readReleaseChecksum } from '../install/read-release-checksum.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { quotePowerShellString } from '../windows/quote-powershell-string.ts';

export function createInstallCommand(dependencies: CLIDependencies) {
  return define({
    name: 'install',
    description:
      'Install llama.cpp (Vulkan and ROCm), llama-swap and the chat templates on Windows',
    args: {
      llamacpp: { type: 'string', description: 'A llama.cpp build such as b12038; default newest' },
      'llama-swap': { type: 'string', description: 'A llama-swap tag; default newest' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const binDir = catalog.machine.binDir;

      const llamaCpp = await readGitHubRelease('ggml-org/llama.cpp', ctx.values.llamacpp ?? null);

      const llamaSwap = await readGitHubRelease(
        'mostlygeek/llama-swap',
        ctx.values['llama-swap'] ?? null,
      );

      const llamaCppAssets = pickLlamaCppAssets(llamaCpp);
      const llamaSwapAsset = pickLlamaSwapAsset(llamaSwap);
      const installRoot = win32.dirname(binDir);
      const downloadsDir = joinWindowsPath(installRoot, 'downloads');

      const installs = [
        { asset: llamaCppAssets.vulkan, release: llamaCpp, folder: 'vulkan' },
        { asset: llamaCppAssets.rocm, release: llamaCpp, folder: 'rocm' },
        { asset: llamaSwapAsset, release: llamaSwap, folder: 'llama-swap' },
      ];

      for (const install of installs) {
        const sha256 = await readReleaseChecksum(install.release, install.asset);

        await runScript(
          dependencies,
          buildInstallScript({
            assetName: install.asset.name,
            url: install.asset.url,
            sha256,
            downloadsDir,
            destination: joinWindowsPath(binDir, install.folder),
            version: install.release.tag,
          }),
          install.asset,
        );
      }

      await copyTemplates(dependencies, joinWindowsPath(installRoot, 'templates'));
    },
  });
}

async function runScript(
  dependencies: CLIDependencies,
  script: string,
  asset: GitHubAsset,
): Promise<void> {
  const result = await dependencies.runPowerShell(script);

  if (result.exitCode !== 0) {
    throw new CLIError(`cannot install ${asset.name}: ${result.stderr.trim()}`);
  }

  dependencies.print(result.stdout.trim());
}

// The templates are small text files, so they cross from the WSL share with Copy-Item. No model
// bytes are involved.
async function copyTemplates(dependencies: CLIDependencies, destination: string): Promise<void> {
  const source = await dependencies.readWindowsPath(join(dependencies.repoRoot, 'templates'));

  const result = await dependencies.runPowerShell(
    [
      "$ErrorActionPreference = 'Stop'",
      `New-Item -ItemType Directory -Force -Path ${quotePowerShellString(destination)} | Out-Null`,
      `Copy-Item -Path (Join-Path ${quotePowerShellString(source)} '*') -Destination ${quotePowerShellString(destination)} -Recurse -Force`,
      `Write-Output ${quotePowerShellString(`copied the chat templates to ${destination}`)}`,
    ].join('\n'),
  );

  if (result.exitCode !== 0) {
    throw new CLIError(`cannot copy the chat templates: ${result.stderr.trim()}`);
  }

  dependencies.print(result.stdout.trim());
}
