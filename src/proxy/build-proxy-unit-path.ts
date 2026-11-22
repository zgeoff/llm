export function buildProxyUnitPath(homeDir: string): string {
  return `${homeDir}/.config/systemd/user/llm-proxy.service`;
}
