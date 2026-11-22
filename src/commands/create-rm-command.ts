import { rm } from 'node:fs/promises';
import { define } from 'gunshi';
import { buildModelPath } from '../catalog/build-model-path.ts';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { formatBytes } from '../format/format-bytes.ts';
import { readFileSize } from '../host/read-file-size.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

export function createRmCommand(dependencies: CLIDependencies) {
  return define({
    name: 'rm',
    description: 'Delete a downloaded model and its checksum sidecar',
    args: {
      id: { type: 'positional', description: 'The model id from models.yaml' },
      yes: { type: 'boolean', description: 'Confirm the deletion' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const windowsPath = buildModelPath(catalog.machine, getModel(catalog, ctx.values.id));
      const path = toWSLPath(windowsPath, dependencies.mountRoot);

      const size = await readFileSize(path);

      if (size === null) {
        dependencies.print(`${ctx.values.id} is not on disk at ${windowsPath}`);

        return;
      }

      dependencies.print(`${windowsPath} (${formatBytes(size)})`);

      if (ctx.values.yes !== true) {
        throw new CLIError(`pass --yes to delete ${ctx.values.id}`);
      }

      await rm(path);
      await rm(`${path}.sha256`, { force: true });

      dependencies.print(`deleted ${ctx.values.id}`);
    },
  });
}
