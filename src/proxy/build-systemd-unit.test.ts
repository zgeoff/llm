import { expect, test } from 'bun:test';
import { buildSystemdUnit } from './build-systemd-unit.ts';

test('it starts the proxy from the checkout with the given Bun', () => {
  const unit = buildSystemdUnit({ bunPath: '/opt/bun/bin/bun', repoRoot: '/home/test/llm/' });

  expect(unit).toContain(
    'ExecStart="/opt/bun/bin/bun" "/home/test/llm/src/cli.ts" "proxy" "run"\n',
  );

  expect(unit).toContain('WantedBy=default.target');
});

test('it quotes a path with a space', () => {
  const unit = buildSystemdUnit({ bunPath: '/bin/bun', repoRoot: '/home/my user/llm/' });

  expect(unit).toContain('"/home/my user/llm/src/cli.ts"');
});
