# LLM inference runtime and backend for RX 9070 XT (gfx1201, 16 GB) on Windows 11 + WSL2 — as of early Nov 2026

Research date: 2026-11-02. "Official" = vendor docs/release notes/repo docs. "Community" = issues, discussions, blogs, third-party repos.

## 1. llama.cpp backends on RDNA4: Vulkan vs ROCm/HIP

### Takeaway
Token generation: on RDNA4, Vulkan is faster than ROCm/HIP in every head-to-head run found, by roughly 15-35%. Prompt processing: ROCm usually matches or beats Vulkan, and at large batch it can be about 1.4-2.5x faster on dense models. All of these numbers come from native Linux. I found no head-to-head llama-bench run on Windows for the 9070 XT, and the Windows result should be measured locally.

### Cited Findings
- **Official scoreboard (ROCm), RX 9070 XT, Llama 2 7B Q4_0, `llama-bench -ngl 99 -fa 0,1`, commit 583cb83 (undated):** pp512 5055 t/s / tg128 101.3 t/s (FA off); pp512 4904 / tg128 97.3 (FA on). — [llama.cpp Discussion #15021](https://github.com/ggml-org/llama.cpp/discussions/15021)
- **Same scoreboard, RX 9070 (non-XT), commit d0660f2:** pp512 2382 / tg128 114.5 (FA off); pp512 2453 / tg128 115.3 (FA on). — [Discussion #15021](https://github.com/ggml-org/llama.cpp/discussions/15021)
- **Head-to-head RX 9070 XT, 15 Jul 2026, build b10034, ROCm 7.1.1, Fedora 44, Llama 3.2 3B Q4_K_M, `-ngl 99 -fa 1`:** ROCm pp512 about 7,360-7,400 / tg128 about 178.5. Vulkan pp512 7,534 on the first run, then about 5,600 / tg128 about 220. Vulkan generation is about 23% faster. Prompt processing is similar, but Vulkan varies more from run to run. — [Discussion #15021 comment by cipputi](https://github.com/ggml-org/llama.cpp/discussions/15021)
- **Head-to-head Radeon AI PRO R9700 (same gfx1201 die, 32 GB), 16 Aug 2025, build 6177, Docker:**
  - Llama 2 7B Q4_0: ROCm FA-off pp512 2746 / tg128 92.3. Vulkan FA-off pp512 1944 / tg128 124.1. Vulkan FA-on pp512 1864 / tg128 124.7. With FA on, ROCm prompt processing fell to 1300.
  - Qwen3 32B Q4_K_M: ROCm pp512 about 500 / tg128 24.0. Vulkan pp512 about 200 / tg128 28.2.
  - The pattern: ROCm wins prompt processing on dense models and Vulkan wins generation. — [Discussion #15021](https://github.com/ggml-org/llama.cpp/discussions/15021)
- **Phoronix (2025), RX 9070 XT, Linux 6.17 + Mesa 25.3-dev RADV vs ROCm 6.4.3, gpt-oss-20b:** Vulkan beat ROCm in every test. ROCm 6.4.3 is old. — [Phoronix](https://www.phoronix.com/review/llama-cpp-windows-linux/5), via [OpenBenchmarking result 2509078](https://openbenchmarking.org/result/2509078-NE-ROCMVSVUL92)
- **Phoronix, Oct 2026, Lemonade with llama.cpp on Radeon (native Linux):** the search snippet says ROCm was the fastest and that "the Vulkan back-end of Llama.cpp is still working quite well overall." I could not read the article (HTTP 403), so the GPUs and numbers are unverified. — [Phoronix lemonade-vulkan-rocm](https://www.phoronix.com/review/lemonade-vulkan-rocm/3)
- **llama-server Vulkan vs vLLM-ROCm on RX 9070 XT, CachyOS (2026):** Vulkan reached 62 t/s (Qwen3.5-9B Q6_K_XL) against vLLM ROCm 7.2's 48 t/s (FP8). The flags used were `--n-gpu-layers 999 -c 65536 --batch-size 2048 --ubatch-size 2048 --cache-reuse 256`. The quantizations differ, so this does not isolate the backend. — [ivangotoy/llama-server-rdna4-vulkan](https://github.com/ivangotoy/llama-server-rdna4-vulkan)
- **Community deep-dive on the R9700:** Vulkan decode is still ahead of HIP. — [Discussion #21043 "RDNA4 Llama Experiments"](https://github.com/ggml-org/llama.cpp/discussions/21043)
- **Flag notes from the sources:**
  - Flash attention on ROCm cut R9700 and RX 9070 prompt processing by about half in the Aug 2025 runs (e.g. 2361 to 1148 on the RX 9070). In the 2026 Fedora run, FA on ROCm was fine. Test `-fa 0` and `-fa 1` per build. — [Discussion #15021](https://github.com/ggml-org/llama.cpp/discussions/15021)
  - Vulkan with `-ub/-b 2048` is used in the 62 t/s setup. — [ivangotoy](https://github.com/ivangotoy/llama-server-rdna4-vulkan)
  - On RADV gfx1151, ubatch > 512 halved performance for Qwen3-Next 80B. This is a different chip, but it shows `-ub` should be swept. — [llama.cpp issue #18725 (via search)](https://github.com/ggml-org/llama.cpp/issues/18725)
- **Vulkan architecture misdetection:** llama.cpp's Vulkan detector classifies gfx1201 as AMD_RDNA3, because it keys off the integer-dot extension. A community repo adds RDNA4 matvec tuning that gives +13.4% at 8 concurrent slots and no change for a single stream. — [DrMkdaddy/llama-vulkan-matvec-rdna4](https://github.com/DrMkdaddy/llama-vulkan-matvec-rdna4)

### Inferences
- For single-user chat and agent use, decode speed dominates, so Vulkan is the default pick. ROCm/HIP is worth trying for long-prompt workloads such as RAG or coding agents with large contexts, where its prompt-processing lead matters.
- In Windows, Vulkan runs on AMD's proprietary driver (AMDVLK/PAL-based), not RADV. The Linux RADV numbers above may not carry over. Benchmark both of the official Windows zips locally with `llama-bench -m <model> -ngl 99 -fa 0,1 -ub 512,1024,2048`.
- For MoE models larger than 16 GB, use `--n-cpu-moe N` or `-ot "exps=CPU"` to keep the experts in system RAM. The general flags are `-ctk q8_0 -ctv q8_0` to halve KV memory (needs FA on) and `--no-mmap` on Windows to avoid paging. These are standard llama.cpp flags. I did not find a source that benchmarks them on the 9070 XT.

### Gaps
- No Windows-native Vulkan vs HIP llama-bench run for the 9070 XT was found.
- No published 9070 XT numbers measure the effect of `-ctk/-ctv q8_0` or `--n-cpu-moe`.
- The October 2026 Phoronix numbers could not be read.

## 2. ROCm on Windows and in WSL2: official status for gfx1201

### Takeaway
On native Windows, gfx1201 is officially supported by AMD's ROCm-on-Radeon stack (7.2.1, then the TheRock-based Core SDK 7.13/7.14/10.0/10.1). The official llama.cpp Windows ROCm zip is built against ROCm 10.0 and includes gfx1201. In WSL2, ROCm is only a **technical preview**, first shipped in ROCm 10.1.0 (dated 2026-10-05). The release notes do not explicitly list gfx1201 for WSL2, and debugging, profiling and KFD-dependent tools do not work there. A community report shows llama.cpp HIP working on a 9070 XT in WSL2.

### Cited Findings
- **Official, AMD Radeon/Ryzen Windows support matrix:**
  - ROCm 7.2.1 on Windows supports gfx1201, gfx1200, gfx1100 and gfx1101.
  - The listed cards include the RX 9070, RX 9070 XT and AI PRO R9700.
  - The OS is Windows 11 only.
  - The page notes that "the entire ROCm stack is not yet supported on Windows."
  - [AMD Windows compatibility matrix](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityrad/windows/windows_compatibility.html)
- **Official, HIP SDK for Windows 7.2.0 system requirements:** list the RX 9070, 9070 XT and 9070 GRE as gfx1201 with runtime and HIP SDK support. — [HIP SDK system requirements](https://rocm.docs.amd.com/projects/install-on-windows/en/latest/reference/system-requirements.html)
- **Official, ROCm Core SDK 7.14.0:**
  - ROCm moved to TheRock, a modular build and release system.
  - gfx1201 has its own packages (`amdrocm-core-sdk7.14-gfx1201`).
  - The vLLM 0.23.0 compatibility table lists gfx1201.
  - [ROCm 7.14.0 release notes](https://rocm.docs.amd.com/en/docs-7.14.0/about/release-notes.html), [install page](https://rocm.docs.amd.com/en/docs-7.14.0/install/rocm.html)
- **Official, ROCm 10.0.0:**
  - The release notes list RX 9070 series and AI PRO R9000 (gfx1201) support.
  - Windows 11 25H2 is the supported Windows version.
  - The package is per-architecture (`amdrocm10.0-gfx1201`).
  - [ROCm 10.0.0 release notes](https://rocm.docs.amd.com/en/docs-10.0.0/about/release-notes.html), [10.0.0 compatibility matrix](https://rocm.docs.amd.com/en/docs-10.0.0/compatibility/compatibility-matrix.html)
  - A third-party guide dates 10.0.0 to August 2026. — [glukhov.org](https://www.glukhov.org/es/llm-hosting/comparisons/amd-rocm-vs-vulkan-llm-hosting/)
- **Official, ROCm Core SDK 10.1.0 (dated 2026-10-05):**
  - The notes say: "WSL2 support now included in TheRock artifacts (Technical preview)". The preview covers Ubuntu `.deb` packages and Python wheels only.
  - "Profiling, debugging, and KFD-dependent tooling are not supported in WSL2 at launch."
  - Known issue: "GPU device-side memory faults might not be reported correctly and can result in the process hanging."
  - AMD SMI gains a WSL2 backend that only discovers and monitors devices.
  - The listed Windows driver is **AMD Software: Adrenalin Edition 26.10.41.05**.
  - 10.1 also adds RDNA4-tuned rocSPARSE.
  - [ROCm 10.1.0 release notes](https://rocm.docs.amd.com/en/latest/about/release-notes.html)
- **Official llama.cpp Windows ROCm build:**
  - The release workflow's `windows-rocm` job uses `ROCM_VERSION: "10.0.0"` with `gpu_targets` that include `gfx1200;gfx1201`.
  - It builds only `ggml-hip.dll` and bundles `amdhip64_7.dll`, `rocm_kpack.dll` and `amd_comgr.dll` next to it. The workflow comment explains why: "the Adrenalin driver ships an amdhip64_7.dll in System32, which the loader searches before PATH".
  - The asset is `llama-b12034-bin-win-rocm-10.0-x64.zip` (b12034, 2026-11-02).
  - [release.yml](https://github.com/ggml-org/llama.cpp/blob/master/.github/workflows/release.yml), [releases](https://github.com/ggml-org/llama.cpp/releases)
- **Community: ROCm HIP on a 9070 XT inside WSL2 via librocdxg** (issue opened 11 Jul 2026):
  - Setup: Ubuntu 26.04, ROCm 7.13 pre-release, librocdxg 1.2.0, built with `amdgpu-install --usecase=rocm --no-dkms` and `-DGGML_HIP=ON -DAMDGPU_TARGETS=gfx1201`.
  - `HSA_ENABLE_DXG_DETECTION` was not needed on 7.13, but a commenter says it is required below 7.13.
  - Results: TinyLlama 1B pp512 about 19,800 / tg128 about 281 t/s. Mistral-Nemo 12B ran at 94% GPU utilization.
  - No maintainer replied and the Windows driver version was not stated.
  - [ROCm/librocdxg#74](https://github.com/ROCm/librocdxg/issues/74)
- **Community, WSL tooling:** amd-smi, rocprofiler and rocm-debugger do not work under WSL. This report is from Strix Halo, not gfx1201. — [andweng/wsl-rocm](https://github.com/andweng/wsl-rocm)
- **Vulkan in WSL2 via Mesa dzn:** I found no source that benchmarks dzn with llama.cpp on AMD. — (search returned nothing relevant)

### Inferences
- `/dev/dxg` exists on this machine, so the WSL2 GPU paravirtualization path is present. ROCm 10.1's technical-preview WSL2 packages, or librocdxg on 7.13+, would be the route. Expect preview-grade stability: hangs on device faults, and no rocprof or rocgdb.
- WSL2 also caps usable system RAM at about 30 GB here, which hurts MoE CPU offload (`--n-cpu-moe`). Native Windows can use all 64 GB.
- Both points argue for **native Windows** as the OS layer for inference. WSL2 can call the Windows server over localhost (WSL2's mirrored networking or the host IP).
- dzn (Vulkan over D3D12) is a translation layer with no published llama.cpp numbers. It is not a sensible path when native Windows Vulkan is available.

### Gaps
- No official AMD statement names gfx1201 for the WSL2 preview, and no WSL2-specific minimum Adrenalin version was found. The 10.1 notes list driver 26.10.41.05 but do not tie it to WSL2.
- The release date of ROCm 10.0.0 is unconfirmed in official docs. A third party says August 2026.

## 3. Runtime options: AMD support, hot-swap, and API compatibility

### Takeaway
On Windows, **llama.cpp `llama-server`** (official Vulkan or ROCm-10.0 zip) has first-party router mode for multi-model hot-swap, plus OpenAI and Anthropic `/v1/messages` endpoints. That makes it the lowest-friction, fastest-moving option. LM Studio is the easiest GUI option and also has an Anthropic endpoint. Stock Ollama's docs do **not** list the RX 9070 series under Windows ROCm, so on Windows it falls back to Vulkan. Lemonade (AMD) packages llama.cpp ROCm/Vulkan builds for gfx120X. vLLM-ROCm is Linux-only and has trailed llama.cpp Vulkan on this card.

### Cited Findings
- **llama-server (official README, master, Nov 2026):**
  - Router mode starts when llama-server launches without a model. The flags are `--models-dir PATH`, `--models-preset PATH` (INI presets), `--models-max N` (default 4) and `--models-memory-margin N` (unloads least-recently-used models until a new one fits in VRAM), plus `--models-autoload`.
  - Requests route by the `"model"` field.
  - The Anthropic-compatible endpoints are `POST /v1/messages` and `/v1/messages/count_tokens`. Tool use requires `--jinja`.
  - OpenAI-compatible chat and completions endpoints are also present.
  - [tools/server/README.md](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- **Ollama (official docs, gpu.mdx, last changed 12 Oct 2026; latest release v0.40.13 on 28 Oct 2026):**
  - The Linux ROCm list includes the 9070 XT, 9070 GRE and 9070.
  - The Windows list says "requires an AMD ROCm v7 / HIP7-capable driver stack" but names only RX 7000 and W7000 cards, not the 9070 series.
  - Vulkan "is enabled by default when the backend is installed." It is disabled with `OLLAMA_VULKAN=0`.
  - The doc maps gfx1200 to "RX 9070", which is inconsistent with AMD's own mapping: all 9070 SKUs are gfx1201.
  - [ollama docs/gpu.mdx](https://github.com/ollama/ollama/blob/main/docs/gpu.mdx), [releases](https://github.com/ollama/ollama/releases)
- **Ollama, community:** an earlier Windows installer shipped ROCm 6.4.2 libraries without gfx1201. The xnyzer/ollama-rocm project is a ROCm 7 build of Ollama for gfx1201 on Windows 11, verified with Ollama 0.16.1 and 0.24.0. — [xnyzer/ollama-rocm](https://github.com/xnyzer/ollama-rocm), [ollama#10430](https://github.com/ollama/ollama/issues/10430)
- **LM Studio:**
  - 0.4.1 (30 Jan 2026) added an Anthropic-compatible `/v1/messages` endpoint. The blog shows Claude Code pointed at `http://localhost:1234`. — [LM Studio 0.4.1 changelog](https://lmstudio.ai/changelog/lmstudio-v0.4.1), [LM Studio blog: Claude Code](https://lmstudio.ai/blog/claudecode)
  - Bug: RX 9070 (gfx1201) could not run the ROCm llama.cpp runtime on Arch Linux in 0.3.35. Whether it was fixed is not shown. — [lmstudio-bug-tracker#1306](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1306)
  - A third-party wiki says the ROCm runtime covers the AMD 9000 series. — [aiwiki.ai](https://aiwiki.ai/wiki/lm_studio)
- **Lemonade Server (AMD-backed):**
  - It ships llama.cpp ROCm builds from TheRock nightlies for gfx120X (RX 9070 XT/GRE/9070), alongside Vulkan.
  - The docs describe an Anthropic-compatible API and a router component.
  - [lemonade-sdk/llamacpp-rocm](https://github.com/lemonade-sdk/llamacpp-rocm), [lemonade-sdk/lemonade](https://github.com/lemonade-sdk/lemonade)
- **vLLM-ROCm:**
  - Officially, the ROCm 7.14 compatibility tables list gfx1201 for vLLM 0.23.0. — [ROCm 7.14 release notes](https://rocm.docs.amd.com/en/docs-7.14.0/about/release-notes.html)
  - Community: on a 9070 XT it was slower than llama-server Vulkan (48 vs 62 t/s). The author attributes this to a missing RDNA4 FP8 kernel path (vllm#28649). — [ivangotoy](https://github.com/ivangotoy/llama-server-rdna4-vulkan)
- **Community gfx1201 Windows llama.cpp runtime ("ROCmFPX"):** current build 20261022-01, tested on the RX 9070. — [HF Roland2531](https://huggingface.co/Roland2531/llama.cpp-ROCmFPX-gfx1201-Windows-x64)

### Inferences
- **Recommended stack:** native Windows 11 + official `llama-b<N>-bin-win-vulkan-x64.zip` + `llama-server` in router mode with `--models-preset`, with clients in WSL2 calling it over HTTP.
  - Router mode replaces llama-swap for most needs.
  - Keep the `win-rocm-10.0` zip alongside and switch to it for prompt-heavy work if local llama-bench shows a prompt-processing win.
- **LM Studio** (headless via `lms server start`) is the low-effort alternative with both Vulkan and ROCm runtimes and the same API surface. It typically lags llama.cpp master by days to weeks.
- **Ollama** on Windows works on this card only via Vulkan, unless you use a community build.
- **KoboldCpp:** not researched in depth because of the tool-call budget. It builds on llama.cpp and has offered Vulkan on Windows; this needs verification.

### Gaps
- No official LM Studio statement was found on its ROCm runtime version or gfx1201 support on Windows as of Oct 2026.
- The KoboldCpp RDNA4 status was not verified.
- How Lemonade's router interacts with its Anthropic endpoint was not verified.

## 4. MTP heads and speculative decoding on AMD

### Takeaway
Mainline llama.cpp now has a broad `--spec-type` family: draft models, EAGLE3, DFlash, n-gram variants and **`draft-mtp`**, which uses MTP heads embedded in the GGUF. These are backend-agnostic in design. I found no official AMD-specific restriction, and no published HIP or Vulkan MTP benchmarks for RDNA4.

### Cited Findings
- `docs/speculative.md` (master, Nov 2026) lists these `--spec-type` values: `draft-simple` (`-md/--spec-draft-model`, `--spec-draft-n-max`, default 3), `draft-eagle3`, `draft-dflash`, `draft-dspark`, `draft-mtp` ("Uses Multi Token Prediction heads from the main model"), `ngram-cache`, `ngram-simple`, `ngram-map-k`, `ngram-map-k4v` and `ngram-mod`. Types can be combined with commas, and `--spec-default` enables `ngram-mod`. — [speculative.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/speculative.md)
- Community dates for MTP disagree: one says it merged 16 May 2026, another says July 2026 (PR #22673). — [mer.vin](https://mer.vin/2026/05/run-qwen-3-6-mtp-in-llama-cpp-faster-local-inference-with-built-in-speculative-decoding/), [substack](https://johnpaulwile.substack.com/p/multi-token-prediction-mtp-in-llamacpp)
- MTP needs a GGUF that keeps the `blk.*.nextn.*` tensors (unsloth GGUFs do). A non-MTP quant errors. Community reports for Qwen3.8-27B show +33-39% decode at 0.69-0.87 acceptance, mostly on CUDA. — [sudoingX/qwen38-mtp](https://github.com/sudoingX/qwen38-mtp)
- Community: a SYCL issue notes Vulkan does not show the memory growth that SYCL shows with `draft-mtp`. A clean-up PR says parallel decoding with MTP is "still highly suboptimal". — [llama.cpp #23203](https://github.com/ggml-org/llama.cpp/issues/23203), [PR #23269](https://github.com/ggml-org/llama.cpp/pull/23269)

### Inferences
- On a 16 GB card, MTP is attractive because it needs no second draft model in VRAM. Expect the gain to be measured locally. It is best with `--parallel 1`.

### Gaps
- No RDNA4, Vulkan or HIP MTP or draft-model benchmark was found.
- LM Studio's speculative and MTP support status on AMD was not verified.

## 5. RDNA4-specific bugs, drivers and regressions (Aug-Oct 2026)

### Takeaway
There are open llama.cpp Vulkan issues on gfx1201: a ~12% prefill regression from MoE tile selection, and a decode collapse on Qwen3.6-35B-A3B. Both were reported on Linux RADV, and their effect on the Windows proprietary driver is unknown. AMD's ROCm 10.1 pairs with Adrenalin 26.10.41.05.

### Cited Findings
- **llama.cpp #29892 (about early Oct 2026, appears open):** a Vulkan prefill regression of about 12% on the RX 9070 XT (RADV) since PR #29182 (MoE-aware `mul_mat_id` tile selection, commit 94a0ae3e7). Reverting restores about 2146 vs 1875 t/s. — [issue #29892](https://github.com/ggml-org/llama.cpp/issues/29892)
- **llama.cpp #26795 (about Aug 2026):** Qwen3.6-35B-A3B (GATED_DELTA_NET) decode collapses to about 4 t/s on gfx1201 RADV (Mesa 25.3.6), while prefill stays at about 3,200 t/s. — [issue #26795](https://github.com/ggml-org/llama.cpp/issues/26795)
- **ROCm 10.1.0 (2026-10-05):** the listed Windows driver is Adrenalin 26.10.41.05. The WSL2 preview known issue is that device memory faults can hang the process. — [ROCm 10.1.0 release notes](https://rocm.docs.amd.com/en/latest/about/release-notes.html)
- **Official llama.cpp Windows ROCm zip:** bundles its own `amdhip64_7.dll`, because Adrenalin's System32 copy would otherwise win and can mismatch. — [release.yml](https://github.com/ggml-org/llama.cpp/blob/master/.github/workflows/release.yml)

### Inferences
- Run Adrenalin 26.10.x or newer. If an MoE model's prefill looks low on Vulkan, compare against a build from before #29182 or against the ROCm zip.
- If you use Qwen3.6-35B-A3B-style hybrid models on Vulkan, check the status of #26795 first. ROCm may be the workaround.

### Gaps
- No Adrenalin-specific llama.cpp regressions were found for Aug-Oct 2026.
- The issue dates are approximate; the search results gave only "about N days ago".
