import { join } from 'node:path';
import { define } from 'gunshi';
import { z } from 'zod';
import { buildModelPath } from '../catalog/build-model-path.ts';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { Machine, Model } from '../catalog/types.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { readGGUFMetadata } from '../gguf/read-gguf-metadata.ts';
import { readFileSize } from '../host/read-file-size.ts';
import { buildAgentLabel } from '../profile/build-agent-label.ts';
import { buildATCAgent } from '../profile/build-atc-agent.ts';
import { buildBackupPath } from '../profile/build-backup-path.ts';
import { isProfileAgent } from '../profile/is-profile-agent.ts';
import { readATCConfig } from '../profile/read-atc-config.ts';
import { writeATCConfig } from '../profile/write-atc-config.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

const agentNamePattern = /^[a-z0-9][a-z0-9.-]*$/u;
const templateAgentName = 'abliteration-bare';
const restartNotice = 'restart the atc daemon to load it';
const settingsSchema = z.looseObject({ settings: z.record(z.string(), z.unknown()) });

export function createProfileCommand(dependencies: CLIDependencies) {
  return define({
    name: 'profile',
    description: 'Add an atc agent that runs Claude Code against a catalog model through the proxy',
    args: {
      id: { type: 'positional', required: false, description: 'The model id from models.yaml' },
      name: { type: 'string', description: 'The agent name, local-<id> by default' },
      force: { type: 'boolean', description: 'Overwrite an agent of the same name' },
      rm: { type: 'string', description: 'Remove the agent of this name that a profile wrote' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);
      const config = await readATCConfig(dependencies.atcConfigPath);

      if (ctx.values.rm !== undefined) {
        const name = ctx.values.rm;

        if (!isProfileAgent(config.agents[name])) {
          throw new CLIError(`agent "${name}" is not one that llm profile wrote`);
        }

        const { [name]: _removed, ...agents } = config.agents;

        const backupPath = buildBackupPath(
          dependencies.atcConfigPath,
          new Date(dependencies.clock.now()),
          `profile-rm-${name}`,
        );

        await writeATCConfig(dependencies.atcConfigPath, backupPath, { ...config, agents });

        dependencies.print(`removed agent ${name} (backup ${backupPath})\n${restartNotice}`);

        return;
      }

      const modelID = ctx.values.id;

      if (modelID === undefined) {
        throw new CLIError('name a model id, or pass --rm <name>');
      }

      const model = getModel(catalog, modelID);
      const name = ctx.values.name ?? `local-${modelID}`;

      if (!agentNamePattern.test(name)) {
        throw new CLIError(
          `"${name}" is not an agent name: use lowercase letters, digits, . and -`,
        );
      }

      if (Object.hasOwn(config.agents, name) && ctx.values.force !== true) {
        throw new CLIError(`agent "${name}" exists; pass --force to overwrite it`);
      }

      const proxyURL = `http://127.0.0.1:${catalog.machine.proxy.port}`;
      const template = settingsSchema.safeParse(config.agents[templateAgentName]);

      const label = buildAgentLabel({
        modelID,
        model,
        readsReasoningEffort: await readsReasoningEffort(
          dependencies,
          catalog.machine,
          modelID,
          model,
        ),
      });

      const agent = buildATCAgent({
        modelID,
        label,
        model,
        proxyURL,
        homeDir: dependencies.homeDir,
        settings: template.success ? template.data.settings : undefined,
      });

      const backupPath = buildBackupPath(
        dependencies.atcConfigPath,
        new Date(dependencies.clock.now()),
        `profile-${modelID}`,
      );

      await writeATCConfig(dependencies.atcConfigPath, backupPath, {
        ...config,
        agents: { ...config.agents, [name]: agent },
      });

      dependencies.print(`wrote agent ${name} (backup ${backupPath})\n${restartNotice}`);
    },
  });
}

// The template is the catalog's chat template file when it sets one, else the one in the GGUF.
async function readsReasoningEffort(
  dependencies: CLIDependencies,
  machine: Machine,
  modelID: string,
  model: Model,
): Promise<boolean> {
  if (model.chatTemplateFile !== undefined) {
    const fileName = model.chatTemplateFile.split('\\').at(-1) ?? '';
    const templateFile = Bun.file(join(dependencies.repoRoot, 'templates', fileName));

    if (!(await templateFile.exists())) {
      throw new CLIError(`${modelID} names templates/${fileName}, which is not in the repo`);
    }

    const text = await templateFile.text();

    return text.includes('reasoning_effort');
  }

  const path = toWSLPath(buildModelPath(machine, model), dependencies.mountRoot);

  if ((await readFileSize(path)) === null) {
    throw new CLIError(`${modelID} is not on disk at ${path}; run llm pull ${modelID}`);
  }

  const metadata = await readGGUFMetadata(path);

  const template = metadata.values.get('tokenizer.chat_template');

  return typeof template === 'string' && template.includes('reasoning_effort');
}
