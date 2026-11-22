import { match } from 'ts-pattern';
import { buildModelFolderPath } from '../catalog/build-model-folder-path.ts';
import { buildModelPath } from '../catalog/build-model-path.ts';
import type { Catalog, Machine, Model } from '../catalog/types.ts';
import { joinWindowsPath } from '../windows/join-windows-path.ts';

interface LlamaSwapModel {
  readonly cmd: string;
  readonly env?: readonly string[];
  readonly ttl?: number;
  readonly disableKeepAlives: true;
}

export interface LlamaSwapConfig {
  readonly startPort: number;
  readonly globalTTL: number;
  readonly models: Readonly<Record<string, LlamaSwapModel>>;
}

// Keys follow docs/config.example.yaml in mostlygeek/llama-swap: startPort, globalTTL, and per
// model cmd, env, ttl and disableKeepAlives. llama-swap splits cmd with Windows quoting rules on
// Windows, so a double-quoted path keeps its backslashes and a single quote is not a quote.
export function buildLlamaSwapConfig(catalog: Catalog): LlamaSwapConfig {
  const models = Object.entries(catalog.models).map(
    ([id, model]) => [id, buildLlamaSwapModel(catalog.machine, model)] as const,
  );

  return {
    startPort: catalog.machine.llamaSwap.startPort,
    globalTTL: catalog.machine.llamaSwap.globalTTL,
    models: Object.fromEntries(models),
  };
}

function buildLlamaSwapModel(machine: Machine, model: Model): LlamaSwapModel {
  const env =
    model.backend === 'rocm'
      ? [`PATH=${machine.rocmLibDir};C:\\Windows\\System32;C:\\Windows`]
      : null;

  return {
    cmd: buildCommand(machine, model).join(' '),
    ...(env === null ? {} : { env }),
    ...(model.ttl === undefined ? {} : { ttl: model.ttl }),
    disableKeepAlives: true,
  };
}

function buildCommand(machine: Machine, model: Model): string[] {
  const server = joinWindowsPath(machine.binDir, model.backend, 'llama-server.exe');
  const device = machine.devices[model.backend];

  return [
    quote(server),
    `--port \${PORT}`,
    '--host 127.0.0.1',
    `-m ${quote(buildModelPath(machine, model))}`,
    `--device ${device}`,
    '-ngl 99',
    '-fa on',
    '--jinja',
    '-np 1',
    `-c ${model.ctx}`,
    ...(model.nCpuMoe === undefined ? [] : [`--n-cpu-moe ${model.nCpuMoe}`]),
    ...buildKVCacheFlags(model.kvCache),
    ...(model.mmproj === undefined
      ? []
      : [`--mmproj ${quote(joinWindowsPath(buildModelFolderPath(machine, model), model.mmproj))}`]),
    ...(model.chatTemplateFile === undefined
      ? []
      : [`--chat-template-file ${quote(model.chatTemplateFile)}`]),
    ...buildSamplerFlags(model.samplers),
    ...(model.extraArgs ?? []).map((argument) => quoteArgument(argument)),
  ];
}

function quote(value: string): string {
  return `"${value}"`;
}

function buildKVCacheFlags(kvCache: Model['kvCache']): string[] {
  return match(kvCache)
    .with('f16', () => [])
    .with('q8_0', () => ['-ctk q8_0', '-ctv q8_0'])
    .exhaustive();
}

function buildSamplerFlags(samplers: Model['samplers']): string[] {
  if (samplers === undefined) {
    return [];
  }

  const flags: readonly (readonly [string, number | undefined])[] = [
    ['--temp', samplers.temperature],
    ['--top-p', samplers.top_p],
    ['--top-k', samplers.top_k],
    ['--min-p', samplers.min_p],
    ['--presence-penalty', samplers.presence_penalty],
    ['--repeat-penalty', samplers.repeat_penalty],
  ];

  return flags.flatMap(([flag, value]) => (value === undefined ? [] : [`${flag} ${value}`]));
}

// Windows command-line quoting: an argument with whitespace, a double quote or a backslash is
// wrapped in double quotes, because llama-swap strips a trailing backslash from an unquoted
// argument. Each double quote is backslash-escaped, and the backslashes before it are doubled.
function quoteArgument(value: string): string {
  if (value !== '' && !/[\s"\\]/u.test(value)) {
    return value;
  }

  const escaped = value
    .replaceAll(/(?<slashes>\\*)"/gu, (_match, slashes: string) => `${slashes}${slashes}\\"`)
    .replace(/(?<slashes>\\+)$/u, (_match, slashes: string) => `${slashes}${slashes}`);

  return `"${escaped}"`;
}
