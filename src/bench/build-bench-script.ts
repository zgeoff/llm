import { quotePowerShellString } from '../windows/quote-powershell-string.ts';

interface BenchScriptOptions {
  readonly benchPath: string;
  readonly modelPath: string;
  readonly device: string;
  readonly nCpuMoe: number | undefined;
  readonly depths: readonly number[];
  readonly repetitions: number;

  // The ROCm library folder, put in front of PATH for the llama-bench process only.
  readonly pathPrefix: string | undefined;
}

// llama-bench writes its progress to stderr, so stderr is merged into the output and the caller
// keeps the lines that start with `{`. The last line carries the exit code.
export function buildBenchScript(options: BenchScriptOptions): string {
  const flags = [
    `-m ${quotePowerShellString(options.modelPath)}`,
    `-dev ${quotePowerShellString(options.device)}`,
    '-ngl 99',
    '-fa 1',
    '-p 512',
    '-n 128',
    `-d ${options.depths.join(',')}`,
    `-r ${options.repetitions}`,
    '-o jsonl',
    ...(options.nCpuMoe === undefined ? [] : [`--n-cpu-moe ${options.nCpuMoe}`]),
  ];

  return [
    ...(options.pathPrefix === undefined
      ? []
      : [`$env:PATH = ${quotePowerShellString(`${options.pathPrefix};`)} + $env:PATH`]),
    `& ${quotePowerShellString(options.benchPath)} ${flags.join(' ')} 2>&1 | ForEach-Object { "$_" }`,
    'Write-Output "exit=$LASTEXITCODE"',
  ].join('\n');
}
