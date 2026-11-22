import { expect, test } from 'bun:test';
import { formatTable } from './format-table.ts';

test('it pads each column to its widest cell', () => {
  expect(
    formatTable(
      ['ID', 'SIZE'],
      [
        ['gpt-oss-20b', '12.1 GB'],
        ['a', '-'],
      ],
    ),
  ).toBe(['ID           SIZE', 'gpt-oss-20b  12.1 GB', 'a            -'].join('\n'));
});

test('it prints only the header when there are no rows', () => {
  expect(formatTable(['ID', 'SIZE'], [])).toBe('ID  SIZE');
});
