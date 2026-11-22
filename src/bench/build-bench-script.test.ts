import { expect, test } from 'bun:test';
import { buildBenchScript } from './build-bench-script.ts';

function setupTest() {
  const options = {
    benchPath: String.raw`C:\llm\bin\vulkan\llama-bench.exe`,
    modelPath: String.raw`D:\models\example-org\example-model-GGUF\it's.gguf`,
    device: 'Vulkan0',
    nCpuMoe: undefined,
    depths: [0, 8192],
    repetitions: 3,
    pathPrefix: undefined,
  };

  return { options };
}

test('it runs llama-bench on one device with the depths and merged stderr', () => {
  const ctx = setupTest();
  const script = buildBenchScript(ctx.options);

  expect(script).toContain(
    String.raw`& 'C:\llm\bin\vulkan\llama-bench.exe' -m 'D:\models\example-org\example-model-GGUF\it''s.gguf' -dev 'Vulkan0' -ngl 99 -fa 1 -p 512 -n 128 -d 0,8192 -r 3 -o jsonl 2>&1`,
  );

  expect(script).toContain('exit=$LASTEXITCODE');
  expect(script).not.toContain('$env:PATH');
  expect(script).not.toContain('--n-cpu-moe');
});

test('it adds the ROCm folder to PATH and the expert offload count when given', () => {
  const ctx = setupTest();

  const script = buildBenchScript({
    ...ctx.options,
    nCpuMoe: 20,
    pathPrefix: String.raw`C:\llm\rocm\bin`,
  });

  expect(script).toContain(String.raw`$env:PATH = 'C:\llm\rocm\bin;' + $env:PATH`);
  expect(script).toContain('--n-cpu-moe 20');
});

test('it quotes a device value so that it stays one argument', () => {
  const ctx = setupTest();

  const script = buildBenchScript({
    ...ctx.options,
    device: 'Vulkan0; Write-Output INJECTED; #',
  });

  expect(script).toContain("-dev 'Vulkan0; Write-Output INJECTED; #' -ngl 99");
});
