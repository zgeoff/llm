// A failure the person running the command can act on: the CLI prints its message and exits 1,
// with no stack.
export class CLIError extends Error {
  override name = 'CLIError';
}
