import { cli, define } from 'gunshi';
import type { CLIDependencies } from './cli-dependencies.ts';
import { CLIError } from './cli-error.ts';
import { createAutostartCommand } from './commands/create-autostart-command.ts';
import { createBenchCommand } from './commands/create-bench-command.ts';
import { createCompareCommand } from './commands/create-compare-command.ts';
import { createConfigCommand } from './commands/create-config-command.ts';
import { createDiskCommand } from './commands/create-disk-command.ts';
import { createDownCommand } from './commands/create-down-command.ts';
import { createGameCommand } from './commands/create-game-command.ts';
import { createInspectCommand } from './commands/create-inspect-command.ts';
import { createInstallCommand } from './commands/create-install-command.ts';
import { createLoadCommand } from './commands/create-load-command.ts';
import { createLogsCommand } from './commands/create-logs-command.ts';
import { createLsCommand } from './commands/create-ls-command.ts';
import { createProfileCommand } from './commands/create-profile-command.ts';
import { createProxyCommand } from './commands/create-proxy-command.ts';
import { createPullCommand } from './commands/create-pull-command.ts';
import { createRmCommand } from './commands/create-rm-command.ts';
import { createStatusCommand } from './commands/create-status-command.ts';
import { createTTFTCommand } from './commands/create-ttft-command.ts';
import { createUnloadCommand } from './commands/create-unload-command.ts';
import { createUpCommand } from './commands/create-up-command.ts';

export interface CLIResult {
  readonly exitCode: number;
  readonly errorMessage: string | null;
}

export async function runCLI(
  argv: readonly string[],
  dependencies: CLIDependencies,
): Promise<CLIResult> {
  const entry = define({
    name: 'llm',
    description: 'Install, serve and benchmark local LLMs on the Windows host',
    run: () => {
      throw new CLIError('name a command, or pass --help to list them');
    },
  });

  try {
    const output = await cli([...argv], entry, {
      name: 'llm',
      version: '0.0.0',
      description: 'Install, serve and benchmark local LLMs on the Windows host',
      renderHeader: null,
      usageSilent: true,
      subCommands: {
        ls: createLsCommand(dependencies),
        disk: createDiskCommand(dependencies),
        config: createConfigCommand(dependencies),
        pull: createPullCommand(dependencies),
        up: createUpCommand(dependencies),
        down: createDownCommand(dependencies),
        status: createStatusCommand(dependencies),
        logs: createLogsCommand(dependencies),
        install: createInstallCommand(dependencies),
        rm: createRmCommand(dependencies),
        inspect: createInspectCommand(dependencies),
        bench: createBenchCommand(dependencies),
        proxy: createProxyCommand(dependencies),
        profile: createProfileCommand(dependencies),
        load: createLoadCommand(dependencies),
        unload: createUnloadCommand(dependencies),
        game: createGameCommand(dependencies),
        ttft: createTTFTCommand(dependencies),
        compare: createCompareCommand(dependencies),
        autostart: createAutostartCommand(dependencies),
      },
    });

    if (output !== undefined) {
      dependencies.print(output);
    }

    return { exitCode: 0, errorMessage: null };
  } catch (error) {
    if (error instanceof CLIError) {
      return { exitCode: 1, errorMessage: error.message };
    }

    throw error;
  }
}
