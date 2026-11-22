import { createTestNetwork } from '@zgeoff/testing/fetch';

// The one fetch mock of a test process. No remote service has default handlers yet, so a test adds
// a per-test handler for the answer it needs. A request to a loopback host reaches the real
// server that the test started.
export const network = createTestNetwork({ handlers: [] });
