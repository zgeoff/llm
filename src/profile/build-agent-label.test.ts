import { expect, test } from 'bun:test';
import { buildModel } from '../testing/build-model.ts';
import { buildAgentLabel } from './build-agent-label.ts';

test('it lists every trait in the fixed order', () => {
  const label = buildAgentLabel({
    modelID: 'example-model',
    model: buildModel({ name: 'Example 9B', mmproj: 'mmproj.gguf', tags: ['abliterated'] }),
    readsReasoningEffort: true,
  });

  expect(label).toBe('Example 9B (effort · vision · abliterated)');
});

test('it lists only the traits that the model has', () => {
  const label = buildAgentLabel({
    modelID: 'example-model',
    model: buildModel({ name: 'Example 9B', mmproj: 'mmproj.gguf' }),
    readsReasoningEffort: false,
  });

  expect(label).toBe('Example 9B (vision)');
});

test('it leaves out the parentheses when there are no traits', () => {
  const label = buildAgentLabel({
    modelID: 'example-model',
    model: buildModel({ name: 'Example 9B' }),
    readsReasoningEffort: false,
  });

  expect(label).toBe('Example 9B');
});

test('it falls back to the model id when the entry has no name', () => {
  const label = buildAgentLabel({
    modelID: 'example-model',
    model: buildModel({ tags: ['abliterated'] }),
    readsReasoningEffort: false,
  });

  expect(label).toBe('example-model (abliterated)');
});
