<div align="center">
  <h1>llm</h1>
</div>

A command line tool that installs, serves and benchmarks local LLMs on a Windows workstation from
WSL2.

`llm` keeps one catalog of models, `models.yaml`, and works from it: it installs llama.cpp and
llama-swap, downloads and inspects models, generates the config that llama-swap serves, starts the
server and benchmarks a model. Windows does the work, so no model bytes cross the WSL boundary.

## Quick start

Install Bun 1.4.3, then link the command:

```sh
bun install && bun link
```

List the models and their size on disk, show the free space of the models drive, and print the
llama-swap config that the catalog generates:

```sh
llm ls
llm disk
llm config --print
```

Install llama.cpp (Vulkan and ROCm), llama-swap and the chat templates under `C:\llm`:

```sh
llm install
```

Download a model, with its vision projector, and check it against its SHA256. `llm rm <id> --yes`
deletes it:

```sh
llm pull qwen3.6-35b-a3b --mmproj
```

Print the GGUF settings of a model, its KV cache cost, and how its chat template differs from the
upstream one:

```sh
llm inspect qwen3.6-35b-a3b
```

Write the config, start llama-swap, see what is loaded, read its log and stop it. If WSL cannot
reach the server, `llm up` prints the one elevated firewall command to run and never runs it:

```sh
llm up
llm status
llm logs -n 20
llm down
```

Benchmark a model at several context depths. The rows go to `results/<id>-<backend>.jsonl`, and
llama-swap stops for the run and starts again after it:

```sh
llm bench qwen3.6-35b-a3b --depths 0,8192,32768 --reps 3
```

Switch models, free the GPU for a game, time the first token, compare results and start llama-swap
at logon: `llm load`, `llm unload`, `llm game on|off`, `llm ttft`, `llm compare` and
`llm autostart on|off|status`. Follow [the guide](./docs/guides/switching-and-timing.md) for each.

Claude Code cannot talk to llama-swap directly, because its system blocks and effort field confuse a
local model. `llm proxy` is a small server on `127.0.0.1:8182` that drops the identity blocks, maps
`output_config.effort` to `reasoning_effort` and a thinking budget, and forwards the rest. Run it in
the foreground or as a systemd user service:

```sh
llm proxy run
llm proxy install
```

Add an atc agent that runs Claude Code against a catalog model through the proxy. It backs up
`~/.config/atc/config.json` and never restarts atc. See [the guide](./docs/guides/atc-agents.md) for
the agent label and the flags:

```sh
llm profile qwen3.6-35b-a3b-heretic --name local-heretic
```

Edit [`models.yaml`](./models.yaml) to change the machine paths, the backend of each model (Vulkan
or ROCm), and every model's repo, file, context size and launch options.

## Layout

- `src/` holds the CLI: one file per command under `src/commands/`, the catalog schema, and the
  llama-swap config generator.
- `results/` holds the rows that `llm bench` appends, one file per model and backend.
- `research/` holds the research reports behind the model choices.

Run `llm --help` to list the commands. Read [`docs/`](./docs/README.md) for the guides and
`AGENTS.md` for the rules for working in the repo.
