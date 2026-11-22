import type { Machine } from '../catalog/types.ts';

// The listen address is 0.0.0.0:<port> so Windows serves every interface, and WSL reaches it at the
// host IP on that port.
export function buildLlamaSwapURL(machine: Machine, hostIP: string): string {
  const port = machine.llamaSwap.listen.split(':').at(-1);

  return `http://${hostIP}:${port}`;
}
