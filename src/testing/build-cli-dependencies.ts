import type { FakeClock } from '@zgeoff/testing/clock';
import { createFakeClock } from '@zgeoff/testing/clock';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { buildFakePowerShell } from './build-fake-powershell.ts';

// Dependencies that reach nothing: PowerShell answers with an empty success, the host is
// 172.28.80.1, and the health poll gives up after 50 ms of fake clock time. A test overrides what it checks.
export function buildCLIDependencies(
  overrides: Partial<Omit<CLIDependencies, 'clock'>> = {},
): CLIDependencies & { readonly clock: FakeClock } {
  return {
    catalogPath: '/nonexistent/models.yaml',
    mountRoot: '/nonexistent/mnt',
    repoRoot: '/nonexistent/repo',
    print: () => {},
    runPowerShell: buildFakePowerShell().run,
    readDefaultRoute: () => Promise.resolve('default via 172.28.80.1 dev eth0 proto kernel\n'),
    readWindowsPath: (wslPath) =>
      Promise.resolve(String.raw`\\wsl.localhost\Test${wslPath.replaceAll('/', '\\')}`),
    runProcess: () => Promise.resolve({ exitCode: 0, stdout: '', stderr: '' }),
    homeDir: '/nonexistent/home',
    bunPath: '/nonexistent/bin/bun',
    atcConfigPath: '/nonexistent/atc/config.json',
    clock: createFakeClock({ startMs: Date.UTC(2026, 10, 3, 10, 20, 30) }),
    healthPoll: { intervalMs: 1, timeoutMs: 50 },
    ...overrides,
  };
}
