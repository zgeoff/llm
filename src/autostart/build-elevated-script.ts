import { encodePowerShellScript } from '../windows/encode-powershell-script.ts';

// Start-Process -Verb RunAs shows the UAC prompt, and an elevated process cannot pipe its output
// back, so the caller checks the outcome afterwards. A declined prompt makes Start-Process throw.
export function buildElevatedScript(script: string): string {
  const encoded = encodePowerShellScript(script);

  return [
    "$ErrorActionPreference = 'Stop'",
    `$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '${encoded}'`,
    'if ($process.ExitCode -ne 0) { throw "the elevated step exited with code $($process.ExitCode)" }',
  ].join('\n');
}
