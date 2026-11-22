import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { buildModelPath } from '../catalog/build-model-path.ts';
import type { Model } from '../catalog/types.ts';
import { runCLI } from '../run-cli.ts';
import { buildCatalog } from '../testing/build-catalog.ts';
import { buildCLIDependencies } from '../testing/build-cli-dependencies.ts';
import { buildModel } from '../testing/build-model.ts';
import { createStubModelFile } from '../testing/create-stub-model-file.ts';
import { toWSLPath } from '../windows/to-wsl-path.ts';

async function setupTest() {
  const root = await mkdtemp(join(tmpdir(), 'llm-profile-'));

  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const printed: string[] = [];
  const atcConfigPath = join(root, 'atc/config.json');
  const mountRoot = join(root, 'mnt');
  const repoRoot = join(root, 'repo');

  const configSchema = z.looseObject({
    hotkeys: z.unknown().optional(),
    agents: z.record(z.string(), z.unknown()),
  });

  return {
    printed,
    atcConfigPath,
    mountRoot,
    repoRoot,
    backupName: (reason: string) => `config.json.bak-20261103T102030Z-${reason}`,
    writeCatalog: async (model: Model) => {
      const catalog = buildCatalog({ models: { 'example-model': model } });

      await Bun.write(join(root, 'models.yaml'), Bun.YAML.stringify(catalog));

      return toWSLPath(buildModelPath(catalog.machine, model), mountRoot);
    },
    readConfig: async () => {
      const text = await Bun.file(atcConfigPath).text();

      return configSchema.parse(JSON.parse(text));
    },
    readBackup: async (reason: string) => {
      const text = await Bun.file(`${atcConfigPath}.bak-20261103T102030Z-${reason}`).text();

      const backup: unknown = JSON.parse(text);

      return backup;
    },
    listFiles: () => readdir(join(root, 'atc')),
    run: (argv: readonly string[]) =>
      runCLI(
        argv,
        buildCLIDependencies({
          catalogPath: join(root, 'models.yaml'),
          atcConfigPath,
          mountRoot,
          repoRoot,
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}

test('it adds a local-<id> agent that points at the proxy', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel({ ctx: 65_536 }));

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(
    ctx.atcConfigPath,
    JSON.stringify({
      agents: { 'abliteration-bare': { kind: 'claude', settings: { outputStyle: 'terse' } } },
    }),
  );

  const result = await ctx.run(['profile', 'example-model']);
  const config = await ctx.readConfig();

  expect(result.exitCode).toBe(0);

  expect(config.agents['local-example-model']).toMatchObject({
    kind: 'claude',
    baseURL: 'http://127.0.0.1:8182',
    apiKeyHelper: 'echo local',
    args: ['--system-prompt', ''],
    settings: { outputStyle: 'terse' },
    env: {
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'example-model',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'example-model',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'example-model',
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: '65536',
    },
  });
});

test('it leaves every other agent and top-level key as it was', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  const liveLocalAgent = { kind: 'claude', baseURL: 'http://172.28.80.1:8181' };

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(
    ctx.atcConfigPath,
    JSON.stringify({ hotkeys: { quit: 'q' }, agents: { claude: {}, local: liveLocalAgent } }),
  );

  await ctx.run(['profile', 'example-model']);

  const config = await ctx.readConfig();

  expect(config.hotkeys).toStrictEqual({ quit: 'q' });
  expect(config.agents['local']).toStrictEqual(liveLocalAgent);
  expect(config.agents['claude']).toStrictEqual({});
});

test('it backs the config up before it writes and tells the owner to restart atc', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));
  await ctx.run(['profile', 'example-model']);

  const files = await ctx.listFiles();

  expect(files).toContain(ctx.backupName('profile-example-model'));
  expect(ctx.printed[0]).toContain('restart the atc daemon to load it');
});

test('it keeps the backup as the config was before the write', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  const startingConfig = { hotkeys: { quit: 'q' }, agents: { claude: {} } };

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(ctx.atcConfigPath, JSON.stringify(startingConfig));
  await ctx.run(['profile', 'example-model']);

  const backup = await ctx.readBackup('profile-example-model');

  expect(backup).toStrictEqual(startingConfig);
});

test('it fails with no model id and no --rm', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));

  const result = await ctx.run(['profile']);

  expect(result.errorMessage).toBe('name a model id, or pass --rm <name>');
});

test('it uses the name it is given', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));
  await ctx.run(['profile', 'example-model', '--name', 'my-agent']);

  const config = await ctx.readConfig();

  expect(Object.keys(config.agents)).toContain('my-agent');
});

test('it refuses to overwrite an agent without --force and writes nothing', async () => {
  const ctx = await setupTest();

  const liveLocalAgent = { kind: 'claude', baseURL: 'http://172.28.80.1:8181' };

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: { local: liveLocalAgent } }));

  const result = await ctx.run(['profile', 'example-model', '--name', 'local']);
  const files = await ctx.listFiles();
  const config = await ctx.readConfig();

  expect(result.errorMessage).toBe('agent "local" exists; pass --force to overwrite it');
  expect(files).toStrictEqual(['config.json']);
  expect(config.agents['local']).toStrictEqual(liveLocalAgent);
});

test('it overwrites an agent with --force', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(
    ctx.atcConfigPath,
    JSON.stringify({ agents: { local: { kind: 'claude', baseURL: 'http://172.28.80.1:8181' } } }),
  );

  await ctx.run(['profile', 'example-model', '--name', 'local', '--force']);

  const config = await ctx.readConfig();

  expect(config.agents['local']).toMatchObject({ baseURL: 'http://127.0.0.1:8182' });
});

