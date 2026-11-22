import { CLIError } from '../cli-error.ts';
import { parseGGUFMetadata } from './parse-gguf-metadata.ts';
import type { GGUFMetadata } from './parse-gguf-metadata.ts';

const firstWindowBytes = 4 * 1024 * 1024;
const growthFactor = 4;

// Reads only the head of the file, which is all the key-value section needs, so a 20 GB model
// costs a few megabytes over the 9P mount. The window grows while the section is cut off.
export async function readGGUFMetadata(
  path: string,
  options: { readonly firstWindowBytes?: number } = {},
): Promise<GGUFMetadata> {
  const file = Bun.file(path);
  let windowBytes = options.firstWindowBytes ?? firstWindowBytes;

  for (;;) {
    const bytes = await file.slice(0, windowBytes).bytes();

    const result = parseGGUFMetadata(bytes);

    if (result.status === 'ok') {
      return result.metadata;
    }

    if (result.status === 'invalid') {
      throw new CLIError(`${path}: ${result.reason}`);
    }

    if (bytes.length < windowBytes) {
      throw new CLIError(`${path}: the file ends inside the key-value section`);
    }

    windowBytes *= growthFactor;
  }
}
