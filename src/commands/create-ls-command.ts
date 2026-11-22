import { define } from 'gunshi';
import { collectModelFiles } from '../catalog/collect-model-files.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { formatBytes } from '../format/format-bytes.ts';
import { formatTable } from '../format/format-table.ts';
import { readFileSize } from '../host/read-file-size.ts';
import { readSHA256Sidecar } from '../host/read-sha256-sidecar.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

export function createLsCommand(dependencies: CLIDependencies) {
  return define({
    name: 'ls',
    description: 'List the catalog models with their size on disk and checksum state',
    run: async () => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const rows = await Promise.all(
        Object.entries(catalog.models).map(async ([id, model]) => {
          const files = await Promise.all(
            collectModelFiles(catalog.machine, model).map(async (file) => {
              const path = toWSLPath(file.path, dependencies.mountRoot);

              const [size, digest] = await Promise.all([
                readFileSize(path),
                readSHA256Sidecar(path),
              ]);

              return { size, digest };
            }),
          );

          // The projector is part of the model, so a missing file leaves the size a dash and
          // every file needs its checksum for the model to count as checked.
          const sizes = files.map((file) => file.size);

          const total = sizes.every((size) => size !== null)
            ? sizes.reduce((sum, size) => sum + size, 0)
            : null;

          const checked = files.every((file) => file.digest !== null);

          return [
            id,
            model.tags.join(',') || '-',
            model.backend,
            total === null ? '-' : formatBytes(total),
            checked ? 'yes' : '-',
          ];
        }),
      );

      dependencies.print(formatTable(['ID', 'TAGS', 'BACKEND', 'SIZE', 'SHA CHECKED'], rows));
    },
  });
}
