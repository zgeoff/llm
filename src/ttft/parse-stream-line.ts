import { z } from 'zod';

const deltaSchema = z.looseObject({
  content: z.string().nullish(),
  reasoning_content: z.string().nullish(),
});

const choiceSchema = z.looseObject({ delta: deltaSchema.optional() });
const usageSchema = z.looseObject({ completion_tokens: z.number() });

const chunkSchema = z.looseObject({
  choices: z.array(choiceSchema).optional(),
  usage: usageSchema.nullish(),
  error: z.unknown().optional(),
});

interface StreamLine {
  // The chunk carries generated text, reasoning included.
  readonly hasText: boolean;
  readonly completionTokens: number | null;

  // The chunk is a server error, as JSON text; null for an ordinary chunk.
  readonly errorMessage: string | null;
}

// One line of a server-sent-event stream from /v1/chat/completions. Null for a line that is not a
// JSON data line, such as a comment, a blank line or the closing [DONE].
export function parseStreamLine(line: string): StreamLine | null {
  if (!line.startsWith('data:')) {
    return null;
  }

  const payload = line.slice('data:'.length).trim();

  try {
    const chunk = chunkSchema.parse(JSON.parse(payload));
    const delta = chunk.choices?.[0]?.delta;

    return {
      hasText: Boolean(delta?.content) || Boolean(delta?.reasoning_content),
      completionTokens: chunk.usage?.completion_tokens ?? null,
      errorMessage:
        chunk.error === undefined || chunk.error === null ? null : JSON.stringify(chunk.error),
    };
  } catch {
    return null;
  }
}
