import { z } from 'zod';

const windowsPathPattern = /^[A-Za-z]:\\.*[^\\]$/u;
const kebabCasePattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const hostPortPattern = /^[^\s:]+:\d{1,5}$/u;
const repoPattern = /^(?!\.{1,2}\/)[\w.-]+\/(?!\.{1,2}$)[\w.-]+$/u;
const fileNamePattern = /^(?!\.{1,2}$)[^\\/]+$/u;

const windowsPathSchema = z
  .string()
  .regex(windowsPathPattern, String.raw`must be an absolute Windows path such as D:\models`);

const fileNameSchema = z.string().regex(fileNamePattern, 'must be a file name with no folder');

const samplersSchema = z.strictObject({
  temperature: z.number().min(0).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(0).optional(),
  min_p: z.number().min(0).max(1).optional(),
  presence_penalty: z.number().optional(),
  repeat_penalty: z.number().min(0).optional(),
});

const machineSchema = z.strictObject({
  modelsDir: windowsPathSchema,
  binDir: windowsPathSchema,
  rocmLibDir: windowsPathSchema,
  devices: z.strictObject({
    vulkan: z.string().min(1),
    rocm: z.string().min(1),
  }),
  llamaSwap: z.strictObject({
    listen: z.string().regex(hostPortPattern, 'must be host:port'),
    configPath: windowsPathSchema,
    logPath: windowsPathSchema,
    startPort: z.number().int().min(1).max(65_535),
    globalTTL: z.number().int().min(0),
  }),
  proxy: z.strictObject({
    port: z.number().int().min(1).max(65_535),
  }),
});

const modelSchema = z.strictObject({
  name: z.string().min(1).optional(),
  repo: z.string().regex(repoPattern, 'must be a Hugging Face repo such as owner/name'),
  file: fileNameSchema,
  upstream: z
    .string()
    .regex(repoPattern, 'must be a Hugging Face repo such as owner/name')
    .optional(),
  tags: z.array(z.string().min(1)),
  backend: z.enum(['vulkan', 'rocm']),
  ctx: z.number().int().positive(),
  nCpuMoe: z.number().int().min(0).optional(),
  kvCache: z.enum(['f16', 'q8_0']),
  mmproj: fileNameSchema.optional(),
  chatTemplateFile: windowsPathSchema.optional(),
  samplers: samplersSchema.optional(),
  extraArgs: z.array(z.string()).optional(),
  ttl: z.number().int().min(0).optional(),
});

export const catalogSchema = z.strictObject({
  machine: machineSchema,
  models: z.record(
    z
      .string()
      .regex(
        kebabCasePattern,
        'a model id must be kebab-case, with dots allowed inside a segment such as qwen3.6-35b-a3b',
      ),
    modelSchema,
  ),
});
