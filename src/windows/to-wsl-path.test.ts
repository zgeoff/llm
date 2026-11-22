import { expect, test } from 'bun:test';
import { win32 } from 'node:path';
import { toWSLPath } from './to-wsl-path.ts';

test('it maps a Windows file path under the mount root', () => {
  expect(toWSLPath(String.raw`D:\models\owner\repo\file.gguf`, '/mnt')).toBe(
    '/mnt/d/models/owner/repo/file.gguf',
  );
});

test('it lowercases the drive letter', () => {
  expect(toWSLPath(String.raw`C:\llm`, '/mnt')).toBe('/mnt/c/llm');
});

test('it maps a drive root to the drive folder', () => {
  expect(toWSLPath(`D:${win32.sep}`, '/mnt')).toBe('/mnt/d');
});

test('it maps a bare drive letter to the drive folder', () => {
  expect(toWSLPath('D:', '/mnt')).toBe('/mnt/d');
});

test('it uses the mount root it is given', () => {
  expect(toWSLPath(String.raw`D:\models`, '/tmp/fake-mnt')).toBe('/tmp/fake-mnt/d/models');
});

test('it rejects a path without a drive', () => {
  expect(() => toWSLPath(String.raw`models\file.gguf`, '/mnt')).toThrow(
    'not an absolute Windows path',
  );
});
