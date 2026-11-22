import type { KVCacheCost } from '../gguf/build-kv-cache-cost.ts';
import type { ModelSummary } from '../gguf/build-model-summary.ts';
import { formatBytes } from './format-bytes.ts';

export function formatModelInspection(summary: ModelSummary, cost: KVCacheCost | null): string {
  const lines = [
    `Architecture: ${summary.architecture}`,
    `Parameters: ${formatParameters(summary)}`,
    `Blocks: ${formatNumber(summary.blockCount)}`,
    `Attention heads: ${formatHeads(summary.headCount)}`,
    `KV heads: ${formatHeads(summary.headCountKV)}`,
    `Key length: ${formatNumber(summary.keyLength)}`,
    `Value length: ${formatNumber(summary.valueLength)}`,
    `Context length: ${formatNumber(summary.contextLength)}`,
    `Sliding window: ${formatNumber(summary.slidingWindow)}`,
  ];

  if (cost === null) {
    lines.push('KV cache per 1k tokens: unknown, the file lacks a key the cost needs');
  } else {
    lines.push(
      `KV cache per 1k tokens: ${formatBytes(cost.f16BytesPer1kTokens)} at f16, ${formatBytes(cost.q8BytesPer1kTokens)} at q8_0`,
    );
  }

  if (summary.layerPatternKeys.length > 0) {
    lines.push(
      `The model has hybrid or sliding-window layers (${summary.layerPatternKeys.join(', ')}), so the KV cache figure is an upper bound.`,
    );
  }

  return lines.join('\n');
}

function formatParameters(summary: ModelSummary): string {
  const label = summary.sizeLabel === null ? '' : ` (${summary.sizeLabel})`;

  return summary.parameterCount === null
    ? (summary.sizeLabel ?? '-')
    : `${(summary.parameterCount / 1e9).toFixed(1)} B${label}`;
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : String(value);
}

// A hybrid model lists one count per layer.
function formatHeads(value: number | readonly number[] | null): string {
  if (value === null) {
    return '-';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return `${Math.max(...value)} in the widest layer, ${value.filter((heads) => heads > 0).length} of ${value.length} layers`;
}
