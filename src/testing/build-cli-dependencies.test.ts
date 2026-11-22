import { expect, test } from 'bun:test';
import { buildCLIDependencies } from './build-cli-dependencies.ts';

test('it maps a WSL path to a path under the WSL share', async () => {
  const dependencies = buildCLIDependencies();

  const windowsPath = await dependencies.readWindowsPath('/home/test/repo/templates');

  expect(windowsPath).toBe(String.raw`\\wsl.localhost\Test\home\test\repo\templates`);
});

test('it replaces the fields it is given and keeps the others', () => {
  const dependencies = buildCLIDependencies({ mountRoot: '/tmp/mnt' });

  expect(dependencies.mountRoot).toBe('/tmp/mnt');
  expect(dependencies.repoRoot).toBe('/nonexistent/repo');
});
