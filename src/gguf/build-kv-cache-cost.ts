import type { ModelSummary } from './build-model-summary.ts';

export interface KVCacheCost {
  readonly f16BytesPer1kTokens: number;
  readonly q8BytesPer1kTokens: number;
}

const f16BytesPerElement = 2;

// q8_0 stores 32 values in 34 bytes: 32 one-byte values and a two-byte scale.
const q8BytesPerElement = 34 / 32;

// The cost counts every block as a full-attention layer, so it is an upper bound for a model with
// hybrid or sliding-window layers. Null means the file lacks a key the cost needs.
export function buildKVCacheCost(summary: ModelSummary): KVCacheCost | null {
  const blockCount = summary.blockCount;
  const headCountKV = summary.headCountKV;
  const keyLength = summary.keyLength;
  const valueLength = summary.valueLength;

  if (blockCount === null || headCountKV === null || keyLength === null || valueLength === null) {
    return null;
  }

  const headsAcrossLayers =
    typeof headCountKV === 'number'
      ? blockCount * headCountKV
      : headCountKV.reduce((total, heads) => total + heads, 0);

  const elementsPerToken = headsAcrossLayers * (keyLength + valueLength);

  return {
    f16BytesPer1kTokens: elementsPerToken * f16BytesPerElement * 1000,
    q8BytesPer1kTokens: elementsPerToken * q8BytesPerElement * 1000,
  };
}
