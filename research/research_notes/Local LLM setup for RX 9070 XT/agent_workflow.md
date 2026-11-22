# Agent-managed local inference from WSL2 (Windows 11 host, RX 9070 XT), as of 2026-11-02

Research done 2026-11-02 from about 20 searches and fetches. Dates are the date a page was fetched (2026-11-02), plus the page's own "updated" date where it gave one. Most commands come from official docs. Blog and Reddit-mirror claims are marked as secondary.

## 1. Control plane: how a WSL2 process drives Windows-side installs and services

### Takeaway
WSL interop lets the agent run any Windows `.exe` from zsh (`powershell.exe`, `cmd.exe /C`, `winget.exe`). The process runs as the logged-in Windows user, with the WSL process's rights and no elevation. Two binaries cover the server side: llama-swap (in winget) in front of llama-server, and LM Studio's `llmster` daemon driven by `lms`. Run the server at user logon, through a Scheduled Task or LM Studio's run-on-login setting. Wrap it as a Windows service only if it must run before logon.

### Cited findings
- **Running Windows tools from WSL:** WSL runs Windows tools from the Linux command line as `[tool-name].exe`. The process keeps the WSL working directory, "Have the same permission rights as the WSL process", "Run as the active Windows user", and shows in Task Manager. "piping, redirects, and even backgrounding work as expected." — [MS Learn, Working across file systems (updated 2026-06-02)](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
- **Invoking Windows tools:** The tool name must include the `.exe` extension. CMD built-ins need `cmd.exe /C`, for example `cmd.exe /C dir`. Arguments reach the Windows binary unmodified. — [MS Learn filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
- **Sharing environment variables:** `WSLENV` lists the variables shared between WSL and Win32. Its flags are `/p` (translate a path), `/l` (a list of paths), `/u` (only when running WSL from Win32) and `/w` (only when running Win32 from WSL). — [MS Learn filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
- **Installing llama-swap:**
  - Windows: `winget install llama-swap` and `winget upgrade llama-swap`. The README says the WinGet package is community-maintained. Prebuilt Windows amd64 binaries are on the GitHub releases page.
  - Docker images: `unified-cuda13`, `unified-cuda` and `unified-vulkan`. These are Linux images.
  - Source: [llama-swap README, fetched 2026-11-02](https://github.com/mostlygeek/llama-swap)
- **llama-swap control API:**
  - `POST /api/models/unload` unloads every running model, and `POST /api/models/unload/:model_id` unloads one.
  - `POST /api/models/pause` unloads everything and rejects inference until `POST /api/models/resume` is called.
  - `/running` lists running models. `/health` and `/logs/stream` are also available.
  - `/metrics` gives Prometheus system and GPU metrics.
  - Source: [llama-swap README](https://github.com/mostlygeek/llama-swap)
- **LM Studio headless (`llmster`):** `llmster` is the "recommended" headless option, "packaged from the LM Studio desktop app's core", and was introduced with LM Studio 0.4.0.
  - Windows install: `irm https://lmstudio.ai/install.ps1 | iex`
  - Linux and macOS install: `curl -fsSL https://lmstudio.ai/install.sh | bash`
  - Start it with `lms daemon up`.
  - Startup-task docs exist only for Linux (systemctl).
  - The second option is the desktop app with run-on-login enabled in settings. With it, closing the app minimises it to the tray and the server keeps running. "Auto Server Start" restores the last server state.
  - Source: [LM Studio headless docs](https://lmstudio.ai/docs/developer/core/headless)
- **`lms` commands:**
  - Daemon: `lms daemon up|down|status|update`
  - Server: `lms server start|stop|status`
  - Models: `lms get`, `lms load [--gpu=max|auto|0.0-1.0] [--context-length=N] [--identifier=...]`, `lms unload [--all]`, `lms ls`, `lms ps`
  - Other: `lms log stream`, `lms runtime`
  - Source: [LM Studio CLI docs](https://lmstudio.ai/docs/cli)
- **Servy:** an open-source wrapper that turns any executable into a Windows service. It has a CLI and a PowerShell module, and handles environment variables, working directory, dependencies and restarts on custom health checks. A service running under an account other than LocalSystem, NetworkService or LocalService needs write access to `%ProgramData%\Servy`. — [Servy wiki](https://github.com/aelassas/servy/wiki/Servy-Desktop-App)

### Inferences
- **How the agent should call PowerShell:** use `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -NonInteractive -Command "..."`, or put PowerShell 7 (`pwsh.exe`) on PATH with an alias in `.zshrc`. Interop runs without elevation, so admin actions such as firewall rules, service creation, or winget packages that need machine scope go through `Start-Process -Verb RunAs`. That triggers a UAC prompt, and the UAC click is the user's natural approval point.
- **Scheduled Task or Windows service:** prefer a per-user Scheduled Task at logon, such as `Register-ScheduledTask` with an `-AtLogOn` trigger running `llama-swap.exe --config C:\llm\llama-swap.yaml`. Windows services run in Session 0. GPU compute from Session 0 usually works, but driver and Vulkan quirks have been reported. A logon task also matches "only when I'm using the PC". This is unverified for the RX 9070 XT. Test once before choosing a service (NSSM, WinSW or Servy).
- **Starting a background process from WSL:** `powershell.exe -c "Start-Process -WindowStyle Hidden llama-swap.exe -ArgumentList ..."` starts a detached Windows process that outlives the WSL shell. Backgrounding the `.exe` directly from zsh ties it to the WSL session.

### Gaps
- I did not fetch current NSSM or WinSW docs. NSSM has had no maintained release for years (from my own background knowledge; not verified this session).
- No source tested running llama-server as a Session-0 service on an AMD GPU with Vulkan or ROCm/HIP.
- The LM Studio docs do not give a Windows equivalent of the Linux startup task for `llmster`.

## 2. WSL2 networking to reach a Windows-hosted server

### Takeaway
Use mirrored networking. Set `[wsl2] networkingMode=mirrored` in `%UserProfile%\.wslconfig`, and WSL then reaches a Windows server at `127.0.0.1:<port>`, so the server can stay bound to loopback. In NAT mode, WSL must use the host IP from the default route, and the server must bind beyond loopback and get a firewall rule.

### Cited findings
- **Microsoft's recommendation:** WSL uses NAT by default, and "we recommend trying the new Mirrored networking mode to get the latest features and improvements." — [MS Learn, Accessing network applications with WSL (updated 2026-06-02)](https://learn.microsoft.com/en-us/windows/wsl/networking)
- **Localhost in mirrored mode:** in mirrored mode, "the Windows host and WSL2 VM can connect to each other using `localhost` (127.0.0.1)". The IPv6 loopback `::1` is not supported. Mirrored mode needs Windows 11 22H2 or later. — [MS Learn networking](https://learn.microsoft.com/en-us/windows/wsl/networking)
- **Reaching Windows in NAT mode:** find the host IP with `ip route show | grep -i default | awk '{ print $3}'`. Remote-IP connections count as LAN traffic, so the Windows app may need to bind `0.0.0.0`. — [MS Learn networking](https://learn.microsoft.com/en-us/windows/wsl/networking)
- **Firewall:** the Hyper-V firewall is on by default from Windows 11 22H2 with WSL 2.0.9. For inbound connections to WSL, the docs give two commands:
  - Allow all inbound: `Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow`
  - Allow one port: `New-NetFirewallHyperVRule ... -VMCreatorId '{40E0AC32-...}' -Protocol TCP -LocalPorts 80`

  Source: [MS Learn networking](https://learn.microsoft.com/en-us/windows/wsl/networking)
- **DNS tunnelling:** `dnsTunneling` is on by default on Windows 11 22H2 and later. — [MS Learn networking](https://learn.microsoft.com/en-us/windows/wsl/networking)

### Inferences
- Recommended `.wslconfig`:
  ```ini
  [wsl2]
  networkingMode=mirrored
  ```
  Apply it with `wsl --shutdown`. The agent can write the file through `/mnt/c/Users/<user>/.wslconfig`, but the user must approve the restart, because it kills the agent's own session.
- In mirrored mode, bind llama-swap and llama-server to `127.0.0.1`. Traffic from WSL to a Windows loopback port should not need a Windows Defender Firewall inbound rule, and loopback also keeps the server off the LAN. The Hyper-V firewall rules above control inbound traffic to WSL, not to Windows.
- If an inbound rule turns out to be needed, it is a single `New-NetFirewallRule` call and needs admin rights.
- Health check from WSL: `curl -s http://127.0.0.1:8080/health` and `curl -s http://127.0.0.1:8080/v1/models`.

### Gaps
- I did not fetch the `.wslconfig` reference page, so `hostAddressLoopback` and the `ignoredPorts` semantics are not verified.
- I found no source confirming whether a Windows-side firewall rule is needed for WSL-to-Windows loopback in mirrored mode. The inference above needs a live test.

## 3. Config-as-code for models

### Takeaway
Keep a git repo, for example `~/projects/llm` in WSL ext4, holding:
- `llama-swap.yaml`, the source of truth for models, flags, TTLs and aliases
- optionally a llama-server `--models-preset` INI file
- PowerShell scripts to install, start, stop and register the logon task
- a sync script that copies the config to `C:\llm\`
- benchmark scripts with their results committed as JSONL

llama-swap gives per-model commands, TTL, aliases and groups. llama-server's native router mode (`--models-dir`, `--models-preset`, `--models-max`, `--sleep-idle-seconds`) is a lighter, single-binary alternative.

### Cited findings
- **llama-swap top-level keys:**
  - `healthCheckTimeout`: default 120 s, minimum 15
  - `logLevel`
  - `startPort`: default 5800, the base for `${PORT}`
  - `macros`: can read environment variables with `${env.VAR}`
  - `apiKeys`: an empty list disables auth
  - Source: [llama-swap docs/config.example.yaml](https://raw.githubusercontent.com/mostlygeek/llama-swap/main/docs/config.example.yaml)
- **llama-swap per-model keys:**
  - `cmd` and `cmdStop`
  - `proxy`: defaults to `http://localhost:${PORT}`
  - `checkEndpoint`: default `/health`
  - `aliases` and `env`
  - `ttl`: seconds idle before unload. `0` never unloads; `-1` uses the global default.
  - `unlisted`
  - `filters.stripParams` and `filters.setParams`
  - `useModelName`
  - `concurrencyLimit`
  - Source: [llama-swap config example](https://raw.githubusercontent.com/mostlygeek/llama-swap/main/docs/config.example.yaml)
- **llama-swap groups and other blocks:**
  - Groups (as fetched, under `routing.router.settings.groups.<name>`): `swap` (default true), `exclusive` (default true), `persistent` and `members`.
  - Preload: `hooks.on_startup.preload`.
  - `peers` forwards to another server, addressed as `<peer>/<model>`.
  - Source: [llama-swap config example](https://raw.githubusercontent.com/mostlygeek/llama-swap/main/docs/config.example.yaml)
- **Minimal llama-swap model:** `cmd: llama-server --port ${PORT} --model /path/to/model.gguf`. llama-swap serves both the OpenAI API and `v1/messages` plus `v1/messages/count_tokens`. — [llama-swap README](https://github.com/mostlygeek/llama-swap)
- **llama-server router flags:**
  - `--models-dir PATH` and `--models-preset PATH` ("INI file containing model presets")
  - `--models-max N`: default 4
  - `--models-memory-margin N`: MiB to keep free per device, freed by LRU unload
  - `--models-autoload`
  - `--sleep-idle-seconds N`: default -1, disabled. `GET /props` reports `is_sleeping`.
  - Source: [llama.cpp server README, fetched 2026-11-02](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- **Other llama-server flags:**
  - `--jinja`: on by default
  - `-fa on|off|auto`: default auto
  - `-c 0`: takes the context size from the model
  - `-np` parallel slots
  - `--kv-unified-per-slot N`
  - `--metrics`: Prometheus metrics
  - Source: [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- **LM Studio unloading:**
  - JIT-loaded models have a 60-minute TTL by default.
  - Set a per-request TTL with a `ttl` field in seconds.
  - `lms load --ttl <sec>` sets a TTL. Without the flag, a model loaded by `lms load` has no TTL and stays loaded.
  - Auto-Evict is on by default and keeps at most one JIT model loaded.
  - Source: [LM Studio TTL and Auto-Evict](https://lmstudio.ai/docs/developer/core/ttl-and-auto-evict)

### Inferences
- **Example llama-swap model entry.** Assemble it from the documented keys and validate it against the current config example before use. Paths are Windows paths because llama-swap runs on Windows.
  ```yaml
  healthCheckTimeout: 300
  startPort: 5800
  macros:
    server: 'C:\llm\bin\llama-server.exe --host 127.0.0.1 --port ${PORT} --jinja -fa on --metrics'
  models:
    qwen-coder-30b-q4:
      cmd: '${server} -m D:\models\<file>.gguf -c 65536 -ngl 99 --cache-type-k q8_0 --cache-type-v q8_0'
      aliases: [coder]
      ttl: 900
  ```
- **GPU free for gaming:** give every model a TTL (for example 600–900 s). Add a "game mode" script that calls `POST /api/models/pause` on llama-swap or `lms unload --all`, and `/api/models/resume` afterwards.
- **Model choice and benchmarks:** the agent edits the YAML in git, syncs it, then restarts or reloads llama-swap. Each benchmark run records the git SHA of the config.
- **Model storage:** keep GGUFs on an NTFS drive the Windows server reads natively, such as `D:\models`. Keep scripts and config in WSL ext4 (see section 6).

### Gaps
- I did not fetch the INI format for `--models-preset`. Its example is in the server README sections I did not see.
- I did not verify whether llama-swap watches its config file and reloads automatically.
- The groups YAML path `routing.router.settings.groups` is as the fetch tool reported it. It may be a summary artefact of a top-level `groups:` key, so check the raw file.

## 4. Benchmarking and evaluation the agent can run

### Takeaway
Measure in three layers:
1. **Raw speed:** `llama-bench` with JSON output, sweeping quants, flash attention and depth.
2. **Speed through the real server:** an OpenAI-compatible streaming script that records time to first token, prompt-processing and token-generation rates at 8k/32k/64k prompts, plus `/metrics`.
3. **Quality on the user's own tasks:** a small custom suite of repo tasks with tests as the oracle, optionally an Aider polyglot subset.

### Cited findings
- **llama-bench test types:**
  - `-p` prompt tokens (default 512)
  - `-n` generated tokens (default 128)
  - `-pg pp,tg`: prompt then generation
  - `-d N`: prefills the KV cache to depth N, which shows long-context slowdown
  - Source: [llama-bench README](https://github.com/ggml-org/llama.cpp/blob/master/tools/llama-bench/README.md)
- **llama-bench options:**
  - `-r` repetitions (default 5)
  - `-o md|csv|json|jsonl|sql`
  - `-fa` and `-ngl`
  - Comma-separated values sweep every combination.
  - Results print as `pp512` and `tg128` in t/s.
  - Timings exclude tokenisation and sampling.
  - Source: [llama-bench README](https://github.com/ggml-org/llama.cpp/blob/master/tools/llama-bench/README.md)
- **Server metrics:** `--metrics` turns on a Prometheus endpoint. `GET /slots` and `GET /props` expose slot and config state. — [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- llama-swap `/metrics` adds system and GPU metrics, and llama-swap has an Activity view. — [llama-swap README](https://github.com/mostlygeek/llama-swap)

### Inferences
- **Suggested benchmark command:**
  ```
  llama-bench.exe -m <a.gguf>,<b.gguf> -p 512,4096 -n 128 -d 0,16384,32768 -fa on -ngl 99 -o jsonl > results/<date>-<model>.jsonl
  ```
  Run it through interop and commit the results.
- **Harness-level timing:** Claude Code's prompt is large, so measure time to first token at 20–30k-token prompts. Prefill speed decides how usable an agent harness feels on 16 GB.
- **Quality suites:**
  - **Promptfoo** (YAML test configs, any OpenAI-compatible provider) and **lm-eval-harness** (its `local-chat-completions` model type) both point at `http://127.0.0.1:<port>/v1`. These descriptions come from my own background knowledge; I did not verify them this session.
  - **Aider polyglot:** the benchmark (225 Exercism exercises) runs in Docker. A 20–40-exercise subset is a practical local comparison.
  - **Own-task suite:** 10–20 real tasks from the user's repos, each with a test command. Run headless (`claude -p`, `opencode run`, `pi -p`) in throwaway git worktrees, and score pass/fail, wall time and tokens. This is the most decision-relevant measure.

### Gaps
- I fetched no source this session for Aider polyglot setup, promptfoo or lm-eval-harness against local endpoints. The commands above are unverified.

## 5. Coding-agent harnesses with local models (late 2026)

### Takeaway
All three main servers now speak the Anthropic Messages API: llama.cpp, LM Studio and Ollama, plus llama-swap in front of llama.cpp. So Claude Code can be pointed at a local model with `ANTHROPIC_BASE_URL`. Claude Code's prompt is large, though (tens of thousands of tokens by secondary reports), and Anthropic does not support non-Claude upstreams. On a 16 GB card with roughly 32–64k usable context, lean harnesses fit better:
- **Pi:** a very small system prompt and a native llama.cpp integration.
- **opencode:** first-class `@ai-sdk/openai-compatible` provider config.

Use Claude Code locally only with the cache-friendly env vars below.

### Cited findings
- **llama.cpp Anthropic API:** llama-server added `POST /v1/messages` with streaming and `POST /v1/messages/count_tokens` through PR #17570. The HF blog post on it is dated 2026-01-19. Requests are converted to the OpenAI format internally. — [HF blog: Anthropic Messages API in llama.cpp](https://huggingface.co/blog/ggml-org/anthropic-messages-api-in-llamacpp); [PR #17570](https://github.com/ggml-org/llama.cpp/pull/17570)
- **LM Studio Anthropic API:** LM Studio supports `POST /v1/messages`. Claude Code setup: `export ANTHROPIC_BASE_URL=http://localhost:1234`, `export ANTHROPIC_AUTH_TOKEN=lmstudio`, `claude --model openai/gpt-oss-20b`. The page does not say which version added it. — [LM Studio Anthropic compat](https://lmstudio.ai/docs/developer/anthropic-compat)
- **Ollama with Claude Code:**
  - Manual setup: `ANTHROPIC_AUTH_TOKEN=ollama`, `ANTHROPIC_API_KEY=""`, `ANTHROPIC_BASE_URL=http://localhost:11434`.
  - One command: `ollama launch claude`. Non-interactive: `ollama launch claude --model <m> --yes`.
  - The docs recommend tool-capable models and a context of "64k or higher". Their local example uses `qwen3.5`.
  - Source: [Ollama docs: Claude Code integration](https://docs.ollama.com/integrations/claude-code)
- **Claude Code setup:**
  - Point it at the server with `ANTHROPIC_BASE_URL` plus `ANTHROPIC_AUTH_TOKEN` (sent as a Bearer header) or `ANTHROPIC_API_KEY` (sent as `x-api-key`).
  - Persist these in the `env` block of `~/.claude/settings.json` or `.claude/settings.local.json`. A settings value beats a shell export.
  - Verify with a curl `POST $ANTHROPIC_BASE_URL/v1/messages`, then check `/status`.
  - Source: [Claude Code docs: connect to an LLM gateway](https://code.claude.com/docs/en/llm-gateway-connect.md)
- **Useful Claude Code variables for a local endpoint:**
  - `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` adds the server's models to `/model`.
  - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` turns off background traffic.
  - `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` fixes 400 "Extra inputs are not permitted" errors.
  - `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is clamped to at least 100,000 tokens, so a local server with less context than that relies on manual `/compact`.
  - `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
  - Source: [Claude Code gateway connect](https://code.claude.com/docs/en/llm-gateway-connect.md)
- **Anthropic's support position:** Anthropic "doesn't support routing Claude Code to non-Claude models through any gateway." Setting `ANTHROPIC_AUTH_TOKEN` replaces the claude.ai subscription credential for those requests. Remote Control and voice dictation are unavailable while it is set. — [Claude Code docs: LLM gateways](https://code.claude.com/docs/en/llm-gateway); [connect page](https://code.claude.com/docs/en/llm-gateway-connect.md)
- **Unsloth's local-model guidance for Claude Code:**
  - Set `CLAUDE_CODE_ATTRIBUTION_HEADER=0`. Unsloth says the attribution header invalidates the KV cache and makes inference "90% slower". Also set `CLAUDE_CODE_ENABLE_TELEMETRY=0`.
  - Optional launch flags for speed: `--bare --exclude-dynamic-system-prompt-sections`.
  - llama-server example: `--alias`, `--kv-unified`, `--cache-type-k q8_0 --cache-type-v q8_0`, and `--chat-template-kwargs '{"enable_thinking": false}'` to turn thinking off.
  - Source: [Unsloth docs: Claude Code (undated)](https://unsloth.ai/docs/basics/claude-code)
- **Community reports on Claude Code locally (secondary):**
  - A March 2026 thread: dynamic headers at the start of each prompt force a full re-prefill, costing 30–50 s on a 17k context.
  - A September 2026 thread: about 45–50k-token first-turn prefill with Ollama.
  - Sources: Reddit mirrors, [2026-03-27 snapshot](https://reddit.sentinel-team.org/posts/1s258a7/snapshots/2026-03-27T16%3A30%3A05.15591Z) and [2026-09-04 snapshot](https://reddit.sentinel-team.org/posts/1w5974c/snapshots/2026-09-04T21%3A20%3A12.3645Z)
  - A README notes that Claude Code's tools, MCP schemas and system prompt eat most of a 64–72k window. — [lukoshkin/llmm](https://github.com/lukoshkin/llmm)
- **Prompt sizes (secondary):** Pi's whole prompt including tools is under about 1,000 tokens. Claude Code with all tools is about 24k, and Codex CLI's baseline is about 8.5k. Figures vary by source. — [tensorlake blog](https://www.tensorlake.ai/blog/pi-coding-agent-efficient-system-prompting); [Daniel Vaughan, 2026-04-19](https://codex.danielvaughan.com/2026/04/19/system-prompts-compared-codex-gemini-claude-code/); [insiderllm](https://insiderllm.com/guides/claude-code-vs-pi-agent-local-ai/)
- **Pi with llama.cpp (secondary):**
  - Pi has a llama.cpp router integration: start `llama-server` with a models directory, `--jinja` and `-c 32768`, then use `/login llama.cpp` and `/llama` in Pi.
  - One test found Pi doesn't inject the working directory into the prompt.
  - Sources: [aicybr Pi 1.4 guide](https://aicybr.com/blog/pi-1-4-coding-agent-local-llm-ollama-llamacpp-mcp-security); [Vaughan harness comparison](https://codex.danielvaughan.com/2026/04/19/does-pi-outperform-codex-cli-for-local-models/)
- **opencode local providers:**
  - Configure them in `opencode.json` under `provider.<id>` with `"npm": "@ai-sdk/openai-compatible"`, `options.baseURL`, and `models.<id>.limit.context/output`.
  - Documented examples: llama.cpp (`http://127.0.0.1:8080/v1`, 128000 context and 65536 output in the example), LM Studio (`:1234/v1`) and Ollama (`:11434/v1`).
  - For Ollama the docs advise: "try increasing `num_ctx` ... Start around 16k - 32k".
  - Source: [opencode providers docs](https://opencode.ai/docs/providers/)

### Inferences
- **Recommended ranking for this machine (16 GB, likely 30B-class MoE or 14–24B dense at Q4, 32–64k context):**
  1. Pi or opencode against llama-swap's OpenAI endpoint, for daily local use.
  2. Aider, for edit-format-driven, low-overhead tasks. It also has its own polyglot benchmark.
  3. Claude Code with `CLAUDE_CODE_ATTRIBUTION_HEADER=0`, a `--bare`-style lean profile and a matching `--alias`, when the user wants Claude Code's UX. Expect slow first turns.
- **Fit to the user's setup:** the user's main agent is Claude Code itself. The best use of local models is likely as a side harness, or as a model the main agent calls for cheap subtasks, not as a replacement for Claude.
- **llama-swap as the single front door:** it serves both `/v1/chat/completions` and `/v1/messages`, so every harness can use one base URL (`http://127.0.0.1:8080`), with aliases mapping to models.

### Gaps
- I did not fetch current docs for Qwen Code, Crush or Continue this session, and have no verified late-2026 data on their prompt sizes or local config.
- I have no first-hand 2026 benchmark of harness success rates on 32k against 128k contexts.
- The Claude Code prompt-size figure (about 24k) comes from a secondary source and depends on the version and the tools and MCP servers enabled.
- I did not verify a published date for Unsloth's guidance.

## 6. Practical gotchas

### Takeaway
- Store GGUFs on a native Windows NTFS path that the Windows server reads directly. Never serve them across `/mnt/c` or `\\wsl$`, and expect them to fill tens to hundreds of GB.
- Admin actions and SmartScreen prompts are the user's approval points.
- Free the GPU with TTLs plus a pause or unload "game mode" command.

### Cited findings
- **Cross-filesystem performance:** Microsoft recommends against working across OS filesystems: store files in the filesystem of the OS whose tools use them. Performance improves when WSL-side work stays on the Linux filesystem rather than `/mnt/c`. — [MS Learn filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
- **GPU release controls:**
  - llama-swap: `ttl` per model, `POST /api/models/pause` and `/resume`, and `/api/models/unload` — [llama-swap README](https://github.com/mostlygeek/llama-swap)
  - llama-server: `--sleep-idle-seconds` and `--models-memory-margin` — [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
  - LM Studio: a 60-minute JIT TTL by default, and no TTL for models loaded with `lms load` unless `--ttl` is passed. Use `lms unload --all` to free the GPU. — [LM Studio TTL](https://lmstudio.ai/docs/developer/core/ttl-and-auto-evict)

### Inferences
- **Downloads:** have the Windows side fetch models, with `lms get`, `hf.exe download` or `llama-server -hf` (`HF_HOME` set to `D:\hf`). Pulling them into WSL ext4 and copying them out is slower, because a Windows process reading `\\wsl$` goes through 9P.
- **SmartScreen and Defender:**
  - Unsigned llama.cpp release zips downloaded through a browser get a Mark-of-the-Web. Clear it with `Unblock-File`, or download with `Invoke-WebRequest` or winget.
  - Defender real-time scanning of multi-GB GGUF reads can slow the first load. A Defender exclusion for `D:\models` needs admin rights and the user's sign-off, as a security trade-off.
  - Unverified this session; based on general Windows behaviour.
- **Power and thermals:** long benchmark sweeps hold the GPU at full power. Run sweeps on demand, not on a schedule. AMD Adrenalin per-app tuning profiles or a power limit can cap them. Unverified.
- **Disk budget:** one 30B Q4 model is about 17–20 GB, and comparing three quants of two models needs about 100 GB. Have the agent check free space (`Get-PSDrive`) before `lms get` or `hf download`.

### Gaps
- No source fetched on AMD RX 9070 XT specifics: ROCm/HIP Windows builds against Vulkan for llama.cpp, Adrenalin settings, or whether LM Studio's Vulkan or ROCm runtime is faster on RDNA4. This is likely covered by another researcher.
- SmartScreen and Defender behaviour for winget-installed llama-swap and for `llmster` was not verified.
