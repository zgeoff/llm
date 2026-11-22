export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

// Runs one PowerShell script on the Windows host.
export type PowerShellRunner = (script: string) => Promise<ProcessResult>;
