import type { PowerShellRunner, ProcessResult } from '../windows/types.ts';

export interface FakePowerShellAnswer {
  readonly whenScriptIncludes: string;
  readonly result: Partial<ProcessResult>;
}

export interface FakePowerShell {
  readonly run: PowerShellRunner;

  // Every script that was run, in order.
  readonly scripts: string[];
}

// Answers each script with the first answer whose text the script includes, and with an empty
// success otherwise. It never starts a process.
export function buildFakePowerShell(answers: readonly FakePowerShellAnswer[] = []): FakePowerShell {
  const scripts: string[] = [];

  return {
    scripts,
    run: (script) => {
      scripts.push(script);

      const answer = answers.find((candidate) => script.includes(candidate.whenScriptIncludes));

      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '', ...answer?.result });
    },
  };
}
