import { expect, test } from 'bun:test';
import { parseAutostartStatus } from './parse-autostart-status.ts';

test('it parses an unregistered status', () => {
  expect(parseAutostartStatus('{"registered":false}')).toStrictEqual({ registered: false });
});

test('it parses a registered status', () => {
  const status = parseAutostartStatus(
    '{"registered":true,"state":"Ready","lastRunTime":"never","lastTaskResult":0}\n',
  );

  expect(status).toStrictEqual({
    registered: true,
    state: 'Ready',
    lastRunTime: 'never',
    lastTaskResult: 0,
  });
});

test('it rejects a registered status without a state', () => {
  expect(() => parseAutostartStatus('{"registered":true}')).toThrow();
});
