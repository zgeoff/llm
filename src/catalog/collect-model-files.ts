import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { buildModelFolderPath } from './build-model-folder-path.ts';
import type { Machine, Model } from './types.ts';

interface ModelFile {
  readonly kind: 'model' | 'projector';
  readonly fileName: string;
  readonly path: string;
}

// The files that make up a model: the weights and, when the entry has one, the vision projector.
export function collectModelFiles(machine: Machine, model: Model): ModelFile[] {
  const folder = buildModelFolderPath(machine, model);

  return [
    { kind: 'model', fileName: model.file, path: joinWindowsPath(folder, model.file) },
    ...(model.mmproj === undefined
      ? []
      : [
          {
            kind: 'projector' as const,
            fileName: model.mmproj,
            path: joinWindowsPath(folder, model.mmproj),
          },
        ]),
  ];
}
