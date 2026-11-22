#!/usr/bin/env bun
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { systemClock } from '@zgeoff/std';
import { runProcess } from './host/run-process.ts';
import { runCLI } from './run-cli.ts';
import { runPowerShell } from './windows/run-powershell.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const homeDir = homedir();

const result = await runCLI(Bun.argv.slice(2), {
  catalogPath: `${repoRoot}models.yaml`,
  mountRoot: '/mnt',
  repoRoot,
  print: (text) => {
    console.log(text);
  },
  runPowerShell: (script) => runPowerShell(script, runProcess),
  readDefaultRoute: async () => {
    const route = await runProcess(['ip', 'route', 'show', 'default']);

    return route.stdout;
  },
  readWindowsPath: async (wslPath) => {
    const converted = await runProcess(['wslpath', '-w', wslPath]);

    return converted.stdout.trim();
  },
  runProcess,
  homeDir,
  bunPath: process.execPath,
  atcConfigPath: `${homeDir}/.config/atc/config.json`,
  clock: systemClock,
  healthPoll: { intervalMs: 1000, timeoutMs: 30_000 },
});

if (result.errorMessage !== null) {
  console.error(`llm: ${result.errorMessage}`);
}

process.exitCode = result.exitCode;
