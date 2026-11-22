import { expect, test } from 'bun:test';
import { buildPullScript } from './build-pull-script.ts';

function setupTest() {
  const target = {
    folder: String.raw`D:\models\example-org\example-GGUF`,
    file: 'model-Q4.gguf',
    url: 'https://huggingface.co/example-org/example-GGUF/resolve/main/model-Q4.gguf',
    sizeBytes: 12_345,
    sha256: 'a'.repeat(64),
  };

  return { target };
}

test('it downloads with a resumable curl.exe into the model folder', () => {
  const ctx = setupTest();
  const script = buildPullScript(ctx.target);

  expect(script).toContain(String.raw`$folder = 'D:\models\example-org\example-GGUF'`);

  expect(script).toContain(
    "curl.exe -L --fail -sS -C - -o $out 'https://huggingface.co/example-org/example-GGUF/resolve/main/model-Q4.gguf'",
  );
});

test('it skips the download when the file already has the listed size', () => {
  const ctx = setupTest();

  expect(buildPullScript(ctx.target)).toContain('(Get-Item -LiteralPath $out).Length -ne 12345');
});

test('it checks the hash against the listed SHA256 and writes the sidecar after it', () => {
  const ctx = setupTest();
  const script = buildPullScript(ctx.target);

  expect(script).toContain(`$expected = '${'a'.repeat(64)}'`);
  expect(script.indexOf('Get-FileHash')).toBeLessThan(script.indexOf('Set-Content'));
  expect(script).toContain('Set-Content -LiteralPath "$out.sha256" -Value $hash');
});

test('it removes a file whose hash does not match', () => {
  const ctx = setupTest();
  const script = buildPullScript(ctx.target);

  expect(script.indexOf('if ($hash -ne $expected)')).toBeLessThan(
    script.indexOf('Remove-Item -LiteralPath $out -Force'),
  );
});

test('it quotes a file name that holds a single quote', () => {
  const ctx = setupTest();

  expect(buildPullScript({ ...ctx.target, file: "it's.gguf" })).toContain("$name = 'it''s.gguf'");
});
