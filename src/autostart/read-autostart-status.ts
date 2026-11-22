import { CLIError } from '../cli-error.ts';
import type { PowerShellRunner } from '../windows/types.ts';
import { buildAutostartStatusScript } from './build-autostart-status-script.ts';
import type { AutostartStatus } from './parse-autostart-status.ts';
import { parseAutostartStatus } from './parse-autostart-status.ts';

export async function readAutostartStatus(
  runPowerShell: PowerShellRunner,
): Promise<AutostartStatus> {
  const result = await runPowerShell(buildAutostartStatusScript());

  if (result.exitCode !== 0) {
    throw new CLIError(`cannot read the Scheduled Task: ${result.stderr.trim()}`);
  }

  try {
    return parseAutostartStatus(result.stdout);
  } catch {
    throw new CLIError(`cannot read the Scheduled Task: unexpected output ${result.stdout.trim()}`);
  }
}
