import { CLIError } from '../cli-error.ts';
import type { PowerShellRunner } from '../windows/types.ts';

// Stop-Process on llama-swap can leave a llama-server behind, so both go. Get-Process fails for a
// missing name even with SilentlyContinue, so the script sets its own exit code. A llama-server
// that holds a loaded model takes seconds to exit, so the script waits up to 15 s.
const stopScript = [
  'Get-Process llama-swap, llama-server -ErrorAction SilentlyContinue | Stop-Process -Force',
  '$deadline = (Get-Date).AddSeconds(15)',
  'do { Start-Sleep -Milliseconds 250; $left = @(Get-Process llama-swap, llama-server -ErrorAction SilentlyContinue) } while ($left.Count -gt 0 -and (Get-Date) -lt $deadline)',
  "if ($left.Count -gt 0) { [Console]::Error.WriteLine('still running: ' + (($left | ForEach-Object { $_.ProcessName }) -join ', ')); exit 1 }",
  'exit 0',
].join('\n');

export async function stopLlamaSwap(runPowerShell: PowerShellRunner): Promise<void> {
  const result = await runPowerShell(stopScript);

  if (result.exitCode !== 0) {
    throw new CLIError(`cannot stop llama-swap: ${result.stderr.trim()}`);
  }
}
