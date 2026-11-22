# atc agents

`llm profile <id>` adds an atc agent that runs Claude Code against a catalog model through the
proxy. It backs up `~/.config/atc/config.json`, refuses to overwrite an agent without `--force`, and
never restarts atc. A model whose template comes from the GGUF must be pulled first. `--rm` removes
an agent that a profile wrote.

```sh
llm profile qwen3.6-35b-a3b-heretic --name local-heretic
```

## The agent label

The label is `<name> (<traits>)`, where `name` is the model's `name` in the catalog (the model id
when it has none). The traits come in this order, joined with `·`, and the parentheses are left out
when there are none:

- `effort` when the chat template reads `reasoning_effort`.
- `vision` when the model has an `mmproj`.
- `abliterated` when its tags include `abliterated`.
