import { quotePowerShellString } from '../windows/quote-powershell-string.ts';

export interface PullTarget {
  readonly folder: string;
  readonly file: string;
  readonly url: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

// The download runs on Windows, straight to the models drive, and resumes a partial file. A file
// that is already whole skips curl, because Hugging Face answers a resume at the end with a 416.
export function buildPullScript(target: PullTarget): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$folder = ${quotePowerShellString(target.folder)}`,
    `$name = ${quotePowerShellString(target.file)}`,
    `$expected = ${quotePowerShellString(target.sha256)}`,
    'New-Item -ItemType Directory -Force -Path $folder | Out-Null',
    '$out = Join-Path $folder $name',
    `if (-not (Test-Path -LiteralPath $out) -or (Get-Item -LiteralPath $out).Length -ne ${target.sizeBytes}) {`,
    `  curl.exe -L --fail -sS -C - -o $out ${quotePowerShellString(target.url)}`,
    '  if ($LASTEXITCODE -ne 0) { throw "curl.exe exited with $LASTEXITCODE" }',
    '}',
    '$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $out).Hash.ToLower()',
    'if ($hash -ne $expected) {',
    '  Remove-Item -LiteralPath $out -Force',
    '  throw ("SHA256 mismatch for " + $name + ": " + $hash + ", expected " + $expected + "; the file was removed")',
    '}',
    'Set-Content -LiteralPath "$out.sha256" -Value $hash',
    '"pulled $out, sha256 ok"',
  ].join('\n');
}
