import type { Machine } from '../catalog/types.ts';
import { buildLlamaSwapURL } from '../serving/build-llama-swap-url.ts';
import { readWindowsHostIP } from '../windows/read-windows-host-ip.ts';
import { transformRequestBody } from './transform-request-body.ts';

interface ProxyOptions {
  readonly machine: Machine;
  readonly readDefaultRoute: () => Promise<string>;

  // 0 asks the OS for a free port.
  readonly port: number;
}

// Listens on loopback and forwards every request to llama-swap at the Windows host, which it reads
// again on each request because the host address changes between WSL starts.
export function createProxyServer(options: ProxyOptions): Bun.Server<undefined> {
  return Bun.serve({
    hostname: '127.0.0.1',
    port: options.port,

    // A thinking model can stay silent for longer than Bun's 10 s default before its first byte.
    idleTimeout: 255,
    routes: { '/*': (request) => forwardRequest(request, options) },
  });
}

async function forwardRequest(request: Request, options: ProxyOptions): Promise<Response> {
  const url = new URL(request.url);

  try {
    const hostIP = await readWindowsHostIP(options.readDefaultRoute);

    const target = buildLlamaSwapURL(options.machine, hostIP);

    const requestText =
      request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

    const body =
      requestText === undefined ? undefined : transformRequestBody(requestText, url.pathname);

    const headers = new Headers(request.headers);

    // fetch decompresses a reply but keeps its encoding header, so ask for none.
    headers.set('accept-encoding', 'identity');
    headers.delete('content-length');
    headers.delete('host');

    return await fetch(`${target}${url.pathname}${url.search}`, {
      body,
      headers,
      method: request.method,
      signal: request.signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return new Response(`llm proxy cannot reach llama-swap: ${reason}\n`, { status: 502 });
  }
}