test('it omits settings when the config has no abliteration-bare agent', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: { claude: {} } }));
  await ctx.run(['profile', 'example-model']);

  const config = await ctx.readConfig();

  expect(config.agents['local-example-model']).not.toHaveProperty('settings');
});

test('it rejects a model that is not in the catalog', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));

  const result = await ctx.run(['profile', 'nope']);

  expect(result.errorMessage).toContain('no model "nope" in the catalog');
});

test('it rejects an agent name with a space', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));

  const result = await ctx.run(['profile', 'example-model', '--name', 'bad name']);

  expect(result.errorMessage).toContain('is not an agent name');
});

test('it removes an agent it wrote, after a backup', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel());

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(
    ctx.atcConfigPath,
    JSON.stringify({ agents: { claude: {}, local: { kind: 'claude' } } }),
  );

  await ctx.run(['profile', 'example-model']);

  const result = await ctx.run(['profile', '--rm', 'local-example-model']);
  const config = await ctx.readConfig();
  const files = await ctx.listFiles();

  expect(result.exitCode).toBe(0);
  expect(Object.keys(config.agents)).toStrictEqual(['claude', 'local']);
  expect(files).toContain(ctx.backupName('profile-rm-local-example-model'));
});

test('it refuses to remove an agent that it did not write', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: { local: { kind: 'claude' } } }));

  const result = await ctx.run(['profile', '--rm', 'local']);
  const files = await ctx.listFiles();

  expect(result.errorMessage).toBe('agent "local" is not one that llm profile wrote');
  expect(files).toStrictEqual(['config.json']);
});

test('it refuses to remove a hand-made agent that points at the proxy', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());

  await Bun.write(
    ctx.atcConfigPath,
    JSON.stringify({ agents: { manual: { kind: 'claude', baseURL: 'http://127.0.0.1:8182' } } }),
  );

  const result = await ctx.run(['profile', '--rm', 'manual']);
  const config = await ctx.readConfig();

  expect(result.errorMessage).toBe('agent "manual" is not one that llm profile wrote');
  expect(Object.keys(config.agents)).toStrictEqual(['manual']);
});

test('it fails when there is no atc config', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());

  const result = await ctx.run(['profile', 'example-model']);

  expect(result.errorMessage).toContain('no atc config at');
});

test('it fails when the atc config is not JSON', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, '{ nope');

  const result = await ctx.run(['profile', 'example-model']);

  expect(result.errorMessage).toContain('is not valid JSON');
});

test('it labels the agent with the name and the traits of the model', async () => {
  const ctx = await setupTest();

  const modelPath = await ctx.writeCatalog(
    buildModel({ name: 'Example 9B', mmproj: 'mmproj.gguf', tags: ['abliterated'] }),
  );

  await createStubModelFile(modelPath, '{{ reasoning_effort }}');

  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));
  await ctx.run(['profile', 'example-model']);

  const config = await ctx.readConfig();

  expect(config.agents['local-example-model']).toMatchObject({
    label: 'Example 9B (effort · vision · abliterated)',
  });
});

test('it labels a model with no traits by its name alone', async () => {
  const ctx = await setupTest();
  const modelPath = await ctx.writeCatalog(buildModel({ name: 'Example 9B' }));

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));
  await ctx.run(['profile', 'example-model']);

  const config = await ctx.readConfig();

  expect(config.agents['local-example-model']).toMatchObject({ label: 'Example 9B' });
});

test('it reads the effort trait from the catalog template file when there is one', async () => {
  const ctx = await setupTest();

  const modelPath = await ctx.writeCatalog(
    buildModel({
      name: 'Example 9B',
      chatTemplateFile: String.raw`C:\llm\templates\example.jinja`,
    }),
  );

  await createStubModelFile(modelPath, '{{ messages }}');

  await Bun.write(join(ctx.repoRoot, 'templates/example.jinja'), '{{ reasoning_effort }}');
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));
  await ctx.run(['profile', 'example-model']);

  const config = await ctx.readConfig();

  expect(config.agents['local-example-model']).toMatchObject({ label: 'Example 9B (effort)' });
});

test('it does not read the GGUF when the catalog sets a template file', async () => {
  const ctx = await setupTest();

  const modelPath = await ctx.writeCatalog(
    buildModel({
      name: 'Example 9B',
      chatTemplateFile: String.raw`C:\llm\templates\plain.jinja`,
    }),
  );

  await createStubModelFile(modelPath, '{{ reasoning_effort }}');

  await Bun.write(join(ctx.repoRoot, 'templates/plain.jinja'), '{{ messages }}');
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));
  await ctx.run(['profile', 'example-model']);

  const config = await ctx.readConfig();

  expect(config.agents['local-example-model']).toMatchObject({ label: 'Example 9B' });
});

test('it fails and writes nothing when the model file is not on disk', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(buildModel());
  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));

  const result = await ctx.run(['profile', 'example-model']);
  const files = await ctx.listFiles();

  expect(result.errorMessage).toContain('run llm pull example-model');
  expect(files).toStrictEqual(['config.json']);
});

test('it fails and writes nothing when the catalog template file is not in templates/', async () => {
  const ctx = await setupTest();

  await ctx.writeCatalog(
    buildModel({ chatTemplateFile: String.raw`C:\llm\templates\missing.jinja` }),
  );

  await Bun.write(ctx.atcConfigPath, JSON.stringify({ agents: {} }));

  const result = await ctx.run(['profile', 'example-model']);
  const files = await ctx.listFiles();

  expect(result.errorMessage).toContain('templates/missing.jinja');
  expect(files).toStrictEqual(['config.json']);
});
