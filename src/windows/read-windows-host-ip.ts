import { CLIError } from '../cli-error.ts';

const defaultRoutePattern = /^default via (?<address>\d{1,3}(?:\.\d{1,3}){3})\b/mu;

// WSL runs on NAT, so the Windows host is the default route. It changes between WSL starts, so
// every call reads it again.
export async function readWindowsHostIP(readDefaultRoute: () => Promise<string>): Promise<string> {
  const route = await readDefaultRoute();

  const address = defaultRoutePattern.exec(route)?.groups?.['address'];

  if (address === undefined) {
    throw new CLIError(
      `cannot find the Windows host in the default route: ${route.trim() || '(empty)'}`,
    );
  }

  return address;
}
