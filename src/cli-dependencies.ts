import type { Clock } from '@zgeoff/std';
import type { PowerShellRunner, ProcessResult } from './windows/types.ts';

// What the commands reach outside the process through, so a test passes its own.
export interface CLIDependencies {
  readonly catalogPath: string;

  // The folder that holds a Windows drive as `<mountRoot>/<letter>`, which is /mnt in WSL.
  readonly mountRoot: string;

  // The checkout that holds `templates/` and `results/`.
  readonly repoRoot: string;
  readonly print: (text: string) => void;
  readonly runPowerShell: PowerShellRunner;

  // The output of `ip route show default`.
  readonly readDefaultRoute: () => Promise<string>;

  // The Windows form of a WSL path, as `wslpath -w` prints it.
  readonly readWindowsPath: (wslPath: string) => Promise<string>;

  // Runs one command in WSL, such as systemctl.
  readonly runProcess: (command: readonly string[]) => Promise<ProcessResult>;
  readonly homeDir: string;

  // The Bun binary that a systemd unit starts the proxy with.
  readonly bunPath: string;

  // Where atc reads its agents from.
  readonly atcConfigPath: string;
  readonly clock: Pick<Clock, 'now' | 'sleep'>;
  readonly healthPoll: { readonly intervalMs: number; readonly timeoutMs: number };
}
