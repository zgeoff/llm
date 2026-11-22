import { define } from 'gunshi';
import { buildModelPath } from '../catalog/build-model-path.ts';
import { getModel } from '../catalog/get-model.ts';
import { readCatalog } from '../catalog/read-catalog.ts';
import type { CLIDependencies } from '../cli-dependencies.ts';
import { CLIError } from '../cli-error.ts';
import { formatModelInspection } from '../format/format-model-inspection.ts';
import { formatUnifiedDiff } from '../format/format-unified-diff.ts';
import { buildKVCacheCost } from '../gguf/build-kv-cache-cost.ts';
import { buildModelSummary } from '../gguf/build-model-summary.ts';
import { readGGUFMetadata } from '../gguf/read-gguf-metadata.ts';
import { readFileSize } from '../host/read-file-size.ts';
import { readUpstreamChatTemplate } from '../huggingface/read-upstream-chat-template.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

export function createInspectCommand(dependencies: CLIDependencies) {
  return define({
    name: 'inspect',
    description: 'Show the GGUF metadata, the KV cache cost and the chat template of a model',
    args: {
      id: { type: 'positional', description: 'The model id from models.yaml' },
    },
    run: async (ctx) => {
      const catalog = await readCatalog(dependencies.catalogPath);

      const model = getModel(catalog, ctx.values.id);
      const path = toWSLPath(buildModelPath(catalog.machine, model), dependencies.mountRoot);

      if ((await readFileSize(path)) === null) {
        throw new CLIError(
          `${ctx.values.id} is not on disk at ${path}; run llm pull ${ctx.values.id}`,
        );
      }

      const metadata = await readGGUFMetadata(path);

      const summary = buildModelSummary(metadata.values);

      const lines = [
        `${ctx.values.id}: ${model.repo}/${model.file}`,
        formatModelInspection(summary, buildKVCacheCost(summary)),
        '',
        await compareChatTemplate(summary.chatTemplate, model.upstream),
      ];

      dependencies.print(lines.join('\n'));
    },
  });
}

async function compareChatTemplate(
  template: string | null,
  upstream: string | undefined,
): Promise<string> {
  if (template === null) {
    return 'Chat template: the file has none';
  }

  const heading = `Chat template: ${template.length} characters`;

  if (upstream === undefined) {
    return `${heading}; the catalog sets no upstream repo to compare it with`;
  }

  const result = await readUpstreamChatTemplate(upstream);

  if (result.status === 'missing') {
    return `${heading}; ${upstream} has no chat template to compare with`;
  }

  if (result.status === 'failed') {
    return `${heading}; cannot compare with ${upstream}: ${result.reason}`;
  }

  const diff = formatUnifiedDiff(result.template.trimEnd(), template.trimEnd(), {
    before: `${upstream} ${result.source}`,
    after: 'tokenizer.chat_template',
  });

  return diff === ''
    ? `${heading}; template matches upstream`
    : `${heading}; differs from upstream\n${diff}`;
}
