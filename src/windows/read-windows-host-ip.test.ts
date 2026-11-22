import { expect, test } from 'bun:test';
import { readWindowsHostIP } from './read-windows-host-ip.ts';

test('it returns the gateway of the default route', async () => {
  const ip = await readWindowsHostIP(() =>
    Promise.resolve('default via 172.28.80.1 dev eth0 proto kernel\n'),
  );

  expect(ip).toBe('172.28.80.1');
});

test('it reads the route again on every call', async () => {
  const routes = ['default via 172.28.80.1 dev eth0\n', 'default via 172.19.0.1 dev eth0\n'];
  const readDefaultRoute = () => Promise.resolve(routes.shift() ?? '');

  const first = await readWindowsHostIP(readDefaultRoute);
  const second = await readWindowsHostIP(readDefaultRoute);

  expect([first, second]).toStrictEqual(['172.28.80.1', '172.19.0.1']);
});

test('it rejects a route table with no default route', () => {
  expect(readWindowsHostIP(() => Promise.resolve('10.0.0.0/24 dev eth0\n'))).rejects.toThrow(
    'cannot find the Windows host in the default route',
  );
});
