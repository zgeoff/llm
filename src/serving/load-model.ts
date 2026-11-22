import { CLIError } from '../cli-error.ts';

// llama-swap lists no load endpoint in its README (v269): a request on an OpenAI endpoint loads the
// model that its `model` field names. A one-token completion is the cheapest such request, and it
// returns when the model is ready.
const loadTimeoutMs = 600_000;

export async function loadModel(baseURL: string, id: string): Promise<void> {
  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: id,
      messages: [{ role: 'user', content: 'Reply with one word.' }],
      max_tokens: 1,
    }),
    signal: AbortSignal.timeout(loadTimeoutMs),
  });

  if (!response.ok) {
    throw new CLIError(
      `llama-swap could not load ${id}: ${response.status} ${await response.text()}`,
    );
  }
}
