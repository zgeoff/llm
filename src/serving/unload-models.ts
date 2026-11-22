import { CLIError } from '../cli-error.ts';

// The README's "llama-swap API" list (https://github.com/mostlygeek/llama-swap/blob/v269/README.md)
// names POST /api/models/unload for every running model and POST /api/models/unload/:model_id for
// one. Pass null to unload every model.
export async function unloadModels(baseURL: string, id: string | null): Promise<void> {
  const path = id === null ? '/api/models/unload' : `/api/models/unload/${encodeURIComponent(id)}`;

  const response = await fetch(`${baseURL}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new CLIError(
      `llama-swap could not unload ${id ?? 'its models'}: ${response.status} ${await response.text()}`,
    );
  }
}
