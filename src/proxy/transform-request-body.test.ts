import { expect, test } from 'bun:test';
import { transformRequestBody } from './transform-request-body.ts';

function setupTest() {
  return {
    identityLine: "You are Claude Code, Anthropic's official CLI for Claude.",
    transform: (body: unknown, pathname = '/v1/messages'): unknown => {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      const output: unknown = JSON.parse(transformRequestBody(text, pathname));

      return output;
    },
    transformText: (text: string, pathname = '/v1/messages') =>
      transformRequestBody(text, pathname),
  };
}

test('it drops the billing header and identity blocks and keeps the persona', () => {
  const ctx = setupTest();

  const result = ctx.transform({
    model: 'example-model',
    system: [
      { type: 'text', text: 'x-anthropic-billing-header: cc_version=1; cch=abc;' },
      { type: 'text', text: ctx.identityLine },
      { type: 'text', text: 'You are a pirate.' },
    ],
  });

  expect(result).toStrictEqual({
    model: 'example-model',
    system: [{ type: 'text', text: 'You are a pirate.' }],
  });
});

test('it drops the Agent SDK identity lines too', () => {
  const ctx = setupTest();

  const result = ctx.transform(
    {
      system: [
        { type: 'text', text: "You are a Claude agent, built on Anthropic's Claude Agent SDK." },
        { type: 'text', text: 'Persona' },
      ],
    },
    '/v1/chat/completions',
  );

  expect(result).toStrictEqual({ system: [{ type: 'text', text: 'Persona' }] });
});

test('it keeps a block that only mentions the identity line', () => {
  const ctx = setupTest();

  const body = JSON.stringify({
    system: [{ type: 'text', text: `${ctx.identityLine} Be brief.` }],
  });

  expect(ctx.transformText(body)).toBe(body);
});

test('it leaves a string system prompt alone', () => {
  const ctx = setupTest();
  const body = JSON.stringify({ system: 'You are a pirate.' });

  expect(ctx.transformText(body)).toBe(body);
});

test('it returns a body that is not JSON as it is', () => {
  const ctx = setupTest();

  expect(ctx.transformText('not json')).toBe('not json');
});

test('it returns a JSON body that is not an object as it is', () => {
  const ctx = setupTest();

  expect(ctx.transformText('[1,2]')).toBe('[1,2]');
});

test.each([
  ['low', 'low', 1024],
  ['medium', 'medium', 4096],
  ['high', 'xhigh', 8192],
])(
  'it maps the effort %s to reasoning_effort %s and a budget of %d',
  (effort, reasoningEffort, budget) => {
    const ctx = setupTest();
    const result = ctx.transform({ output_config: { effort }, thinking: { type: 'adaptive' } });

    expect(result).toStrictEqual({
      output_config: { effort },
      thinking: { type: 'adaptive' },
      chat_template_kwargs: { reasoning_effort: reasoningEffort },
      extra_params: {
        reasoning_budget_tokens: budget,
        reasoning_budget_message:
          '\n\nI have used my thinking budget, so I will answer now with what I have.\n',
      },
    });
  },
);

test.each(['xhigh', 'max'])('it leaves the thinking unbounded at effort %s', (effort) => {
  const ctx = setupTest();
  const result = ctx.transform({ output_config: { effort } });

  expect(result).toStrictEqual({
    output_config: { effort },
    chat_template_kwargs: { reasoning_effort: 'xhigh' },
  });
});

test('it keeps a reasoning_budget_message the client sent', () => {
  const ctx = setupTest();

  const result = ctx.transform({
    output_config: { effort: 'low' },
    extra_params: { reasoning_budget_message: 'Out of thinking time.' },
  });

  expect(result).toStrictEqual({
    output_config: { effort: 'low' },
    chat_template_kwargs: { reasoning_effort: 'low' },
    extra_params: {
      reasoning_budget_message: 'Out of thinking time.',
      reasoning_budget_tokens: 1024,
    },
  });
});

test('it sets no budget message when the thinking is unbounded', () => {
  const ctx = setupTest();
  const result = ctx.transform({ output_config: { effort: 'xhigh' } });

  expect(result).not.toHaveProperty('extra_params');
});

test('it keeps the extra_params the client sent', () => {
  const ctx = setupTest();
  const result = ctx.transform({ output_config: { effort: 'low' }, extra_params: { seed: 7 } });

  expect(result).toStrictEqual({
    output_config: { effort: 'low' },
    chat_template_kwargs: { reasoning_effort: 'low' },
    extra_params: {
      seed: 7,
      reasoning_budget_tokens: 1024,
      reasoning_budget_message:
        '\n\nI have used my thinking budget, so I will answer now with what I have.\n',
    },
  });
});

test('it keeps the chat_template_kwargs the client sent', () => {
  const ctx = setupTest();

  const result = ctx.transform({
    output_config: { effort: 'low' },
    chat_template_kwargs: { enable_thinking: true },
  });

  expect(result).toStrictEqual({
    output_config: { effort: 'low' },
    chat_template_kwargs: { enable_thinking: true, reasoning_effort: 'low' },
    extra_params: {
      reasoning_budget_tokens: 1024,
      reasoning_budget_message:
        '\n\nI have used my thinking budget, so I will answer now with what I have.\n',
    },
  });
});

test('it leaves a request with no effort unchanged', () => {
  const ctx = setupTest();
  const body = JSON.stringify({ model: 'example-model', output_config: { format: 'json' } });

  expect(ctx.transformText(body)).toBe(body);
});

test('it leaves an effort it does not know unchanged', () => {
  const ctx = setupTest();
  const body = JSON.stringify({ output_config: { effort: 'minimal' } });

  expect(ctx.transformText(body)).toBe(body);
});

test('it maps the effort only on /v1/messages', () => {
  const ctx = setupTest();
  const body = JSON.stringify({ output_config: { effort: 'low' } });

  expect(ctx.transformText(body, '/v1/messages/count_tokens')).toBe(body);
});

test('it maps the effort when the client sends null extra_params and chat_template_kwargs', () => {
  const ctx = setupTest();

  const result = ctx.transform({
    output_config: { effort: 'low' },
    extra_params: null,
    chat_template_kwargs: null,
  });

  expect(result).toStrictEqual({
    output_config: { effort: 'low' },
    chat_template_kwargs: { reasoning_effort: 'low' },
    extra_params: {
      reasoning_budget_tokens: 1024,
      reasoning_budget_message:
        '\n\nI have used my thinking budget, so I will answer now with what I have.\n',
    },
  });
});
