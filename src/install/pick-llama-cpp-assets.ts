import { CLIError } from '../cli-error.ts';
import type { GitHubAsset, GitHubRelease } from './read-github-release.ts';

const oldestSafeBuild = 7824;

// Builds older than b7824 carry CVE-2026-33298.
export function pickLlamaCppAssets(release: GitHubRelease): {
  readonly vulkan: GitHubAsset;
  readonly rocm: GitHubAsset;
} {
  const build = /^b(?<number>\d+)$/u.exec(release.tag)?.groups?.['number'];

  if (build === undefined || Number(build) < oldestSafeBuild) {
    throw new CLIError(
      `llama.cpp ${release.tag} is older than b${oldestSafeBuild}, which has a known CVE`,
    );
  }

  return {
    vulkan: findAsset(release, `llama-${release.tag}-bin-win-vulkan-x64.zip`),
    rocm: findAsset(release, `llama-${release.tag}-bin-win-rocm-10.0-x64.zip`),
  };
}

export function pickLlamaSwapAsset(release: GitHubRelease): GitHubAsset {
  const asset = release.assets.find((candidate) => candidate.name.endsWith('windows_amd64.zip'));

  if (asset === undefined) {
    throw new CLIError(`llama-swap ${release.tag} has no windows_amd64 zip`);
  }

  return asset;
}

function findAsset(release: GitHubRelease, name: string): GitHubAsset {
  const asset = release.assets.find((candidate) => candidate.name === name);

  if (asset === undefined) {
    throw new CLIError(`llama.cpp ${release.tag} has no asset named ${name}`);
  }

  return asset;
}
