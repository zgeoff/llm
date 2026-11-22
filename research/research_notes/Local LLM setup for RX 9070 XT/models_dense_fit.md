# Dense 24B–31B and Gemma 4 26B-A4B models on a 16 GB RX 9070 XT (early Nov 2026)

Research date: 2026-11-02. Hardware assumed: AMD RX 9070 XT 16 GB (RDNA4), llama.cpp on Windows (Vulkan or ROCm), Ryzen 7 9800X3D, 64 GB DDR5. GGUF sizes come from bartowski's repos unless marked. The KV-cache and compute-buffer headroom figures are estimates, not measurements on RDNA4.

## VRAM fit and quant sizes

### Takeaway
A dense model must fit whole in VRAM, because a dense model that spills layers to system RAM slows sharply: one report has a 27B at 0.27 tok/s with CPU offload, against 20–30 tok/s for a 35B MoE on the same machine ([models_standard.md](./models_standard.md)). Of the models reviewed, Mistral Small 3.2 24B is the only dense model of 24B or more that fits 16 GB at a Q4-class quant with context to spare. Qwen3.8-27B fits at 3-bit, and Gemma 4 31B fits only at 3-bit with a short context. Gemma 4 26B-A4B can run Q4_K_M or Q5_K_M with its experts in system RAM.

### Cited Findings

| Model | Base, shape | GGUF sizes | Fit on 16 GB | Refusal behaviour |
|---|---|---|---|---|
| Cydonia-24B-v4.3 | Mistral Small 3.2, dense 24B | Q3_K_L 12.40, IQ4_XS 12.76, Q4_K_S 13.55, Q4_K_M 14.33, Q5_K_M 16.76 GB | Whole at IQ4_XS or Q4_K_S, about 2.5–3 GB left for KV | Fine-tune with low refusal |
| Qwen3.8-27B | Hybrid-attention dense 27B, MTP | Q3_K_M 13.8, UD-Q3_K_XL 13.4, IQ4_XS 15.7, Q4_K_M 17.1 GB (unsloth, self-reported) | Whole at 3-bit; IQ4_XS leaves almost nothing | Stock, aligned |
| Orion-26B-A4B-v1.1 | Gemma 4 26B-A4B, MoE about 4B active | IQ4_XS 14.28, Q4_K_S 16.05, Q4_K_M 17.97, Q5_K_M 20.01, Q6_K 23.79, Q8_0 26.86 GB | Tight at IQ4_XS, or Q4_K_M with expert offload | Fine-tune whose card states it has no alignment |
| Gemma 4 26B-A4B heretic (llmfan46, MuXodious) | Gemma 4 26B-A4B, abliterated | As Orion | As Orion | Abliterated, very low refusal |
| Artemis-31B-v1.2 | Gemma 4 31B, dense | IQ3_XS 14.04, Q3_K_M 14.70, IQ3_M 16.40, IQ4_XS 17.23, Q4_K_M 19.52 GB | Whole only at IQ3_XS or Q3_K_M, short context | Fine-tune with low refusal |

- The refusal column summarises model cards and a public refusal leaderboard, so treat it as reported, not measured here.
- Sources: [Cydonia GGUF](https://huggingface.co/bartowski/TheDrummer_Cydonia-24B-v4.3-GGUF); [Orion GGUF](https://huggingface.co/bartowski/TheDrummer_Orion-26B-A4B-v1.1-GGUF); [Artemis GGUF](https://huggingface.co/bartowski/TheDrummer_Artemis-31B-v1.2-GGUF); [Qwen3.8 sizes, DEV Community](https://dev.to/purpledoubled/run-qwen-38-27b-locally-real-gguf-sizes-the-kv-cache-trick-and-the-template-trap-114j).
- Qwen3.8-27B: lmstudio-community's Q4_K_M is 16.8 GB, and ggml-org's is 19.0 GB because it includes the MTP head. `--jinja` is required, and the stock template can truncate multi-turn history — [DEV Community](https://dev.to/purpledoubled/run-qwen-38-27b-locally-real-gguf-sizes-the-kv-cache-trick-and-the-template-trap-114j).
- Orion's card recommends temperature about 0.9 with the Gemma 4 template, with thinking on or off — [Orion card](https://huggingface.co/TheDrummer/Orion-26B-A4B-v1.1).

### Inferences
- With expert offload, token generation on Gemma 4 26B-A4B is bound mostly by DDR5 bandwidth over about 4B active parameters. Prompt processing also stays on the GPU, because attention and the KV cache stay there. A dense 31B with layers in RAM moves both token generation and prompt processing onto the CPU, so it is the slowest option here.

## KV cache

### Cited Findings
- Qwen3.8-27B's KV cache is about 64 KB per token at f16, because only 16 of its layers use full attention. 32K of context costs about 2.0 GB, against about 256 KB per token for a conventional 64-layer model — [DEV Community](https://dev.to/purpledoubled/run-qwen-38-27b-locally-real-gguf-sizes-the-kv-cache-trick-and-the-template-trap-114j).
- A q8_0 KV cache degrades Gemma 4 26B-A4B (KL 0.377) and is safe for Qwen 3.6, with no measurement found for Qwen3.8 ([models_standard.md](./models_standard.md)). Orion and the Gemma 4 26B-A4B heretics share that base.
- Gemma 4 uses sliding-window attention, and a May 2025 tutorial says such models may need `--swa-full` for some cache-reuse paths beyond the window — [llama.cpp discussion #13606](https://github.com/ggml-org/llama.cpp/discussions/13606).
- An issue reports that some hybrid-attention models reprocess the whole prompt on every request — [llama.cpp issue #16416](https://github.com/ggml-org/llama.cpp/issues/16416) (seen only in a search summary).

### Gaps
- No measurement of q8_0 KV quality on Mistral Small 3.2 was found. Before relying on it, compare q8_0 against f16 on the same long prompt for KL divergence or output quality.
- Whether Qwen3.8-27B is hit by the full-reprocess issue is unverified. Check the llama-server log for prompt tokens reprocessed on the second request.

## llama-server and llama-swap sampler settings

### Cited Findings
- llama-server request defaults: temperature 0.8, top_k 40, top_p 0.95, min_p 0.05, XTC off (threshold 0.1), DRY off (base 1.75, allowed length 2, last_n 64), and DRY sequence breakers `['\n', ':', '"', '*']`. Each also has a server CLI flag, such as `--temp`, `--min-p` and `--dry-multiplier`. A request field overrides the CLI default only when the request sends it — [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
- `logit_bias` accepts token IDs or strings. A string bias applies to every token of the string, so llama-server has no phrase ban with backtracking. KoboldCpp's "Phrase Banning" does backtrack — [server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md); [KoboldCpp wiki](https://github.com/LostRuins/koboldcpp/wiki).
- Thinking: `--reasoning on|off|auto`, `--reasoning-budget N` (0 ends thinking at once), and the per-request `chat_template_kwargs` and `reasoning_effort` fields. When a GGUF's template is unsupported, the chat endpoint falls back to ChatML — [server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
- llama-swap `filters.setParams` always runs for the model, and a key ending in `?` is set only when the request omits it. `setParamsByID` exposes aliases such as `<model>:think` that set `chat_template_kwargs` per request with no reload — [llama-swap config.example.yaml](https://github.com/mostlygeek/llama-swap/blob/main/docs/config.example.yaml).

### Gaps
- Whether `/v1/messages` accepts the extended sampler fields (min_p, DRY, XTC), and so whether `setParams` can inject them into Anthropic-format requests, is undocumented. Put sampler baselines on the llama-server command line, and read one real request in the verbose log to see what the server applied.
