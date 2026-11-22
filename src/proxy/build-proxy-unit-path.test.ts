import { expect, test } from 'bun:test';
import { buildProxyUnitPath } from './build-proxy-unit-path.ts';

test('it puts the unit in the systemd user folder of the home', () => {
  expect(buildProxyUnitPath('/home/test')).toBe(
    '/home/test/.config/systemd/user/llm-proxy.service',
  );
});
