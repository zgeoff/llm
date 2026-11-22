import { z } from 'zod';

// Rewrites a request body for a local model: it drops the system blocks that Claude Code adds
// before the persona, and on POST /v1/messages it maps the effort to the template's
// reasoning_effort and to a thinking budget. A body that is not a JSON object comes back as it is.
export function transformRequestBody(body: string, pathname: string): string {
  const parsed = parseRequest(body);

  if (parsed === null) {
    return body;
  }

  const stripped = stripCLIBlocks(parsed);
  const mapped = pathname === '/v1/messages' ? mapEffort(stripped) : stripped;

  return mapped === parsed ? body : JSON.stringify(mapped);
}

const requestSchema = z.looseObject({
  system: z.unknown().optional(),
  output_config: z.looseObject({ effort: z.unknown().optional() }).optional(),

  // llama-server ignores either one when it is not an object, so any value passes here.
  chat_template_kwargs: z.unknown().optional(),
  extra_params: z.unknown().optional(),
});

type MessagesRequest = z.infer<typeof requestSchema>;

function parseRequest(body: string): MessagesRequest | null {
  try {
    const result = requestSchema.safeParse(JSON.parse(body));

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function stripCLIBlocks(request: MessagesRequest): MessagesRequest {
  if (!Array.isArray(request.system)) {
    return request;
  }

  const kept: unknown[] = request.system.filter((block: unknown) => !isCLIBlock(block));

  return kept.length === request.system.length ? request : { ...request, system: kept };
}

const billingHeaderPrefix = 'x-anthropic-billing-header:';

const cliIdentityLines: ReadonlySet<string> = new Set([
  "You are Claude Code, Anthropic's official CLI for Claude.",
  "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
  "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
]);

const textBlockSchema = z.looseObject({ text: z.string() });

function isCLIBlock(block: unknown): boolean {
  const parsed = textBlockSchema.safeParse(block);

  return (
    parsed.success &&
    (parsed.data.text.startsWith(billingHeaderPrefix) || cliIdentityLines.has(parsed.data.text))
  );
}

interface EffortSetting {
  readonly reasoningEffort: string;

  // null leaves the thinking unbounded.
  readonly budgetTokens: number | null;
}

// The Tiel-Coder and Cyber-Tiel templates read reasoning_effort, the Qwen3.6 and Gemma 4 templates
// do not, so the effort also sets llama-server's thinking budget. The Anthropic endpoint passes
// `extra_params` into the request (tools/server/server-chat.cpp, b12038).
const settingByEffort: ReadonlyMap<string, EffortSetting> = new Map([
  ['low', { reasoningEffort: 'low', budgetTokens: 1024 }],
  ['medium', { reasoningEffort: 'medium', budgetTokens: 4096 }],
  ['high', { reasoningEffort: 'xhigh', budgetTokens: 8192 }],
  ['xhigh', { reasoningEffort: 'xhigh', budgetTokens: null }],
  ['max', { reasoningEffort: 'xhigh', budgetTokens: null }],
]);

// llama.cpp inserts this text before the forced end-of-thinking tag, so the model answers cleanly
// when the budget runs out (`reasoning_budget_message`, tools/server/server-common.cpp, b12038).
const budgetMessage =
  '\n\nI have used my thinking budget, so I will answer now with what I have.\n';

function mapEffort(request: MessagesRequest): MessagesRequest {
  const effort = request.output_config?.effort;
  const setting = typeof effort === 'string' ? settingByEffort.get(effort) : undefined;

  if (setting === undefined) {
    return request;
  }

  return {
    ...request,
    chat_template_kwargs: {
      ...readFields(request.chat_template_kwargs),
      reasoning_effort: setting.reasoningEffort,
    },
    ...(setting.budgetTokens === null
      ? {}
      : {
          extra_params: {
            reasoning_budget_message: budgetMessage,
            ...readFields(request.extra_params),
            reasoning_budget_tokens: setting.budgetTokens,
          },
        }),
  };
}

const fieldsSchema = z.record(z.string(), z.unknown());

function readFields(value: unknown): Record<string, unknown> {
  const parsed = fieldsSchema.safeParse(value);

  return parsed.success ? parsed.data : {};
}
