import { expect, test } from 'bun:test';
import { buildInstallScript } from './build-install-script.ts';

function setupTest() {
  const target = {
    assetName: 'llama-b9000-bin-win-vulkan-x64.zip',
    url: 'https://example.test/llama.zip',
    sha256: 'abc123',
    downloadsDir: String.raw`C:\llm\downloads`,
    destination: String.raw`C:\llm\bin\vulkan`,
    version: 'b9000',
  };

  return { target };
}

test('it downloads, checks the hash, unpacks, unblocks and records the build', () => {
  const ctx = setupTest();
  const script = buildInstallScript(ctx.target);

  expect(script).toContain("curl.exe -L --fail -sS -C - -o $zip 'https://example.test/llama.zip'");
  expect(script).toContain("if ($hash -ne 'abc123')");
  expect(script).toContain(String.raw`$dest = 'C:\llm\bin\vulkan'`);
  expect(script).toContain('Expand-Archive');
  expect(script).toContain('Unblock-File');
  expect(script).toContain("-Value 'b9000'");
});

test('it leaves the hash check out when the release publishes no checksum', () => {
  const ctx = setupTest();

  expect(buildInstallScript({ ...ctx.target, sha256: null })).not.toContain('Get-FileHash');
});

test('it never asks for elevation', () => {
  const ctx = setupTest();

  expect(buildInstallScript(ctx.target)).not.toContain('RunAs');
});

test('it skips a destination whose BUILD file already names the version', () => {
  const ctx = setupTest();
  const script = buildInstallScript(ctx.target);
  const skipAt = script.indexOf("-eq 'b9000'");

  expect(skipAt).toBeGreaterThan(-1);
  expect(script).toContain('[System.IO.File]::ReadAllText($build).Trim()');
  expect(script).toContain(String.raw`Write-Output 'already installed b9000 at C:\llm\bin\vulkan'`);
  expect(skipAt).toBeLessThan(script.indexOf('curl.exe'));
  expect(skipAt).toBeLessThan(script.indexOf('Remove-Item'));
});
