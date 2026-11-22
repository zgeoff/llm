import { expect, test } from 'bun:test';
import { formatBytes } from './format-bytes.ts';

test.each([
  [0, '0 B'],
  [999, '999 B'],
  [1500, '1.5 KB'],
  [12_109_566_624, '12.1 GB'],
  [2_000_000_000_000, '2.0 TB'],
])('it formats %d bytes as %s', (bytes, expected) => {
  expect(formatBytes(bytes)).toBe(expected);
});
