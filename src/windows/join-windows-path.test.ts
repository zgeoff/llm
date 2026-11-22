import { expect, test } from 'bun:test';
import { win32 } from 'node:path';
import { joinWindowsPath } from './join-windows-path.ts';

test('it joins segments with backslashes', () => {
  expect(joinWindowsPath(String.raw`D:\models`, 'owner', 'repo', 'file.gguf')).toBe(
    String.raw`D:\models\owner\repo\file.gguf`,
  );
});

test('it drops the separators that meet at a join', () => {
  const root = `${String.raw`D:\models`}${win32.sep}`;
  const folder = `${win32.sep}owner${win32.sep}`;

  expect(joinWindowsPath(root, folder, 'file.gguf')).toBe(String.raw`D:\models\owner\file.gguf`);
});

test('it keeps the root of a drive that ends in a separator', () => {
  expect(joinWindowsPath(`D:${win32.sep}`, 'models')).toBe(String.raw`D:\models`);
});
