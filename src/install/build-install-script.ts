import { quotePowerShellString } from '../windows/quote-powershell-string.ts';

interface InstallTarget {
  readonly assetName: string;
  readonly url: string;
  readonly sha256: string | null;
  readonly downloadsDir: string;
  readonly destination: string;

  // Written to the BUILD file of the destination.
  readonly version: string;
}

// Runs as the user under C:\llm, with no admin rights. A matching BUILD skips the install, because
// replacing the folder deletes the binaries a running llama-server loads. ReadAllText, unlike
// Get-Content -Raw, returns '' for an empty file, so .Trim() never throws on $null.
export function buildInstallScript(target: InstallTarget): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$dest = ${quotePowerShellString(target.destination)}`,
    "$build = Join-Path $dest 'BUILD'",
    `if ((Test-Path -LiteralPath $build) -and ([System.IO.File]::ReadAllText($build).Trim() -eq ${quotePowerShellString(target.version)})) {`,
    `  Write-Output ${quotePowerShellString(`already installed ${target.version} at ${target.destination}`)}`,
    '  exit 0',
    '}',
    `$zip = Join-Path ${quotePowerShellString(target.downloadsDir)} ${quotePowerShellString(target.assetName)}`,
    `New-Item -ItemType Directory -Force -Path ${quotePowerShellString(target.downloadsDir)} | Out-Null`,
    `curl.exe -L --fail -sS -C - -o $zip ${quotePowerShellString(target.url)}`,
    'if ($LASTEXITCODE -ne 0) { throw "curl.exe exited with $LASTEXITCODE" }',
    ...(target.sha256 === null
      ? []
      : [
          '$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLower()',
          `if ($hash -ne ${quotePowerShellString(target.sha256)}) { throw "SHA256 mismatch for the download: $hash" }`,
        ]),
    'if (Test-Path -LiteralPath $dest) { Remove-Item -Recurse -Force -LiteralPath $dest }',
    'Expand-Archive -LiteralPath $zip -DestinationPath $dest',
    'Get-ChildItem -Recurse -LiteralPath $dest | Unblock-File',
    `Set-Content -LiteralPath (Join-Path $dest 'BUILD') -Value ${quotePowerShellString(target.version)}`,
    `Write-Output ${quotePowerShellString(`installed ${target.version} to ${target.destination}`)}`,
  ].join('\n');
}
