import { expect, test } from 'bun:test';
import { buildElevatedScript } from './build-elevated-script.ts';

test('it wraps a script so that Start-Process asks for elevation', () => {
  const script = buildElevatedScript('Get-Date');

  expect(script).toContain('-Verb RunAs -Wait -PassThru');
  expect(script).toContain(Buffer.from('Get-Date', 'utf16le').toString('base64'));
});
