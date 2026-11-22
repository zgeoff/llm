import { define } from 'gunshi';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

const defaultLineCount = 50;

export function createLogsCommand(dependencies: CLIDependencies) {
  return define({
    name: 'logs',
    description: 'Print the last lines of the llama-swap log',
    args: {
      lines: {
        type: 'number',
        short: 'n',
        description: `Lines to print, ${defaultLineCount} by default`,
      },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const lineCount = ctx.values.lines ?? defaultLineCount;

      if (!Number.isInteger(lineCount) || lineCount < 1) {
        throw new CLIError('-n takes a whole number of lines, one or more');
      }

      const file = Bun.file(toWSLPath(catalog.machine.llamaSwap.logPath, dependencies.mountRoot));

      if (!(await file.exists())) {
        throw new CLIError(`no log at ${catalog.machine.llamaSwap.logPath}; run llm up first`);
      }

      const text = await file.text();

      const lines = text.replaceAll('\r', '').trimEnd().split('\n');

      dependencies.print(lines.slice(-lineCount).join('\n'));
    },
  });
}
