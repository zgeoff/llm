import { z } from 'zod';

type UpstreamChatTemplate =
  | { readonly status: 'found'; readonly template: string; readonly source: string }
  | { readonly status: 'missing' }
  | { readonly status: 'failed'; readonly reason: string };

const namedTemplateSchema = z.object({ name: z.string(), template: z.string() });
const templateListSchema = z.array(namedTemplateSchema);

const tokenizerConfigSchema = z.object({
  chat_template: z.union([z.string(), templateListSchema]).optional(),
});

// chat_template.jinja wins when a repo has both, as it does in transformers.
export async function readUpstreamChatTemplate(repo: string): Promise<UpstreamChatTemplate> {
  try {
    const jinja = await fetch(`https://huggingface.co/${repo}/raw/main/chat_template.jinja`);

    if (jinja.ok) {
      const template = await jinja.text();

      return { status: 'found', template, source: 'chat_template.jinja' };
    }

    if (jinja.status !== 404) {
      return { status: 'failed', reason: `Hugging Face answered ${jinja.status}` };
    }

    const config = await fetch(`https://huggingface.co/${repo}/raw/main/tokenizer_config.json`);

    if (config.status === 404) {
      return { status: 'missing' };
    }

    if (!config.ok) {
      return { status: 'failed', reason: `Hugging Face answered ${config.status}` };
    }

    const json: unknown = await config.json();

    const parsed = tokenizerConfigSchema.safeParse(json);
    const template = parsed.success ? parsed.data.chat_template : undefined;

    if (template === undefined) {
      return { status: 'missing' };
    }

    // A list holds named templates, and `default` is the one that chat requests use.
    const text =
      typeof template === 'string'
        ? template
        : (template.find((entry) => entry.name === 'default') ?? template[0])?.template;

    return text === undefined
      ? { status: 'missing' }
      : { status: 'found', template: text, source: 'tokenizer_config.json' };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}
