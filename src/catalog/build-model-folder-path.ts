import { joinWindowsPath } from '../windows/join-windows-path.ts';
import type { Machine, Model } from './types.ts';

export function buildModelFolderPath(machine: Machine, model: Pick<Model, 'repo'>): string {
  const [owner = '', name = ''] = model.repo.split('/');

  return joinWindowsPath(machine.modelsDir, owner, name);
}
