import { expect, test } from 'bun:test';
import { formatAutostartStatus } from './format-autostart-status.ts';

test('it says autostart is off when no task is registered', () => {
  expect(formatAutostartStatus({ registered: false })).toBe(
    'autostart is off: no Scheduled Task is registered',
  );
});

test('it shows the state and the last run of a registered task', () => {
  const text = formatAutostartStatus({
    registered: true,
    state: 'Ready',
    lastRunTime: 'never',
    lastTaskResult: 0,
  });

  expect(text).toBe('autostart is on: the task is Ready\nlast run   never\nlast exit  0');
});
