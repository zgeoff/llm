import { expect, test } from 'bun:test';
import { formatUnifiedDiff } from './format-unified-diff.ts';

function setupTest() {
  const labels = { before: 'upstream', after: 'model' };

  return { labels };
}

test('it returns an empty string for equal texts', () => {
  const ctx = setupTest();

  expect(formatUnifiedDiff('a\nb\nc', 'a\nb\nc', ctx.labels)).toBe('');
});

test('it shows a changed line with its context', () => {
  const ctx = setupTest();
  const diff = formatUnifiedDiff('one\ntwo\nthree\nfour', 'one\ntwo\n3\nfour', ctx.labels);

  expect(diff).toBe(
    ['--- upstream', '+++ model', '@@ -1,4 +1,4 @@', ' one', ' two', '-three', '+3', ' four'].join(
      '\n',
    ),
  );
});

test('it shows an added line and a removed line', () => {
  const ctx = setupTest();
  const added = formatUnifiedDiff('a\nb', 'a\nnew\nb', ctx.labels);
  const removed = formatUnifiedDiff('a\nold\nb', 'a\nb', ctx.labels);

  expect(added).toContain('@@ -1,2 +1,3 @@\n a\n+new\n b');
  expect(removed).toContain('@@ -1,3 +1,2 @@\n a\n-old\n b');
});

test('it splits changes that are far apart into two hunks with the right start lines', () => {
  const ctx = setupTest();
  const before = Array.from({ length: 20 }, (_, index) => `line ${index}`);

  const after = before.map((line, index) =>
    index === 1 || index === 18 ? `${line} changed` : line,
  );

  const diff = formatUnifiedDiff(before.join('\n'), after.join('\n'), ctx.labels);

  expect(diff.match(/^@@.*@@$/gmu)).toStrictEqual(['@@ -1,5 +1,5 @@', '@@ -16,5 +16,5 @@']);
});

test('it keeps two nearby changes in one hunk', () => {
  const ctx = setupTest();
  const before = 'a\nb\nc\nd\ne\nf';
  const after = 'A\nb\nc\nd\ne\nF';

  expect(formatUnifiedDiff(before, after, ctx.labels).match(/^@@/gmu)).toHaveLength(1);
});
