// -EncodedCommand takes base64 of UTF-16LE, so no quoting crosses the two shells.
export function encodePowerShellScript(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}
