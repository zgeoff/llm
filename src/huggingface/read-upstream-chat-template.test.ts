import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { readUpstreamChatTemplate } from './read-upstream-chat-template.ts';

function setupTest() {
  const jinjaURL = 'https://huggingface.co/example-org/upstream/raw/main/chat_template.jinja';
  const configURL = 'https://huggingface.co/example-org/upstream/raw/main/tokenizer_config.json';

  return { jinjaURL, configURL };
}

test('it reads chat_template.jinja first', async () => {
  const ctx = setupTest();

  network.use(http.get(ctx.jinjaURL, () => HttpResponse.text('{{ jinja }}')));

  const result = await readUpstreamChatTemplate('example-org/upstream');

  expect(result).toStrictEqual({
    status: 'found',
    template: '{{ jinja }}',
    source: 'chat_template.jinja',
  });
});

test('it falls back to the chat template string of tokenizer_config.json', async () => {
  const ctx = setupTest();

  network.use(
    http.get(ctx.jinjaURL, () => new HttpResponse(null, { status: 404 })),
    http.get(ctx.configURL, () => HttpResponse.json({ chat_template: '{{ config }}' })),
  );

  const result = await readUpstreamChatTemplate('example-org/upstream');

  expect(result).toStrictEqual({
    status: 'found',
    template: '{{ config }}',
    source: 'tokenizer_config.json',
  });
});

test('it picks the default template from a list of named templates', async () => {
  const ctx = setupTest();

  network.use(
    http.get(ctx.jinjaURL, () => new HttpResponse(null, { status: 404 })),
    http.get(ctx.configURL, () =>
      HttpResponse.json({
        chat_template: [
          { name: 'tool_use', template: '{{ tools }}' },
          { name: 'default', template: '{{ default }}' },
        ],
      }),
    ),
  );

  const result = await readUpstreamChatTemplate('example-org/upstream');

  expect(result).toMatchObject({ status: 'found', template: '{{ default }}' });
});

test('it reports a repo with no chat template as missing', async () => {
  const ctx = setupTest();

  network.use(
    http.get(ctx.jinjaURL, () => new HttpResponse(null, { status: 404 })),
    http.get(ctx.configURL, () => HttpResponse.json({ model_max_length: 1024 })),
  );

  const result = await readUpstreamChatTemplate('example-org/upstream');

  expect(result).toStrictEqual({
    status: 'missing',
  });
});

test('it reports a failed request instead of throwing', async () => {
  const ctx = setupTest();

  network.use(http.get(ctx.jinjaURL, () => new HttpResponse(null, { status: 503 })));

  const result = await readUpstreamChatTemplate('example-org/upstream');

  expect(result).toStrictEqual({
    status: 'failed',
    reason: 'Hugging Face answered 503',
  });
});

test('it reports a dropped connection as a failure', async () => {
  const ctx = setupTest();

  network.use(http.get(ctx.jinjaURL, () => HttpResponse.error()));

  const result = await readUpstreamChatTemplate('example-org/upstream');

  expect(result).toMatchObject({
    status: 'failed',
  });
});
