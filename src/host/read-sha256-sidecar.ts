// The sidecar `<file>.sha256` holds the digest `llm pull` verified, either bare or followed by the
// file name.
export async function readSHA256Sidecar(modelPath: string): Promise<string | null> {
  const sidecar = Bun.file(`${modelPath}.sha256`);

  if (!(await sidecar.exists())) {
    return null;
  }

  const text = await sidecar.text();

  const digest = text.trim().split(/\s+/u)[0] ?? '';

  return /^[0-9a-f]{64}$/iu.test(digest) ? digest.toLowerCase() : null;
}
