import { define } from 'gunshi';
import { buildModelFolderPath } from '../catalog/build-model-folder-path.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { formatBytes } from '../format/format-bytes.ts';
import { formatTable } from '../format/format-table.ts';
import { readDriveUsage } from '../host/read-drive-usage.ts';
import { readFolderSize } from '../host/read-folder-size.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

export function createDiskCommand(dependencies: CLIDependencies) {
  return define({
    name: 'disk',
    description:
      'Show the free and used space of the models drive and the size of each model folder',
    run: async () => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const drive = catalog.machine.modelsDir.slice(0, 2).toUpperCase();
      const driveMount = toWSLPath(drive, dependencies.mountRoot);

      const usage = await readDriveUsage(driveMount).catch((error: unknown) => {
        throw new CLIError(
          `cannot read the space of drive ${drive} at ${driveMount}: ${String(error)}`,
        );
      });

      // Models of one repo share its folder, so each folder is listed once.
      const folders = new Map<string, string>();

      for (const model of Object.values(catalog.models)) {
        folders.set(model.repo, buildModelFolderPath(catalog.machine, model));
      }

      const rows = await Promise.all(
        [...folders].map(async ([repo, folder]) => {
          const size = await readFolderSize(toWSLPath(folder, dependencies.mountRoot));

          return [repo, size === null ? '-' : formatBytes(size)];
        }),
      );

      dependencies.print(
        [
          `Drive ${drive} ${formatBytes(usage.usedBytes)} used, ${formatBytes(usage.freeBytes)} free of ${formatBytes(usage.totalBytes)}`,
          '',
          formatTable(['FOLDER', 'SIZE'], rows),
        ].join('\n'),
      );
    },
  });
}
