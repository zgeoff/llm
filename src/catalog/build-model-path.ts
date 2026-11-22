import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { buildModelFolderPath } from './build-model-folder-path.ts';
import type { Machine, Model } from './types.ts';

export function buildModelPath(machine: Machine, model: Pick<Model, 'repo' | 'file'>): string {
  return joinWindowsPath(buildModelFolderPath(machine, model), model.file);
}
