const exitLinePattern = /^exit=(?<code>-?\d+)$/u;

// The bench script ends with an `exit=<code>` line that carries the exit code of llama-bench.
export function parseBenchExitCode(output: string): number | null {
  const lastLine = output.trimEnd().split('\n').at(-1)?.trim() ?? '';
  const code = exitLinePattern.exec(lastLine)?.groups?.['code'];

  return code === undefined ? null : Number(code);
}
