// PowerShell treats the typographic single quotes as quotes too, so each one doubles like `'`.
export function quotePowerShellString(value: string): string {
  return `'${value.replaceAll(/['\u2018\u2019\u201A\u201B]/gu, (quote) => `${quote}${quote}`)}'`;
}
