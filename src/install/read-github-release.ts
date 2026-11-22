import { z } from 'zod';
import { CLIError } from '../cli-error.ts';

export interface GitHubAsset {
  readonly name: string;
  readonly url: string;

  // The SHA256 GitHub computed for the asset, when it has one.
  readonly sha256: string | null;
}

export interface GitHubRelease {
  readonly tag: string;
  readonly assets: readonly GitHubAsset[];
}

const assetSchema = z.object({
  name: z.string(),
  browser_download_url: z.string(),
  digest: z.string().nullish(),
});

const releaseSchema = z.object({ tag_name: z.string(), assets: z.array(assetSchema) });
const releaseListSchema = z.array(releaseSchema);

// A tag reads one release. Without one, the newest release that has assets: the newest llama.cpp
// release can still be uploading its builds.
export async function readGitHubRelease(repo: string, tag: string | null): Promise<GitHubRelease> {
  const path = tag === null ? 'releases?per_page=5' : `releases/tags/${tag}`;

  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: { accept: 'application/vnd.github+json' },
  });

  if (!response.ok) {
    throw new CLIError(`GitHub answered ${response.status} for ${repo} ${tag ?? 'releases'}`);
  }

  const body: unknown = await response.json();

  const releases = tag === null ? releaseListSchema.parse(body) : [releaseSchema.parse(body)];
  const release = releases.find((candidate) => candidate.assets.length > 0);

  if (release === undefined) {
    throw new CLIError(`${repo} has no release with assets`);
  }

  return {
    tag: release.tag_name,
    assets: release.assets.map((asset) => ({
      name: asset.name,
      url: asset.browser_download_url,
      sha256: asset.digest?.replace(/^sha256:/u, '') ?? null,
    })),
  };
}
