// True when llama-swap answers /health from where this process runs.
export async function probeLlamaSwap(baseURL: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/health`, { signal: AbortSignal.timeout(2000) });

    return response.ok;
  } catch {
    return false;
  }
}
