import { expect, onTestFinished, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { buildCatalog } from '../testing/build-catalog.ts';
import { network } from '../testing/network.ts';
import { createProxyServer } from './create-proxy-server.ts';

function setupTest(initialRoute = 'default via 172.28.80.1 dev eth0\n') {
  let route = initialRoute;

  const proxy = createProxyServer({
    machine: buildCatalog().machine,
    readDefaultRoute: () => Promise.resolve(route),
    port: 0,
  });

  onTestFinished(() => proxy.stop(true));

  return {
    base: `http://127.0.0.1:${proxy.port}`,
    changeRoute: (next: string) => {
      route = next;
    },
  };
}

test('it forwards a POST to llama-swap with the transformed body', async () => {
  const ctx = setupTest();
  const received: unknown[] = [];

  network.use(
    http.post('http://172.28.80.1:8181/v1/messages', async (info) => {
      const payload: unknown = await info.request.json();

      received.push(payload);

      return HttpResponse.json({ ok: true });
    }),
  );

  const response = await fetch(`${ctx.base}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system: [{ type: 'text', text: 'x-anthropic-billing-header: cch=1;' }],
      output_config: { effort: 'max' },
    }),
  });

  const reply: unknown = await response.json();

  expect(reply).toStrictEqual({ ok: true });

  expect(received).toStrictEqual([
    {
      system: [],
      output_config: { effort: 'max' },
      chat_template_kwargs: { reasoning_effort: 'xhigh' },
    },
  ]);
});

test.each(['PUT', 'PATCH', 'DELETE'] as const)('it forwards the body of a %s', async (method) => {
  const ctx = setupTest();
  const received: string[] = [];

  network.use(
    http.all('http://172.28.80.1:8181/v1/items', async (info) => {
      received.push(`${info.request.method} ${await info.request.text()}`);

      return HttpResponse.json({ ok: true });
    }),
  );

  const init = { method, body: 'payload' };

  await fetch(`${ctx.base}/v1/items`, init);

  expect(received).toStrictEqual([`${method} payload`]);
});

test('it forwards a GET with its query string', async () => {
  const ctx = setupTest();

  network.use(
    http.get('http://172.28.80.1:8181/running', (info) =>
      HttpResponse.text(new URL(info.request.url).search),
    ),
  );

  const response = await fetch(`${ctx.base}/running?verbose=1`);
  const text = await response.text();

  expect(text).toBe('?verbose=1');
});

test('it reads the host again on each request', async () => {
  const ctx = setupTest();

  network.use(
    http.get('http://172.19.0.1:8181/health', () => HttpResponse.text('moved')),
    http.get('http://172.28.80.1:8181/health', () => HttpResponse.text('first')),
  );

  const firstResponse = await fetch(`${ctx.base}/health`);
  const first = await firstResponse.text();

  ctx.changeRoute('default via 172.19.0.1 dev eth0\n');

  const secondResponse = await fetch(`${ctx.base}/health`);
  const second = await secondResponse.text();

  expect([first, second]).toStrictEqual(['first', 'moved']);
});

test('it streams the upstream reply and its status unchanged', async () => {
  const ctx = setupTest();

  const encoder = new TextEncoder();

  network.use(
    http.post(
      'http://172.28.80.1:8181/v1/messages',
      () =>
        new HttpResponse(
          new ReadableStream({
            start: (controller) => {
              controller.enqueue(encoder.encode('event: a\n\n'));
              controller.enqueue(encoder.encode('event: b\n\n'));
              controller.close();
            },
          }),
          { status: 201, headers: { 'content-type': 'text/event-stream' } },
        ),
    ),
  );

  const response = await fetch(`${ctx.base}/v1/messages`, { method: 'POST', body: '{}' });

  expect(response.status).toBe(201);
  expect(response.headers.get('content-type')).toBe('text/event-stream');

  const text = await response.text();

  expect(text).toBe('event: a\n\nevent: b\n\n');
});

test('it answers 502 when llama-swap cannot be reached', async () => {
  const ctx = setupTest();

  network.use(http.get('http://172.28.80.1:8181/health', () => HttpResponse.error()));

  const response = await fetch(`${ctx.base}/health`);
  const text = await response.text();

  expect(response.status).toBe(502);
  expect(text).toContain('llm proxy cannot reach llama-swap');
});

test('it answers 502 when there is no default route', async () => {
  const ctx = setupTest('');

  const response = await fetch(`${ctx.base}/health`);
  const text = await response.text();

  expect(response.status).toBe(502);
  expect(text).toContain('cannot find the Windows host');
});
