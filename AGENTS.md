# Agent Guidelines

`llm` is a Bun and TypeScript command line tool that runs in WSL2 and manages local LLMs on the
Windows host: it installs llama.cpp and llama-swap, downloads and inspects GGUF models, generates
the llama-swap config from `models.yaml`, serves the models, and benchmarks them. `models.yaml` at
the repo root is the catalog, and every command reads it through `src/catalog/`.

## Required reading

The rules a task needs are not repeated here. Load the skill for the work before starting it.

| Skill          | Load before                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `code-style`   | writing, reviewing, or renaming any TypeScript                              |
| `testing`      | designing, writing, or reviewing tests                                      |
| `docs-writing` | writing or editing any committed prose: README, this file, skills, comments |
| `ci-design`    | changing a workflow, a dependency exception, or an audit ignore             |

## Repo structure

```text
src/
  cli.ts        the entry point, wired to the real catalog and the real /mnt
  run-cli.ts    the command tree and the exit code of a failed command
  commands/     one file per command, each a gunshi command built from the injected dependencies
  catalog/      the zod schema of models.yaml and its parser
  llama-swap/   the pure generator of the llama-swap config
  serving/      writing the config, starting, stopping, loading and unloading llama-swap, probing it
  game/         the state file that game mode keeps, in ~/.local/state/llm
  ttft/         the streamed time-to-first-token measurement
  compare/      the parser of the rows in results/ and the latest-row table
  autostart/    the Scheduled Task scripts, the elevated wrapper and the status parser
  install/      GitHub releases, asset choice and the install script
  huggingface/  the file list, the pull script and the upstream chat template
  gguf/         the GGUF header parser, the model summary and the KV cache cost
  bench/        the llama-bench script and the parser of its rows
  proxy/        the proxy server, its request transform and the systemd unit
  profile/      the atc agent entry and the reads and writes of the atc config
  host/         reads of the Windows drives through /mnt, for sizes only
  windows/      the PowerShell runner, detached start, host IP and path helpers
  format/       text output
  testing/      test factories and the test preload
models.yaml     the catalog: the machine block and every model
templates/      chat templates that `llm install` copies to C:\llm\templates
results/        the rows that `llm bench` appends, one file per model and backend
```

## Commands

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run format:check`, `bun run deadcode`
  and `bun run audit` are the six CI scripts. Run each by script name.
- `bun run format` fixes formatting.
- `llm` runs `install`, `pull`, `rm`, `inspect`, `ls`, `disk`, `config`, `up`, `down`, `status`,
  `logs`, `bench`, `proxy`, `profile`, `load`, `unload`, `game`, `ttft`, `compare` and `autostart`.
  A command never touches Windows or the network in a test: tests fake the PowerShell runner and
  answer HTTP with msw.
- `bun src/cli.ts <command>` runs the CLI from a checkout, and `bun link` installs `llm`.

## Windows interop

- `powershell.exe` is not on PATH in WSL. Run it by its full path,
  `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`, with
  `-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand <base64 UTF-16LE>`.
- Quote every value that a PowerShell script receives, by doubling each single quote in a
  single-quoted string. Never interpolate a raw value.
- Read model sizes and drive space through `/mnt/<drive>` metadata only (`stat`, `statfs`). Write no
  model bytes through `/mnt`, because 9P file access from WSL is slow. Windows downloads straight to
  `D:\models`.
- Start a long-running Windows process through `Invoke-CimMethod Win32_Process Create`, so the WSL
  call returns. A child of the PowerShell that WSL launched keeps the call open.
- WSL uses NAT networking, so the Windows host is the default route in `ip route show default`. Read
  it on every call, because it changes between WSL starts.
- llama.cpp sees two Vulkan devices: `Vulkan0` is the RX 9070 XT and `Vulkan1` is the integrated
  GPU. ROCm numbers them the other way: `ROCm1` is the RX 9070 XT. Always pass the device.
- The ROCm build needs the ROCm library folder on PATH. Set it in the llama-server process
  environment only, never system-wide.
- Run a script as administrator through `Start-Process -Verb RunAs`, which shows one UAC prompt, and
  check the result afterwards, because the elevated process cannot pipe output back. Never run one
  without printing what it does first.
- A listening Windows process on `0.0.0.0:8181` is reachable from WSL at the host IP with no
  firewall rule. When WSL cannot reach llama-swap but Windows reaches it on loopback, `llm up`
  prints the rule to run. The rule is scoped to the WSL interface alias, never to a subnet, because
  the WSL NAT subnet can change between WSL starts.
- The llama-swap config sets the ROCm `PATH` as a static value, never `${env.PATH}`.
- `llm down`, and `llm bench` when llama-swap runs, stop every `llama-server` on the host. Do not
  run them while a manual server runs.
- `llm proxy run` listens on `127.0.0.1:<machine.proxy.port>` in the catalog and forwards to
  llama-swap at the host IP, read again on each request. `install` writes
  `~/.config/systemd/user/llm-proxy.service` and runs `systemctl --user`.
- `llm profile` edits `~/.config/atc/config.json` after a backup named
  `config.json.bak-<UTC stamp>-profile-<id>`. It never restarts atc. A test points `atcConfigPath`
  and `homeDir` at a temp folder and fakes `runProcess`, so no test reads the real atc config or
  runs `systemctl`.
- In WSL, `ls` is an alias for `eza --icons` and can hang a non-interactive shell. Use `command ls`.

## Dependencies

- `bunfig.toml` holds new versions back for 7 days. When the latest version is younger, pin the
  newest version that passes, and add no exclusion for convenience.
- `@stylistic/eslint-plugin` has a `knip.json` ignore, because `@zgeoff/oxlint-config`, which
  `.oxlintrc.json` extends, loads it by name as a JS plugin.
- Runtime dependencies are `gunshi`, `zod`, `ts-pattern`, `tiny-invariant`, `yaml` and
  `@zgeoff/std`, whose `Clock` the commands take. YAML is written with `Bun.YAML` and read with the
  `yaml` package, because `Bun.YAML.parse` keeps the last of two equal keys. HTTP is `fetch`, and
  subprocesses are `Bun.spawn` or Bun's `$`.

## Git

- Work on a branch in a git worktree under `.worktrees/`, never on `main`.
- Commit messages and PR titles are Conventional Commits in the imperative mood. Open PRs with
  `.github/PULL_REQUEST_TEMPLATE.md`.
- Never edit `.github/` or the shared skills in `.claude/skills/`: repo-sync delivers them from
  zgeoff/tools.
