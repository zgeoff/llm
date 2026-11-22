import { expect, test } from 'bun:test';
import { encodePowerShellScript } from './encode-powershell-script.ts';

test('it encodes a script as base64 of UTF-16LE', () => {
  const encoded = encodePowerShellScript('Get-Date');

  expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe('Get-Date');
});
