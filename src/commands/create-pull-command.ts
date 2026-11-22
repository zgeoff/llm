import { define } from 'gunshi';
import { buildModelFolderPath } from '../catalog/build-model-folder-path.ts';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { formatBytes } from '../format/format-bytes.ts';
import { readDriveUsage } from '../host/read-drive-usage.ts';
import { readFileSize } from '../host/read-file-size.ts';
import { buildPullScript } from '../huggingface/build-pull-script.ts';
import type { PullTarget } from '../huggingface/build-pull-script.ts';
import { readRepoFiles } from '../huggingface/read-repo-files.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

export function createPullCommand(dependencies: CLIDependencies) {
  return define({
    name: 'pull',
    description: 'Download a model to the models drive and check it against its SHA256',
    args: {
      id: { type: 'positional', description: 'The model id from models.yaml' },
      mmproj: { type: 'boolean', description: 'Also download the multimodal projector file' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const model = getModel(catalog, ctx.values.id);

      if (ctx.values.mmproj === true && model.mmproj === undefined) {
        throw new CLIError(`${ctx.values.id} has no mmproj file in the catalog`);
      }

      const files = [
        model.file,
        ...(ctx.values.mmproj === true && model.mmproj !== undefined ? [model.mmproj] : []),
      ];

      const listed = await readRepoFiles(model.repo);

      const folder = buildModelFolderPath(catalog.machine, model);

      const targets: PullTarget[] = files.map((file) => {
        const entry = listed.get(file);

        if (entry === undefined) {
          throw new CLIError(`${model.repo} has no LFS file named ${file}`);
        }

        return {
          folder,
          file,
          url: `https://huggingface.co/${model.repo}/resolve/main/${encodeURIComponent(file)}`,
          sizeBytes: entry.sizeBytes,
          sha256: entry.sha256,
        };
      });

      await checkFreeSpace(dependencies, catalog.machine.modelsDir, targets);

      for (const target of targets) {
        dependencies.print(
          `Pulling ${target.file} (${formatBytes(target.sizeBytes)}) to ${joinWindowsPath(target.folder, target.file)}`,
        );

        const result = await dependencies.runPowerShell(buildPullScript(target));

        if (result.exitCode !== 0) {
          throw new CLIError(`pulling ${target.file} failed: ${result.stderr.trim()}`);
        }

        dependencies.print(result.stdout.trim());
      }
    },
  });
}

// A partial file from an earlier pull counts as space already taken.
async function checkFreeSpace(
  dependencies: CLIDependencies,
  modelsDir: string,
  targets: readonly PullTarget[],
): Promise<void> {
  const remaining = await Promise.all(
    targets.map(async (target) => {
      const path = toWSLPath(joinWindowsPath(target.folder, target.file), dependencies.mountRoot);

      const existing = await readFileSize(path);

      return Math.max(0, target.sizeBytes - (existing ?? 0));
    }),
  );

  const spareBytes = 5 * 1024 ** 3;
  const needed = remaining.reduce((total, bytes) => total + bytes, 0) + spareBytes;
  const drive = modelsDir.slice(0, 2).toUpperCase();

  const usage = await readDriveUsage(toWSLPath(drive, dependencies.mountRoot));

  if (usage.freeBytes < needed) {
    throw new CLIError(
      `drive ${drive} has ${formatBytes(usage.freeBytes)} free and the pull needs ${formatBytes(needed)} (the files plus 5 GiB spare)`,
    );
  }
}
