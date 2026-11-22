import { expect, test } from 'bun:test';
import { formatCompareTable } from './format-compare-table.ts';

test('it prints a column per measure and a dash for a missing one', () => {
  expect(
    formatCompareTable([
      {
        modelID: 'a',
        backend: 'vulkan',
        promptTokensPerSecond: 5750.04,
        generationTokensPerSecond: 189,
        deepGeneration: { depth: 32_768, tokensPerSecond: 149.26 },
        coldTTFTMs: 4000.4,
        warmTTFTMs: null,
        ttftTokensPerSecond: null,
      },
    ]),
  ).toBe(
    [
      'model  backend  pp t/s  tg t/s  tg t/s deep   cold ttft ms  warm ttft ms  ttft tok/s',
      'a      vulkan   5750.0  189.0   149.3 @32768  4000          -             -',
    ].join('\n'),
  );
});
