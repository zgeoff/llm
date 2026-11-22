# Switching models, game mode, timing and autostart

`llm load`, `llm unload` and `llm ttft` talk to llama-swap through its API, so run `llm up` before
them. `llm compare` reads only the rows in `results/`. `llm game` stops serving itself, and starts
it again only when it was up. `llm autostart` registers a Windows Scheduled Task through PowerShell.
`llm <command> --help` lists the flags of each command, and
[the README](../../README.md#quick-start) covers `llm up` and `llm bench`, whose rows `llm compare`
also reads.

## Load and unload a model

`llm load` loads a model ahead of its first request, and swaps out the one that runs. `llm unload`
unloads one model, or every model when no id is given:

```sh
llm load qwen3.6-35b-a3b
llm unload qwen3.6-35b-a3b
llm unload
```

## Game mode

`llm game on` unloads every model, stops llama-swap and any llama-server, and records whether
serving was up. When the game ends, run `llm game off`, which starts llama-swap again only if
serving was up:

```sh
llm game on
llm game off
```

## Time the first token and compare

Time the first streamed token of a model through llama-swap: once cold (the model is unloaded first,
so the time includes the load), then `--reps` times warm, with the output tokens per second. The
rows go to `results/<id>-ttft.jsonl`. `llm compare` tabulates the latest bench and ttft rows per
model and backend, for the ids you name or for all of them:

```sh
llm ttft qwen3.6-35b-a3b --reps 3
llm compare
```

## Autostart

`llm autostart on` registers the Scheduled Task `llm llama-swap`, which starts llama-swap with the
generated config at every Windows logon. It prints the task first, then shows one UAC prompt,
because a logon trigger needs elevation. The task runs as you, without elevation. Declining the
prompt changes nothing. `off` removes the task, and `status` shows it:

```sh
llm autostart on
llm autostart status
llm autostart off
```
