import type { Clock } from '@zgeoff/std';
import { CLIError } from '../cli-error.ts';
import { parseStreamLine } from './parse-stream-line.ts';

interface TTFTMeasurement {
  readonly ttftMs: number;
  readonly completionTokens: number;

  // Output tokens per second after the first one; null when the reply was one token or less.
  readonly tokensPerSecond: number | null;
}

interface MeasureTTFTOptions {
  readonly baseURL: string;
  readonly modelID: string;
  readonly prompt: string;
  readonly maxTokens: number;
  readonly clock: Pick<Clock, 'now'>;
}

const requestTimeoutMs = 600_000;

// Time from sending the request to the first streamed chunk that carries text. When the model is
// not loaded, llama-swap loads it first, and the load counts: that is the cold time.
export async function measureTTFT(options: MeasureTTFTOptions): Promise<TTFTMeasurement> {
  const start = options.clock.now();

  const response = await fetch(`${options.baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: options.modelID,
      messages: [{ role: 'user', content: options.prompt }],
      max_tokens: options.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok || response.body === null) {
    throw new CLIError(
      `llama-swap could not stream from ${options.modelID}: ${response.status} ${await response.text()}`,
    );
  }

  let firstTextMs: number | null = null;
  let textChunks = 0;
  let reportedTokens: number | null = null;
  let buffered = '';

  const handleLine = (line: string): void => {
    const parsed = parseStreamLine(line);

    if (parsed === null) {
      return;
    }

    if (parsed.errorMessage !== null) {
      throw new CLIError(`${options.modelID} failed mid-stream: ${parsed.errorMessage}`);
    }

    if (parsed.hasText) {
      textChunks += 1;
      firstTextMs ??= options.clock.now();
    }

    reportedTokens = parsed.completionTokens ?? reportedTokens;
  };

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    buffered += part.value;

    const lines = buffered.split('\n');

    buffered = lines.pop() ?? '';

    lines.forEach((line) => {
      handleLine(line);
    });
  }

  handleLine(buffered);

  const end = options.clock.now();

  if (firstTextMs === null) {
    throw new CLIError(`${options.modelID} streamed no text`);
  }

  // Without a usage chunk, one text chunk stands for one token, which llama-server emits.
  const completionTokens = reportedTokens ?? textChunks;
  const decodeSeconds = (end - firstTextMs) / 1000;

  return {
    ttftMs: firstTextMs - start,
    completionTokens,
    tokensPerSecond:
      completionTokens > 1 && decodeSeconds > 0 ? (completionTokens - 1) / decodeSeconds : null,
  };
}
