import { expect, test } from 'bun:test';
import { quotePowerShellString } from './quote-powershell-string.ts';

test('it wraps a value in single quotes and keeps its backslashes', () => {
  expect(quotePowerShellString(String.raw`D:\models\file.gguf`)).toBe(
    String.raw`'D:\models\file.gguf'`,
  );
});

test('it doubles each single quote', () => {
  expect(quotePowerShellString(`it's a 'test'`)).toBe(`'it''s a ''test'''`);
});

test('it doubles the typographic single quotes that PowerShell reads as quotes', () => {
  expect(quotePowerShellString('\u2018a\u2019 \u201Ab\u201B')).toBe(
    "'\u2018\u2018a\u2019\u2019 \u201A\u201Ab\u201B\u201B'",
  );
});

test('it leaves a dollar sign and a backtick inside the quotes untouched', () => {
  expect(quotePowerShellString('$(calc) `x`')).toBe("'$(calc) `x`'");
});
