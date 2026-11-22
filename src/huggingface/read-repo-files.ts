import { z } from 'zod';
import { CLIError } from '../cli-error.ts';

interface RepoFile {
  readonly sizeBytes: number;
  readonly sha256: string;
}

const sha256Pattern = /^[0-9a-f]{64}$/u;
const lfsSchema = z.object({ oid: z.string().regex(sha256Pattern), size: z.number().int() });

const treeSchema = z.array(
  z.object({
    path: z.string(),
    type: z.string(),
    size: z.number().int().nonnegative(),
    lfs: lfsSchema.optional(),
  }),
);

// The LFS files of a repo by path, with the size and SHA256 that Hugging Face lists for each.
export async function readRepoFiles(repo: string): Promise<ReadonlyMap<string, RepoFile>> {
  const response = await fetch(`https://huggingface.co/api/models/${repo}/tree/main`);

  if (!response.ok) {
    throw new CLIError(`Hugging Face answered ${response.status} for the file list of ${repo}`);
  }

  const json: unknown = await response.json();

  const parsed = treeSchema.safeParse(json);

  if (!parsed.success) {
    throw new CLIError(`Hugging Face sent a file list for ${repo} that llm cannot read`);
  }

  const files = new Map<string, RepoFile>();

  for (const entry of parsed.data) {
    if (entry.type === 'file' && entry.lfs !== undefined) {
      files.set(entry.path, { sizeBytes: entry.lfs.size, sha256: entry.lfs.oid });
    }
  }

  return files;
}
