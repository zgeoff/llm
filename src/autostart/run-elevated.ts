import { CLIError } from '../cli-error.ts';
import type { PowerShellRunner } from '../windows/types.ts';
import { buildElevatedScript } from './build-elevated-script.ts';

export async function runElevated(runPowerShell: PowerShellRunner, script: string): Promise<void> {
  const result = await runPowerShell(buildElevatedScript(script));

  if (result.exitCode !== 0) {
    throw new CLIError(
      `the elevated step did not finish, so nothing changed (a declined UAC prompt looks like this): ${result.stderr.trim()}`,
    );
  }
}
