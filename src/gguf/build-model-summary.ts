import type { GGUFValue } from './parse-gguf-metadata.ts';

export interface ModelSummary {
  readonly architecture: string;
  readonly parameterCount: number | null;
  readonly sizeLabel: string | null;
  readonly blockCount: number | null;
  readonly headCount: number | readonly number[] | null;
  readonly headCountKV: number | readonly number[] | null;
  readonly keyLength: number | null;
  readonly valueLength: number | null;
  readonly contextLength: number | null;
  readonly slidingWindow: number | null;

  // The keys that mark hybrid or sliding-window layers, in the order the file lists them.
  readonly layerPatternKeys: readonly string[];
  readonly chatTemplate: string | null;
}

const layerPatternKey =
  /\.(?:ssm\.|full_attention_interval$|linear_attention|attention\.sliding_window)/u;

export function buildModelSummary(values: ReadonlyMap<string, GGUFValue>): ModelSummary {
  const architecture = pickString(values, 'general.architecture') ?? 'unknown';
  const embeddingLength = pickNumber(values, `${architecture}.embedding_length`);
  const headCount = pickCount(values, `${architecture}.attention.head_count`);

  return {
    architecture,
    parameterCount: pickNumber(values, 'general.parameter_count'),
    sizeLabel: pickString(values, 'general.size_label'),
    blockCount: pickNumber(values, `${architecture}.block_count`),
    headCount,
    headCountKV: pickCount(values, `${architecture}.attention.head_count_kv`) ?? headCount,
    keyLength:
      pickNumber(values, `${architecture}.attention.key_length`) ??
      deriveHeadLength(embeddingLength, headCount),
    valueLength:
      pickNumber(values, `${architecture}.attention.value_length`) ??
      deriveHeadLength(embeddingLength, headCount),
    contextLength: pickNumber(values, `${architecture}.context_length`),
    slidingWindow: pickNumber(values, `${architecture}.attention.sliding_window`),
    layerPatternKeys: [...values.keys()].filter(
      (key) => key.startsWith(`${architecture}.`) && layerPatternKey.test(key),
    ),
    chatTemplate: pickString(values, 'tokenizer.chat_template'),
  };
}

function pickString(values: ReadonlyMap<string, GGUFValue>, key: string): string | null {
  const value = values.get(key);

  return typeof value === 'string' ? value : null;
}

function pickNumber(values: ReadonlyMap<string, GGUFValue>, key: string): number | null {
  const value = values.get(key);

  return typeof value === 'number' ? value : null;
}

// A hybrid model stores one head count per layer.
function pickCount(
  values: ReadonlyMap<string, GGUFValue>,
  key: string,
): number | readonly number[] | null {
  const value = values.get(key);

  if (typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return value;
  }

  return null;
}

// A model without key_length uses the embedding width split over the attention heads.
function deriveHeadLength(
  embeddingLength: number | null,
  headCount: number | readonly number[] | null,
): number | null {
  if (embeddingLength === null || typeof headCount !== 'number' || headCount === 0) {
    return null;
  }

  return embeddingLength / headCount;
}
