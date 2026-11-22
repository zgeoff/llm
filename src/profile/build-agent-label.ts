import type { Model } from '../catalog/types.ts';

interface AgentLabelOptions {
  readonly modelID: string;
  readonly model: Pick<Model, 'name' | 'mmproj' | 'tags'>;

  // Whether the chat template text reads `reasoning_effort`.
  readonly readsReasoningEffort: boolean;
}

// `<name> (<traits>)`, with the traits in a fixed order and no parentheses when there are none.
export function buildAgentLabel(options: AgentLabelOptions): string {
  const traits = [
    ...(options.readsReasoningEffort ? ['effort'] : []),
    ...(options.model.mmproj === undefined ? [] : ['vision']),
    ...(options.model.tags.includes('abliterated') ? ['abliterated'] : []),
  ];

  const name = options.model.name ?? options.modelID;

  return traits.length === 0 ? name : `${name} (${traits.join(' · ')})`;
}
