import type { GitHubAsset, GitHubRelease } from './read-github-release.ts';

// The SHA256 of an asset from the release checksum file when one exists, else GitHub's own digest,
// else null.
export async function readReleaseChecksum(
  release: GitHubRelease,
  asset: GitHubAsset,
): Promise<string | null> {
  const checksumFile = release.assets.find((candidate) => /checksums?\.txt$/u.test(candidate.name));

  if (checksumFile === undefined) {
    return asset.sha256;
  }

  const response = await fetch(checksumFile.url);

  if (!response.ok) {
    return asset.sha256;
  }

  const text = await response.text();

  const line = text.split('\n').find((candidate) => candidate.trim().endsWith(asset.name));

  return line?.trim().split(/\s+/u)[0]?.toLowerCase() ?? asset.sha256;
}
