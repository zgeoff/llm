import { expect, test } from 'bun:test';
import { buildBackupPath } from './build-backup-path.ts';

test('it names the backup with the UTC stamp and the reason', () => {
  const path = buildBackupPath('/x/config.json', new Date('2026-11-02T14:21:36.123Z'), 'profile-a');

  expect(path).toBe('/x/config.json.bak-20261102T142136Z-profile-a');
});
