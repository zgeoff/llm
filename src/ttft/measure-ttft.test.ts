import { expect, test } from 'bun:test';
import { createFakeClock } from '@zgeoff/testing/clock';
import { HttpResponse, http } from 'msw';
import { network } from '../testing/network.ts';
import { measureTTFT } from './measure-ttft.ts';

interface Step {
  readonly line: string;
  readonly afterMs: number;
}

function setupTest(steps: readonly Step[]) {
  const baseURL = 'http://172.28.80.1:8181';
  const clock = createFakeClock();

  const encoder = new TextEncoder();

  let nextStep = 0;

  // Each step moves the fake clock, once the code under test has handled the step before it.
  const body = new ReadableStream<Uint8Array>(
    {
      pull: async (controller) => {
        await new Promise((resolve) => {
          setImmediate(resolve);
        });

        const step = steps[nextStep];

        nextStep += 1;

        if (step === undefined) {
          controller.close();

          return;
        }

        clock.advance(step.afterMs);
        controller.enqueue(encoder.encode(`${step.line}\n\n`));
      },
    },
    { highWaterMark: 0 },
  );

  network.use(
    http.post(
      `${baseURL}/v1/chat/completions`,
      () => new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } }),
    ),
  );

  return {
    measure: () =>
      measureTTFT({
        baseURL,
        modelID: 'example-model',
        prompt: 'hello',
        maxTokens: 16,
        clock,
      }),
  };
}

test('it measures the first text chunk and the rate of the rest', async () => {
  const ctx = setupTest([
    { afterMs: 0, line: 'data: {"choices":[{"delta":{"role":"assistant"}}]}' },
    { afterMs: 400, line: 'data: {"choices":[{"delta":{"content":"a"}}]}' },
    { afterMs: 0, line: 'data: {"choices":[{"delta":{"content":"b"}}]}' },
    { afterMs: 1000, line: 'data: {"choices":[],"usage":{"completion_tokens":11}}' },
    { afterMs: 0, line: 'data: [DONE]' },
  ]);

  const result = await ctx.measure();

  expect(result).toStrictEqual({ ttftMs: 400, completionTokens: 11, tokensPerSecond: 10 });
});

test('it counts text chunks when the server sends no usage', async () => {
  const ctx = setupTest([
    { afterMs: 100, line: 'data: {"choices":[{"delta":{"content":"a"}}]}' },
    { afterMs: 100, line: 'data: {"choices":[{"delta":{"content":"b"}}]}' },
    { afterMs: 100, line: 'data: {"choices":[{"delta":{"content":"c"}}]}' },
  ]);

  const result = await ctx.measure();

  expect(result.completionTokens).toBe(3);
  expect(result.tokensPerSecond).toBe(10);
});

test('it rejects when the stream carries no text', () => {
  const ctx = setupTest([{ afterMs: 0, line: 'data: [DONE]' }]);

  expect(ctx.measure()).rejects.toThrow('example-model streamed no text');
});

test('it rejects when the stream fails after some text', () => {
  const ctx = setupTest([
    { afterMs: 100, line: 'data: {"choices":[{"delta":{"content":"a"}}]}' },
    { afterMs: 100, line: 'data: {"error":{"message":"out of memory","code":500}}' },
  ]);

  expect(ctx.measure()).rejects.toThrow(
    'example-model failed mid-stream: {"message":"out of memory","code":500}',
  );
});

test('it rejects with the answer when llama-swap refuses', () => {
  const ctx = setupTest([]);

  network.use(
    http.post(
      'http://172.28.80.1:8181/v1/chat/completions',
      () => new HttpResponse('no', { status: 400 }),
    ),
  );

  expect(ctx.measure()).rejects.toThrow('400 no');
});
