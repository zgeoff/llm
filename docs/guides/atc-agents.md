# atc agents

`llm profile <id>` adds an atc agent that runs Claude Code against a catalog model through the
proxy. It backs up `~/.config/atc/config.json` first, refuses to overwrite an agent without
`--force`, and never restarts atc. `--name` sets the agent's name, `local-<id>` by default, and
leaves the label as it is. `--rm <name>` removes an agent that a profile wrote, and
`llm profile --help` lists every flag.

1. When the catalog sets no `chatTemplateFile` for the model, pull the model first, because
   `llm profile` reads its chat template from the GGUF:

   ```sh
   llm pull qwen3.6-35b-a3b-heretic
   ```

2. Add the agent:

   ```sh
   llm profile qwen3.6-35b-a3b-heretic --name local-heretic
   ```

3. Restart the atc daemon, so it loads the agent.

The agent sends its requests to the proxy, so run the proxy and llama-swap before you use it.
[The README](../../README.md#quick-start) shows `llm proxy` and `llm up`.

## The agent label

The label is `<model_name> (<traits>)`, where `<model_name>` is the model's `name` in the catalog,
or the model id when it has none. The traits come in this order, joined with `·`, and the
parentheses are left out when there are none:

- `effort` when the chat template reads `reasoning_effort`.
- `vision` when the model has an `mmproj`.
- `abliterated` when its tags include `abliterated`.
