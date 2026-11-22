import { expect, test } from 'bun:test';
import { buildCatalog } from '../testing/build-catalog.ts';
import { parseCatalog } from './parse-catalog.ts';

test('it parses a catalog written as YAML', () => {
  const machine = Bun.YAML.stringify({ machine: buildCatalog().machine }, null, 2);

  const text = [
    machine,
    'models:',
    '  gpt-oss-20b:',
    '    repo: ggml-org/gpt-oss-20b-GGUF',
    '    file: gpt-oss-20b-MXFP4.gguf',
    '    tags: [speed]',
    '    backend: vulkan',
    '    ctx: 32768',
    '    kvCache: f16',
  ].join('\n');

  const result = parseCatalog(text);

  expect(result.success && result.catalog.models['gpt-oss-20b']).toStrictEqual({
    repo: 'ggml-org/gpt-oss-20b-GGUF',
    file: 'gpt-oss-20b-MXFP4.gguf',
    tags: ['speed'],
    backend: 'vulkan',
    ctx: 32_768,
    kvCache: 'f16',
  });
});

test.each([
  ['block style', ['models:', '  alpha:', '    ctx: 1024', '  alpha:', '    ctx: 2048']],
  ['flow style', ['models: {alpha: {ctx: 1024}, alpha: {ctx: 2048}}']],
  [
    'an escaped models key',
    [String.raw`"mod\x65ls":`, '  alpha:', '    ctx: 1024', '  alpha:', '    ctx: 2048'],
  ],
  [
    'a quoted and a bare id',
    ['models:', '  alpha:', '    ctx: 1024', '  "alpha":', '    ctx: 2048'],
  ],
])('it rejects a model id that appears twice in %s', (_name, lines) => {
  const machine = Bun.YAML.stringify({ machine: buildCatalog().machine }, null, 2);
  const result = parseCatalog([machine, ...lines].join('\n'));

  expect(result.success).toBeFalse();

  expect(!result.success && result.issues).toStrictEqual([
    expect.stringContaining('Map keys must be unique'),
  ]);
});

test('it reports the path of an unknown key', () => {
  const machine = Bun.YAML.stringify({ machine: buildCatalog().machine }, null, 2);

  const text = [
    machine,
    'models:',
    '  gpt-oss-20b:',
    '    repo: ggml-org/gpt-oss-20b-GGUF',
    '    file: gpt-oss-20b-MXFP4.gguf',
    '    tags: []',
    '    backend: vulkan',
    '    ctx: 32768',
    '    kvCache: f16',
    '    quant: mxfp4',
  ].join('\n');

  const result = parseCatalog(text);

  expect(result).toStrictEqual({
    success: false,
    issues: ['models.gpt-oss-20b: Unrecognized key: "quant"'],
  });
});

test('it reports text that is not YAML', () => {
  const result = parseCatalog('machine: [unclosed');
  const issues = result.success ? [] : result.issues;

  expect(issues).toHaveLength(1);
  expect(issues[0]).toStartWith('not valid YAML');
});
