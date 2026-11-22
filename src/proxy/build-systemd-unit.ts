interface SystemdUnitOptions {
  readonly bunPath: string;
  readonly repoRoot: string;
}

export function buildSystemdUnit(options: SystemdUnitOptions): string {
  const command = [options.bunPath, `${options.repoRoot}src/cli.ts`, 'proxy', 'run']
    .map((word) => quoteWord(word))
    .join(' ');

  return [
    '[Unit]',
    'Description=llm proxy for local models',
    'After=network.target',
    '',
    '[Service]',
    `ExecStart=${command}`,
    'Restart=on-failure',
    'RestartSec=3',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

function quoteWord(word: string): string {
  return `"${word.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`)}"`;
}
