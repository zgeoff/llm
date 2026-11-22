# Abliterated / uncensored open-weight models for a 16 GB VRAM + 64 GB RAM machine (as of late Oct / early Nov 2026)

Research date: 2026-11-02. Hardware context: AMD RX 9070 XT (16 GB), 64 GB DDR5. Every claim below carries a source; "self-reported" means the figure comes from the uploader's own model card and is not independently checked.

## 1. Which decensoring methods are current, and what they cost

### Takeaway
Weight-editing "abliteration" is still the main way to decensor a model. It finds a "refusal direction" in the model's activations and projects it out of the weights. In 2026 it comes in three forms: crude single-pass versions (huihui-ai), norm-preserving biprojected versions (grimjim's method; Heretic also offers its own norm-preserving projected mode, which it calls MPOA, but the sources do not say whether the two are the same), and automated searches that optimise refusals against KL divergence (Heretic 2.x with its new Arbitrary-Rank Ablation, ARA). On current Qwen 3.6 models, independent measurements show general benchmarks moving by only 0.5–1.3 points on average. TruthfulQA and math-under-reasoning are hit harder, and results vary a lot from model to model.

### Cited Findings
**Methods**
- Heretic (p-e-w) is now at 2.x, and configs from 1.x are incompatible. Its default modifier is "Arbitrary-Rank Ablation (ARA)", developed for Heretic, with a preprint still forthcoming. It also supports projected abliteration with norm preservation (MPOA). An Optuna TPE optimiser minimises refusal rate and KL divergence together. It handles "most dense models… several different MoE architectures, and many modern hybrid models". New features include a `reproduce.json` manifest so others can re-run an abliteration, the "Grimoire" library of those manifests, plugins, and presets for slop, sycophancy and similar. Processing a 4B model takes about 30–40 minutes on an RTX 3090 — [GitHub p-e-w/heretic](https://github.com/p-e-w/heretic) (fetched 2026-11-02).
- How Heretic scores a trial: refusals are counted by keyword markers ("sorry", "I cannot") on harmful prompts, and KL divergence is measured on the first-token distribution over harmless prompts — [Heretic docs (mintlify)](https://www.mintlify.com/p-e-w/heretic/concepts/how-it-works).
- Norm-preserving biprojected abliteration (Jim Lai / grimjim) removes the refusal direction while keeping the size of the activations unchanged. The jim-plus/llm-abliteration repo lets you switch on or off separately: projection removal at measurement, projection removal at ablation, and norm preservation — [NousResearch/llm-abliteration fork listing](https://github.com/NousResearch/llm-abliteration); [search summary of community write-ups](https://www.orcarouter.ai/zh-CN/blog/how-abliteration-works). ArliAI's "Derestricted" gpt-oss-20b (released 2025-11-27) uses it — [ollama gurubot/gpt-oss-derestricted](https://ollama.com/gurubot/gpt-oss-derestricted); [llmrun.dev](https://llmrun.dev/model/arliai-gpt-oss-20b-derestricted).
- OBLITERATUS's default "advanced" method combines 4 SVD directions, norm-preserving biprojection, bias projection and 2 refinement passes — [OBLITERATUS docs](https://mintlify.wiki/elder-plinius/OBLITERATUS/methods/overview).
- huihui-ai describes its own method as "a crude, proof-of-concept implementation to remove refusals… without using TransformerLens" — [huihui-ai Qwen3.6-35B-A3B abliterated MTP GGUF](https://huggingface.co/huihui-ai/Huihui-Qwen3.6-35B-A3B-abliterated-MTP-GGUF).
- Other 2026 uploader "brands" that abliterated-model benchmarks compare: HauhauCS ("Aggressive", claims to be "lossless"), AEON, Abliterix (wangzhang), and Apostate — [abliterlitics.dev index](https://abliterlitics.dev/).

**Measured cost: an independent comparison on Qwen3.6-27B** ([abliterlitics.dev, last updated 2026-10-29](https://abliterlitics.dev/models/qwen3.6-27b/), author Nathan Sapwell, all variants run in BitsAndBytes 4-bit so only the deltas are meaningful)

| Variant (HF repo) | KL | HarmBench ASR (full CoT) | MMLU | TruthfulQA MC2 | GSM8K adjusted |
|---|---|---|---|---|---|
| Base Qwen/Qwen3.6-27B | – | 26.0% | 83.3 | 56.7 | 96.2 |
| Heretic: llmfan46/Qwen3.6-27B-uncensored-heretic-v2 | 0.0037 | 100% | 82.8 | 51.1 | 93.8 |
| Huihui: huihui-ai/Huihui-Qwen3.6-27B-abliterated | 0.0074 | 99.8% | 83.4 | 54.8 | 96.0 |
| Abliterix: wangzhang/Qwen3.6-27B-abliterated | 0.0222 | 100% | 81.3 | 48.7 | 95.6 |
| AEON-7/Qwen3.6-27B-AEON-Ultimate-Uncensored | 0.0238 | 100% | 82.9 | 46.1 | 95.8 |
| HauhauCS/Qwen3.6-27B-Uncensored-HauhauCS-Aggressive | 0.0242 | 100% | 83.9 | 47.2 | 96.6 |

- Average delta excluding GSM8K and Lambada: Huihui 0.5 pp, Heretic 1.3 pp, HauhauCS 2.0 pp. Abliterix's Lambada perplexity rose from 3.18 to 9.12. The author judges Heretic the best overall tradeoff and Huihui the smallest capability loss. The author says HauhauCS's "lossless" claim and AEON's "enhanced capability" claim are "not evident" or "contradicted by the data". The page has no coding benchmark — [abliterlitics.dev Qwen3.6-27B](https://abliterlitics.dev/models/qwen3.6-27b/).
- On Qwen3.5-9B, the same site found Heretic kept about 98% of GSM8K and 99.6% of MMLU, against Huihui's 93.5% and 98.0%. — [abliterlitics.dev Qwen3.5-9B](https://abliterlitics.dev/models/qwen3.5-9b/).

**Measured cost: an academic comparison** (Richard J. Young, UNLV, [arXiv 2512.13655v2, 2026-01-08](https://arxiv.org/html/2512.13655); 16 models of 7–14B, older Llama, Qwen2.5 and Qwen3-8B/14B generation)
- Heretic's KL ranged from 0.043 to 1.646 depending on the model. Heretic ran on 16 of 16 models, DECCP on 11, ErisForge on 9 and FailSpy on 5.
- Average GSM8K change: ErisForge −0.28 pp, DECCP −0.13 pp, Heretic −7.81 pp. Heretic's average is driven by Yi-1.5-9B's −18.81 pp. Average MMLU change: ErisForge −0.12, DECCP −0.61, Heretic −0.78.
- Caveats in the paper: single runs with default configs, only 3 models with full baselines, and 8-bit evaluation. Keyword-based refusal detection underestimated the real attack success rate (72.2% vs 95.7% by classifier).
- Math reasoning is the most sensitive capability. Some of abliterlitics' 27B figures look internally inconsistent; the author attributes one anomaly (Abliterix Lambada) to an interaction with BNB4 quantization (inference/observation).
- A separate paper warns that "regression on final task performance can be substantial even when there is a low KL divergence" — [arXiv 2603.10012](https://arxiv.org/pdf/2603.10012).

**Measured cost: self-reported by uploaders**
- Heretic's README benchmark on Gemma-3-12B: Heretic reached 3/100 refusals at KL 0.16, against KL 0.45 and 1.04 for two manual abliterations at the same refusal count (as summarised by a secondary source) — [Heretic docs](https://mintlify.com/p-e-w/heretic/introduction).
- p-e-w/gpt-oss-20b-heretic-ara-v3: 3/100 refusals against the original's 98/100, at KL 0.0554. It used an unreleased Heretic version with ARA ("experimental") and reports no capability benchmarks — [HF card](https://huggingface.co/p-e-w/gpt-oss-20b-heretic-ara-v3).
- wangzhang/Qwen3.6-27B-abliterated: about 0.024 cumulative KL and 10/100 refusals, against the base's 100/100 — [HF card](https://huggingface.co/wangzhang/Qwen3.6-27B-abliterated).
- llmfan46 Qwen3.6-35B-A3B heretic (Native MTP Preserved): KLD 0.0015 and 10/100 refusals, per a Reddit post snapshot from 2026-05-15 — [reddit snapshot](https://reddit.sentinel-team.org/posts/1t7qfaq/snapshots/2026-05-15T23%3A40%3A01.25497Z).

### Inferences
- At 2026 KL levels (0.002–0.06), the "general intelligence" cost is small, but it is not zero. The costs that do show up are in truthfulness or calibration (TruthfulQA falls 2–10 points) and in reasoning behaviour: longer or broken thinking traces, and more empty or invalid responses. These are the failure modes most likely to matter in agentic coding.
- KL scores taken on first-token distributions say little about long-horizon agentic behaviour. No source measured SWE-bench or terminal-agent performance before and after abliteration on the same base, except Cyber-Tiel's self-reported runs (see section 3).

### Gaps
- I did not fetch grimjim's original HF blog post, so the maths of "biprojected" comes from secondary summaries. mlabonne's 2024 abliteration write-up (https://huggingface.co/blog/mlabonne/abliteration) describes the classic method, but I did not re-fetch it.
- I found no independent coding benchmark (HumanEval, SWE-bench, LiveCodeBench) comparing abliterated and stock versions of any 2026 model.
- I found no 2026 data on DPO or fine-tune decensors (e.g. Dolphin-style) for current base models.

## 2. Reputable uploaders and specific variants that fit 16 GB VRAM + 64 GB RAM

### Takeaway
The best-documented names in 2026 are huihui-ai (prolific, crude method, smallest capability delta in independent tests), llmfan46 (top Heretic releases), p-e-w (the Heretic author, a few reference models) and ArliAI (norm-preserving "Derestricted"). mradermacher's GGUF repackaging is widely used. On this hardware the MoE A3B models are the sweet spot: the expert layers sit in system RAM and the shared layers on the GPU. A 27B dense model only fits at about 3–4 bit.

### Cited Findings
- **Qwen3.6-35B-A3B, Huihui abliterated** (base Apache-2.0, arch qwen35moe, 36B total parameters). The GGUF repo has an MTP head for speculative decoding and lists Q2_K at 13.2 GB, Q6_K at 29.2 GB, Q8_0 at 37.8 GB and F16 at 71.1 GB. Its example command uses a Q4_K file and `--spec-type draft-mtp --spec-draft-n-max 6`. It had about 2.30 M downloads in the last month. The card makes no benchmark or refusal claims and carries six usage warnings. The collection was updated Aug 11 (2026) — [HF huihui-ai MTP GGUF](https://huggingface.co/huihui-ai/Huihui-Qwen3.6-35B-A3B-abliterated-MTP-GGUF). Third-party GGUFs of it come from mradermacher and Abiray — [mradermacher](https://huggingface.co/mradermacher/Huihui-Qwen3.6-35B-A3B-abliterated-GGUF); [Abiray](https://huggingface.co/Abiray/Huihui-Qwen3.6-35B-A3B-abliterated-GGUF).
- **Qwen3.6-35B-A3B, llmfan46 Heretic, "Native MTP Preserved" GGUF**: Q4_K_M is listed. Self-reported KLD is 0.0015 with 10/100 refusals — [HF llmfan46](https://huggingface.co/llmfan46/Qwen3.6-35B-A3B-uncensored-heretic-Native-MTP-Preserved-GGUF); [reddit snapshot](https://reddit.sentinel-team.org/posts/1t7qfaq/snapshots/2026-05-15T23%3A40%3A01.25497Z). mradermacher-style quants of heretic-v1 range from Q2_K (about 13 GB) to Q8_0 (about 37 GB), with Q4_K_M about 21 GB — [HF bucket](https://huggingface.co/buckets/Kyonbyte/Qwen3.6-35B-A3B-uncensored-heretic-GGUF-bucket).
- **Qwen3.6-27B dense**: llmfan46/Qwen3.6-27B-uncensored-heretic-v2 and huihui-ai/Huihui-Qwen3.6-27B-abliterated are the two best-measured variants, with the numbers in section 1 — [abliterlitics.dev](https://abliterlitics.dev/models/qwen3.6-27b/).
- **gpt-oss-20b**: ArliAI/gpt-oss-20b-Derestricted (norm-preserving biprojected, 20.9B, Apache-2.0, 131k context, released 2025-11-27). Q4_K_M needs about 12.9 GB of VRAM for weights, and 17 GB or more is recommended with KV headroom — [llmrun.dev](https://llmrun.dev/model/arliai-gpt-oss-20b-derestricted). A GGUF is at MaziyarPanahi/gpt-oss-20b-Derestricted-GGUF — [PromptLayer listing](https://www.promptlayer.com/models/gpt-oss-20b-derestricted-gguf). The alternative is p-e-w/gpt-oss-20b-heretic-ara-v3 (3/100 refusals, KL 0.0554), with quants linked from the card — [HF](https://huggingface.co/p-e-w/gpt-oss-20b-heretic-ara-v3). huihui-ai also has Huihui-gpt-oss-20b-BF16-abliterated — [huihui-ai collections](https://huggingface.co/huihui-ai/collections).
- **Gemma 4**: Blackroot/Gemma-4-26B-A4B-Preserving-Abliteration exists — [featherless listing](https://featherless.ai/models/Blackroot/Gemma-4-26B-A4B-Preserving-Abliteration). abliterlitics compares Gemma 4 12B QAT (7 variants), Gemma 4 12B Unified (12 variants) and E4B/E2B, but the index shows no figures — [abliterlitics.dev](https://abliterlitics.dev/).
- **GLM-4.7-Flash** (about 59B-total MoE): abliterlitics compares Heretic, Huihui, HauhauCS and Abliterix variants — [abliterlitics.dev](https://abliterlitics.dev/).
- **Ornith-1.5-35B-A3B** (the base under Tiel-Coder, see section 3) also has community abliterations, e.g. a Japanese Heretic variant OS-Software/Ornith-1.5-35B-A3B-heretic-ja — [friendli listing](https://friendli.ai/models/OS-Software/Ornith-1.5-35B-A3B-heretic-ja).
- Model names are not evidence: a refusal-benchmark repo flags at least one "obliterated" Qwen model as uncensored in name only — [audn-ai/refusal-benchmark](https://github.com/audn-ai/refusal-benchmark).
- The abliterlitics author says the site's Reddit account is shadowbanned, so its r/LocalLLaMA posts may not be visible. Reports are mirrored at huggingface.co/DreamFast — [abliterlitics.dev](https://abliterlitics.dev/).

### Draft shortlist for the report writer (sizes from the cited cards; fit is inferred)
1. **huihui-ai/Huihui-Qwen3.6-35B-A3B-abliterated (MTP GGUF)**: compare against stock Qwen3.6-35B-A3B. huihui's card lists no Q4 size; sibling Q4_K_M quants of the same base are about 21 GB (from the llmfan46 bucket), so expect it to run with the experts offloaded to RAM.
2. **llmfan46/Qwen3.6-35B-A3B-uncensored-heretic (Native MTP Preserved GGUF)**: the lowest reported KL for the same base.
3. **llmfan46/Qwen3.6-27B-uncensored-heretic-v2 or huihui-ai/Huihui-Qwen3.6-27B-abliterated**: the only variants with independent benchmarks. Dense 27B at IQ3/IQ4 is tight on 16 GB.
4. **ArliAI/gpt-oss-20b-Derestricted (GGUF via MaziyarPanahi)** or **p-e-w/gpt-oss-20b-heretic-ara-v3**: these fit entirely in VRAM and give a fast comparison point.
5. **peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF(-MTP)**: an abliterated Ornith-1.5 coder with a security-weighted imatrix. Promising, but every figure is self-reported (section 3).
6. Optional: **Blackroot/Gemma-4-26B-A4B-Preserving-Abliteration**, if a Gemma comparison is wanted (no quality data found).

### Inferences
- For a 16 GB card, a 35B-A3B Q4 file of 20–23 GB needs llama.cpp MoE offload (`--n-cpu-moe`, as the Cyber-Tiel card recommends). With 64 GB of DDR5 this is comfortable, and only about 3B parameters are active per token. The huihui card's example build uses CUDA. On an RX 9070 XT the same flags apply with a Vulkan or ROCm/HIP build of llama.cpp. This is my inference: none of the cards documents AMD.
- MTP speculative decoding needs a recent llama.cpp (`--spec-type draft-mtp`). Plain llama.cpp ignores the head if the flag is not set — [Tiel-Coder MTP card](https://huggingface.co/peculiar-ragdoll/Tiel-Coder-35B-A3B-GGUF-MTP).

### Gaps
- I verified no current (Oct 2026) abliterated Mistral variants or GLM GGUF sizes.
- I found no abliterated gpt-oss-120b data. At about 60+ GB in MXFP4 it would sit almost entirely in system RAM on this machine, so it is probably impractical; that last point is inference.
- I could not confirm a bartowski Heretic GGUF of Qwen3.6-35B-A3B.

## 3. What "Tiel-Coder-35B-A3B-GGUF-MTP" and "Cyber-Tiel-Coder-35B-A3B-GGUF-MTP" (peculiar-ragdoll) are

### Takeaway
Both are re-quantizations of **Ornith-1.5-35B-A3B**, an MIT-licensed agentic-coding MoE released by ornith-ai around 2026-08-18/19. Ornith is tagged `qwen3_5_moe` and its own card benchmarks it against Qwen3.6-35B-A3B. **Tiel-Coder** is the censored Ornith with no fine-tune or merge. Its differences from upstream are the quantization recipe (Unsloth-style dynamic quants), a custom imatrix, the embedded "Sharp" chat template, and Ornith's trained MTP head. **Cyber-Tiel-Coder** is the same treatment applied to **huihui-ai's abliteration of Ornith-1.5**, with a security- and code-weighted imatrix. Both are very popular (Tiel MTP had about 2.97 M downloads in the last month). The visible HF discussions show no trust or quality complaints. But every performance claim is self-reported, I found no independent Reddit or benchmark discussion, and the uploader is a pseudonymous account.

### Cited Findings
- Collection tagline: "a dedicated coder improving on Ornith1.5 without fine tuning" — [HF collection](https://huggingface.co/collections/peculiar-ragdoll/tiel-coder-35b-a3b).
- Tiel-Coder-35B-A3B-GGUF-MTP: base ornith-ai/Ornith-1.5-35B-A3B. The changes are a custom imatrix, dynamic per-tensor quantization and the embedded "Sharp" template, which builds on froggeric's template lineage, with no merge or weight training. The MTP head comes from Ornith's re-upload, which replaced the untrained first MTP block with a trained one on 2026-08-23. The head is quantized to Q3_K and adds about 0.4 GB per tier. Speed with MTP is 94.4 tok/s against 77.4 tok/s without, on the author's hardware. Quants: Q2_K_XL 12.7 GB, IQ3_XXS 13.6 GB, IQ3_S 14.1 GB, Q3_K_XL 17.2 GB, IQ4_XS 18.1 GB, Q4_K_S 21.3 GB, Q4_K_XL 22.7 GB (recommended), up to Q8_K_XL 38.8 GB. MIT licence. About 2,968,330 downloads in the last month and 335 likes — [HF card](https://huggingface.co/peculiar-ragdoll/Tiel-Coder-35B-A3B-GGUF-MTP) (fetched 2026-11-02).
- Tiel self-reported benchmarks: SWE-bench-Live 12/25 (Ornith-1.5 8/25); Claw-Eval multi-turn 67.2 (Ornith 65.3); MMLU-Pro 73.7 (Ornith 78.0; stock Qwen3.6 85.3) — [HF card](https://huggingface.co/peculiar-ragdoll/Tiel-Coder-35B-A3B-GGUF-MTP). The MMLU-Pro drop from 78.0 to 73.7 on a "no weight change" build is worth noting. It may reflect the code-weighted imatrix or quant level; that is inference.
- Cyber-Tiel-Coder-35B-A3B-GGUF: base Huihui-Ornith-1.5-35B-A3B-abliterated. The imatrix calibration corpus is about 50 MB: roughly 40% security, 27% code, 18% agentic tool traces and 15% general/multilingual. Sources include eaddario's corpora, Exploit-DB, PayloadsAllTheThings, HackTricks and nuclei-templates. Quants: UD-Q2_K_XL 12.3 GB, UD-IQ3_XXS 13.2 GB, UD-IQ3_S 13.7 GB, UD-Q3_K_XL 16.8 GB, UD-IQ4_XS 17.7 GB, UD-Q4_K_M 22.1 GB (benchmarked), UD-Q4_K_XL 22.4 GB, up to UD-Q8_K_XL 38.5 GB, plus an mmproj vision projector — [HF card](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF).
- Cyber-Tiel self-reported results: SWE-bench-Live 15/13/13 of 25 across 3 runs (mean 13.7); Cybench unguided 15/43 (10/31 on the official set); 0 refusals across 84 HarmBench requests; MMLU-Pro "matches TielCoder". Mean KL is "on par with Unsloth's quants of Qwen3.6"; no error bars. Recommended settings: `--jinja`, temp 0.6, top-p 0.95, top-k 20, `--n-cpu-moe` for partial offload. About 78,088 downloads in the last month and 145 likes — [HF card](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF). An MTP build also exists — [HF Cyber-Tiel MTP](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF-MTP).
- The Cyber-Tiel card itself warns that the model will comply with harmful requests. It strongly urges OS-level sandboxing and controlled network access, warns that prompt injection could turn the agent against the user, and recommends the censored TielCoder for anyone who cannot manage those risks. Uploader: the pseudonymous account peculiar-ragdoll (the citation names "Saga Ishtardottir"). It calls itself non-profit and declines donations — [HF card](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF).
- Community discussions on Cyber-Tiel (fetched 2026-11-02, titles only): "Recommended Params", "IQ3_S or IQ3_M for 16GB?", "hf tensors?", "GSQ-RCO quants", "Benchmarked …UD-IQ4_XS.gguf" (about 9 days old), and a Gemma 26B A4B request. None of the titles raises quality, template or trust problems; I did not read the thread bodies — [HF discussions](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF/discussions).
- Third parties build on Tiel: arcitech-psp published a GPTQ W4A16 Intel XPU MTP build — [HF](https://huggingface.co/arcitech-psp/Tiel-Coder-35B-A3B-W4A16-GPTQ-XPU-MTP). A promotional X post also exists — [X @HuggingModels](https://x.com/HuggingModels/status/2098896943699411138).
- Ornith-1.5 upstream: the ornith-ai card tags the model `qwen3_5_moe`, says Ornith-1.0 was "developed on top of Qwen3.5 and Gemma4", and describes RL with self-generated tasks. Self-reported: SWE-bench Verified 79 (Qwen3.6-35B-A3B 73.4), Terminal-Bench 2.1 67.8 (52.5), SWE-bench Pro 59.6 (49.5). MIT licence — [HF ornith-ai/Ornith-1.5-35B](https://huggingface.co/ornith-ai/Ornith-1.5-35B). This is the slug that was fetched; the page mentions about 3B active parameters, so it appears to be the A3B model, which is elsewhere cited as ornith-ai/Ornith-1.5-35B-A3B. Release: about 2026-08-18, 256 experts, about 3B active, 262K context — [atomic.chat](https://atomic.chat/models/ornith-1-5-35b-a3b); [Gigazine 2026-08-20](https://gigazine.net/gsc_news/en/20260820-ornith-1-5/).

### Inferences
- "Well made" in the engineering sense looks plausible: detailed quant tables, the published imatrix, MTP head provenance and documented sampling settings are all good signs. "Trustworthy" is a separate question. The uploader is pseudonymous, and the GGUF embeds a custom chat template rather than the upstream one. That template is exactly the attack surface described in section 4, so it should be diffed against Ornith's or froggeric's original before use.
- For a fair comparison on 16 GB, compare Tiel against Cyber-Tiel at the same quant tier. Their only difference is the abliterated weights plus a different imatrix, which isolates the cost of abliteration on the Ornith base. Note that the two use different imatrix corpora, so the comparison is not perfectly clean.

### Gaps
- I found no r/LocalLLaMA threads about Tiel or Cyber-Tiel. Searches returned none, which may reflect search coverage rather than absence.
- I did not read the bodies of the HF discussion threads, including the user benchmark of IQ4_XS.
- There is no independent verification of the SWE-bench-Live or Cybench figures.
- I did not find the Huihui-Ornith-1.5-35B-A3B-abliterated card itself, so its date and method notes are unchecked.

## 4. Trust and safety: can a GGUF carry code, and what are the risks of agent tool access?

### Takeaway
A GGUF does not contain pickled Python the way old `.bin`/`.pt` files do, but it is not inert. Two risks remain. First, the parser in llama.cpp has had repeated memory-corruption CVEs from crafted files, the latest fixed in build b7824 in 2026. Second, the embedded Jinja chat template is executable logic. It can hide trigger-based backdoors that pass HF scanning, and in SGLang (CVE-2026-5760) it allowed server-side RCE through an unsandboxed Jinja renderer. With an abliterated model in an agent loop, the model itself becomes the weaker safeguard, so the sandbox has to do the work.

### Cited Findings
- **Poisoned chat templates.** Pillar Security showed that GGUF chat templates can be edited to add conditional backdoors that stay dormant until a trigger phrase appears. The poisoned files passed Hugging Face's automated scans. The study covered about 2,600 models with distinct templates, 18 models and 4 engines (arXiv 2602.04653) — [Pillar Security](https://www.pillar.security/blog/from-discovery-to-large-scale-validation-chat-template-backdoors-across-18-models-and-4-engines); [earlier Pillar post](https://www.pillar.security/blog/llm-backdoors-at-the-inference-level-the-threat-of-poisoned-templates). The malicious logic is valid Jinja2, so malware and deserialization scanners miss it — [NeuralTrust](https://neuraltrust.ai/blog/inference-gguf-templates). Affected engines listed: llama.cpp, Ollama, vLLM, SGLang. Mitigations: diff the template against a trusted original, look for suspicious conditionals and substring checks, and use signed provenance — [promptfoo LM security DB](https://promptfoo.dev/lm-security-db/vuln/chat-template-hidden-instructions-8fee546c/).
- **Template code execution.** CVE-2026-5760 (SGLang) rendered `tokenizer.chat_template` from a GGUF with a plain `jinja2.Environment()`, so a crafted template could run OS commands — [CSA research note, 2026-04-22](https://labs.cloudsecurityalliance.org/research/csa-research-note-sglang-cve-2026-5760-gguf-rce-20260422-csa/). Pillar also notes a 2024 Jinja template code-execution issue at model load; the source does not name the project — [Pillar](https://www.pillar.security/blog/llm-backdoors-at-the-inference-level-the-threat-of-poisoned-templates).
- **GGUF parser memory-safety CVEs in llama.cpp:**
  - CVE-2024-21825, CVE-2024-21836 and CVE-2024-23605 are heap overflows in GGUF header and array parsing (Cisco Talos) — [vuln.today 21825](https://vuln.today/cve/CVE-2024-21825); [21836](https://vuln.today/cve/CVE-2024-21836); [23605](https://vuln.today/cve/CVE-2024-23605).
  - CVE-2025-53630 is an integer overflow in `gguf_init_from_file_impl`, CVSS 8.9 — [vuln.today](https://vuln.today/cve/CVE-2025-53630).
  - CVE-2026-33298 is an integer overflow in `ggml_nbytes` leading to a heap overflow, fixed in llama.cpp b7824, CVSS 7.8 — [Lutra Security](https://fieldguide.lutrasecurity.com/CVE-2026-33298).
- **Agent loop risk.** The Cyber-Tiel uploader itself says to sandbox at the OS level, control network access, and treat prompt injection as able to turn the agent against the user — [HF card](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF). huihui-ai advises research and controlled environments only, with outputs monitored in real time — [HF card](https://huggingface.co/huihui-ai/Huihui-Qwen3.6-35B-A3B-abliterated-MTP-GGUF).

### Inferences
- How to vet an uploader, based on the sources above:
  - Prefer an uploader with a track record: huihui-ai, llmfan46, p-e-w, ArliAI, or quantizers such as mradermacher, bartowski and unsloth.
  - Prefer a model that publishes a Heretic `reproduce.json` manifest, so anyone can re-run the abliteration.
  - Diff the GGUF's `tokenizer.chat_template` against the upstream base model's template before use. Run llama.cpp with its own `--chat-template-file` from the upstream model if in doubt.
  - Keep llama.cpp, Ollama and LM Studio current, at least past b7824.
  - Never serve GGUFs through an engine that renders Jinja without a sandbox.
- An abliterated model removes one layer of defence against prompt injection. A stock model may refuse an injected "delete everything" or "exfiltrate keys" instruction; an abliterated one is more likely to comply. Isolation is the practical control: a container or VM, no credentials mounted, network egress limited, and approval required for destructive commands.

### Gaps
- I found no documented in-the-wild incident (as opposed to research proof-of-concept) of a poisoned GGUF template on Hugging Face in 2025–2026.
- I did not verify whether llama.cpp's own Jinja engine (minja) has had a 2026 sandbox-escape CVE.
- Pickle vs safetensors: the general point that pickle checkpoints can run code on load and safetensors cannot is widely known, but I did not re-source it this session.

## 5. Abliterated model, or stock model plus a system prompt, for white-hat security work?

### Takeaway
Measured evidence favours abliteration for removing refusals: stock Qwen3.6-27B complies with about 26% of HarmBench prompts (attack success rate), while abliterated variants reach 99.8–100% with full chain of thought. But I found no head-to-head study of "stock + security-research system prompt" against abliterated models on real defensive or CTF tasks. Practitioners note that system prompts only partly work and that abliterated models keep some trained-in reluctance. A sensible approach is to keep the stock model as the default for coding and agent work, and use an abliterated variant only where the stock model actually refuses legitimate work.

### Cited Findings
- Stock Qwen3.6-27B HarmBench ASR is 25.8–26.0%; abliterated variants reach 88.8–98.5% as reported and 99.8–100% with full CoT — [abliterlitics.dev](https://abliterlitics.dev/models/qwen3.6-27b/).
- One Qwen2.5-Coder abliterated card says "some strongly-trained refusals may partially survive; a stronger system prompt closes the gap", and lists security research, exploit analysis and red-teaming as intended uses — [TobiasLogic/Qwen2.5-Coder-32B-abliterated](https://huggingface.co/TobiasLogic/Qwen2.5-Coder-32B-abliterated). A guide notes that abliteration removes the categorical refusal but the model "still has training-time priors against obviously-bad outputs" — [dev.to guide](https://dev.to/purpledoubled/abliterated-models-guide-qwen-36-gemma-4-heretic-llama-31-uncensored-download-links-1f4e). A secondary 2026 guide puts the typical cost at 1–3% — [locallyuncensored.com](https://locallyuncensored.com/blog/abliterated-models-guide.html).
- The cost is real on some axes: TruthfulQA falls up to 10 points, and reasoning traces change (more empty or invalid responses for Heretic; shorter reasoning for Huihui) — [abliterlitics.dev](https://abliterlitics.dev/models/qwen3.6-27b/).
- The Cyber-Tiel uploader explicitly recommends the censored TielCoder for users who cannot manage the risks of the abliterated one — [HF card](https://huggingface.co/peculiar-ragdoll/Cyber-Tiel-Coder-35B-A3B-GGUF).

### Inferences
- For coding, the stock model (or Tiel, against Cyber-Tiel) is likely as good as or slightly better than the abliterated one. For defensive security work (code review, log analysis, writing detections, explaining CVEs), current stock Qwen and Ornith models often comply when given context, so the abliterated model's main benefit is on borderline offensive-security tasks such as CTF exploitation. The user's own A/B test should measure both refusal rate and task success on the same prompts at the same quant.
- A refusal benchmark that uses keyword matching undercounts compliance with disclaimers (see the Young paper in section 1). Judge the outputs by hand or with a classifier.

### Gaps
- I found no r/LocalLLaMA threads (Jul–Oct 2026) directly comparing system-prompt jailbreaks with abliteration for pentest or CTF use. Searches returned only model cards and guides.
- I found no independent Cybench or CTF comparison of stock and abliterated variants of the same base.
