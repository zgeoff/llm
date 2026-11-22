# Standard (non-abliterated) open-weight LLMs for a 16 GB RX 9070 XT + 64 GB DDR5 (as of early Nov 2026)

Research date: 2026-11-02. About 18 searches and fetches. Most benchmark numbers are the vendors' own. Tok/s figures are community reports and are labelled measured or estimated.

## Q1. Ranked shortlist and best in class per tier (agentic coding vs general chat; fits-in-16GB vs MoE offload)

### Takeaway
For agentic coding that fits entirely in 16 GB, **Qwen3.8-27B** (dense, Aug 2026) is now the strongest pick. It needs a 3-bit to IQ4_XS quant, so context room is tight. **Qwen3.6-35B-A3B** (MoE, Apr 2026), run at Q4 with experts offloaded to system RAM, is the comfortable fast option with long context. For a larger model held mostly in system RAM, **Qwen3-Coder-Next 80B-A3B** (Feb 2026) has a measured ~40 tok/s on a 12 GB card with 64 GB DDR5. gpt-oss-120b/20b (Aug 2025) are now old, but still a fast general-reasoning baseline.

### Ranked shortlist

| # | Model | Released | Arch (total/active) | Suggested GGUF on this box | Fits 16 GB? | Reported speed | Coding standing (vendor unless noted) |
|---|---|---|---|---|---|---|---|
| 1 | Qwen3.8-27B | Aug 2026 (HF collection updated Aug 13) | Dense 27B, hybrid Gated DeltaNet + Gated Attention, MTP-trained, vision | unsloth UD-Q3_K_XL 13.44 GB, or IQ4_XS 15.71 GB (almost no KV room) | Yes, at ≤IQ4_XS only | ~42 tok/s at 64K ctx on a 16 GB GPU (unverified HF discussion title); estimated ceilings 46 to 53 tok/s | Terminal-Bench 2.1 73.0, SWE-bench Pro 61.7, LiveCodeBench v6 90.3; no SWE-bench Verified published |
| 2 | Qwen3.6-35B-A3B | Apr 2026 | MoE 35B/3B, 256 experts (8+1 active), MTP | unsloth UD-Q4_K_XL (~22 to 23 GB) with `--n-cpu-moe` | No at Q4. A Q3 quant is borderline. | ~44 to 46 tok/s on an RTX 3060 12 GB with `--n-cpu-moe 26` and 150K ctx (measured, one user) | SWE-bench Verified 73.4, Terminal-Bench 2.0 51.5, LCB v6 80.4, MCPMark 37.0 |
| 3 | Qwen3.6-27B | Apr 2026 (superseded by 3.8-27B) | Dense 27B, MTP | IQ3_M (~13 GB) or IQ4_XS (~12.76 GiB merge) | Yes | **Measured on an RX 9070 XT:** 46 tok/s with MTP, 25.9 tok/s without (IQ3_M, ROCm) | Terminal-Bench 2.1 63.4, SWE-bench Pro 53.5, LCB v6 83.9 (from the Qwen3.8 card) |
| 4 | Qwen3-Coder-Next | Feb 2026 (>4 months old) | MoE 80B/3B (Qwen3-Next), non-thinking | unsloth UD-Q4_K_XL ~47 GB, experts in RAM | No; needs 64 GB RAM | ~40 tok/s generation, ~500 tok/s prompt processing on an RTX 4070 12 GB + 64 GB DDR5-6000 (measured) | SWE-bench Verified >70% (SWE-Agent scaffold) |
| 5 | gpt-oss-120b | Aug 2025 (old) | MoE 117B/5.1B, native MXFP4 | MXFP4 ~59 to 65 GB | No; very tight in 64 GB RAM + 16 GB VRAM | ~25 to 30 tok/s on an RTX 4070 12 GB + 64 GB (measured; the source gives both numbers) | No SWE-bench Verified in the sources I found |
| 6 | gpt-oss-20b | Aug 2025 (old) | MoE 21B/3.6B, MXFP4 | MXFP4 / Q8_0 ~14 GB | Yes | **Measured on an RX 9070 XT:** 152.7 tok/s on Vulkan vs 117.2 on ROCm (llama.cpp b6401, ~Sep 2025); 91.9 tok/s in Ollama+ROCm | Older, weaker for agentic coding |
| 7 | Gemma 4 31B (dense) / 26B-A4B (MoE) | Apr 2026 | 30.7B dense; 26B/4B MoE | 31B ≈17 GB at 4-bit (offload or 3-bit) | 26B-A4B mostly fits | n/a | 31B: SWE-V 52.0, TB2.0 42.9, LCB v6 80.0; 26B-A4B: SWE-V 17.4 (these come from Qwen's comparison table) |
| 8 | Devstral Small 2 (24B) | Dec 2025 (old) | Dense 24B | Q4_K_M ~13 to 14.5 GB | Yes | n/a | SWE-bench Verified 68.0% |

New October 2026 releases worth watching (no local speed data found):
- **Kolibri 1** (Aleph Alpha, 3 Oct 2026). MoE 78B/3.5B, ≈43 GB, Apache 2.0. SWE-bench Verified 66.4 (Harbor harness). It sits in the same offload tier as Qwen3-Coder-Next.
- **LFM2.5-24B-A2B** (Liquid AI, 13 Oct 2026). MoE 24B/2.45B, ≈13 GB at 4-bit, so it fits fully in 16 GB. SWE-bench Verified 51.0 (OpenCode harness). The LFM Open License has a revenue cap.
- **Mellum2.1 Thinking** (JetBrains, 8 Oct 2026). MoE 12B/2.5B, Q4_K_M GGUF 8.1 GB. SWE-bench Verified 47.0 (Pi harness).
- **Bonsai 2 27B** (Prism ML, 17 Sep 2026). Dense ternary, 6 to 7 GB. No SWE-bench score.

### Image input (vision) per shortlisted model
| Model | Image input? | llama.cpp via mmproj? |
|---|---|---|
| Qwen3.8-27B | Yes. The card describes it as native multimodal, with a vision encoder; OSWorld-Verified 84.3 | Not directly confirmed. LocalAIMaster advises skipping the "vision projector" to fit 16 GB, which implies an mmproj GGUF exists |
| Qwen3.6-35B-A3B | Yes. The card lists a vision encoder | **Yes.** `--mmproj mmproj-qwen3.6-35b-a3b-F16.gguf --no-mmproj-offload` keeps the projector on CPU, so it costs about no VRAM |
| Qwen3.6-27B | Yes. Unsloth's repo is tagged image-text-to-text | Probably the same mmproj pattern as 35B-A3B; not directly verified |
| Qwen3-Coder-Next | No source shows image support; treat as text-only | n/a |
| gpt-oss-120b / 20b | Text-only | n/a |
| Gemma 4 31B / 26B-A4B | Yes. Sources describe Gemma 4 as handling text and image input | ggml-org publishes gemma-4 GGUFs; I did not confirm an mmproj file in the listing |
| Devstral Small 2 | No evidence of vision | Only community "vision transplants" of the older Devstral (2505/2507) ship an mmproj |
| DeepSeek-V4.1-Flash-1017 | Yes (image-text-to-text) | Out of reach anyway |

**Best vision-capable pick for 16 GB:** Qwen3.8-27B, judged on its vendor vision and agent scores. The one with confirmed llama.cpp mmproj use and VRAM headroom is **Qwen3.6-35B-A3B**: run the mmproj on CPU and offload the experts.
Sources: [Qwen3.8-27B card](https://huggingface.co/Qwen/Qwen3.8-27B); [Qwen3.6-35B-A3B card](https://huggingface.co/Qwen/Qwen3.6-35B-A3B); [X post with mmproj flags](https://x.com/DogukanUrker/status/2077472690156511643); [unsloth/Qwen3.6-27B-GGUF](https://huggingface.co/unsloth/Qwen3.6-27B-GGUF); [LocalAIMaster](https://localaimaster.com/vram/best-qwen-model-16gb-vram); [ggml-org Gemma 4 collection](https://huggingface.co/collections/ggml-org/gemma-4); [Xinference Gemma 4 page](https://inference.readthedocs.io/en/latest/models/builtin/llm/gemma-4.html); [ngxson Devstral-Small-Vision-2505](https://huggingface.co/ngxson/Devstral-Small-Vision-2505-GGUF); [Devstral-Vision-Small-2507](https://huggingface.co/QuixiAI/Devstral-Vision-Small-2507-gguf/blob/main/README.md); [unsloth DeepSeek-V4.1-Flash-1017 GGUF](https://huggingface.co/unsloth/DeepSeek-V4.1-Flash-1017-GGUF)

### Cited Findings
- Qwen3.8-27B is a dense 27B: 64 layers in 16 blocks of (3× Gated DeltaNet + 1× Gated Attention), trained with MTP, 262,144 native context (1M with YaRN), Apache-2.0, released Aug 2026. Scores: Terminal Bench 2.1 73.0 (vs 63.4 for Qwen3.6-27B), SWE-bench Pro 61.7 (vs 53.5), LiveCodeBench v6 90.3 (vs 83.9), IFBench 79.5, GPQA 89.2. The card publishes no SWE-bench Verified or BFCL/tau2 score. — [Qwen/Qwen3.8-27B model card](https://huggingface.co/Qwen/Qwen3.8-27B)
- Qwen 3.8 open weights: 27B under Apache 2.0 (Aug 2026) plus a 2.4T-A95B Max model. Reported dates differ between Aug 8 and Aug 13-14. — [The Decoder](https://the-decoder.com/alibabas-qwen-team-releases-qwen-3-8-models-with-open-weights-under-the-apache-2-0-license/); [Qwen on X](https://x.com/Alibaba_Qwen/status/2088280182356611304)
- Qwen said it was "still working through the lineup for more sizes". Users asked for a 35B-A3B, and none was confirmed. — [Latent Space AINews, Aug 4 2026](https://latent.space/p/ainews-qwen-38-max24t-and-27b-new/)
- Hugging Face repos named "Qwen3.8-35B-A3B" are community distills whose base model is Qwen3.6-35B-A3B, not official releases. Some "Qwen3.8" repos are mislabelled. — [empero-ai/Qwen3.8-35B-A3B-Distill-GGUF](https://huggingface.co/empero-ai/Qwen3.8-35B-A3B-Distill-GGUF); [mradermacher](https://huggingface.co/mradermacher/Qwen3.8-35B-A3B-Distill-GGUF)
- On 16 GB: Qwen3.8-27B UD-Q3_K_XL is 13.44 GB (leaves ~3.5 GiB for context) and IQ4_XS is 15.71 GB (almost no KV room). UD-Q4_K_XL (16.7 GiB) does not fit. The tok/s ceilings of 53 and 46 are bandwidth estimates, not measurements. Article dated Jul 7, 2026, updated Aug 2026. — [LocalAIMaster](https://localaimaster.com/vram/best-qwen-model-16gb-vram)
- A Hugging Face discussion titled "Squeezing Qwen 3.8 27B into a Single 16 GB GPU — Almost 42 tok/s, 64K Context" exists on tooltd/Qwen3.8-27B-IQ4-XS-16GB-VRAM-GGUF. I saw only the title, so the hardware and settings are unverified. — [Kingy AI / search result](https://kingy.ai/blog/qwen3-8-27b-local-hardware-requirements/)
- Qwen3.6-35B-A3B: 35B total / 3B active, 256 experts (8 routed + 1 shared), 40 layers in a hybrid DeltaNet/attention layout, MTP, 262K context (1.01M with YaRN), Apache-2.0, April 2026. Scores: SWE-bench Verified 73.4, SWE-bench Pro 49.5, Terminal-Bench 2.0 51.5, LCB v6 80.4, TAU3 67.2, MCP-Atlas 62.8, MCPMark 37.0. In the same table, Gemma4-31B scores 52.0 on SWE-V and Gemma4-26B-A4B scores 17.4. — [Qwen/Qwen3.6-35B-A3B card](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- RX 9070 XT, measured: Qwen3.6-27B (Omnimerge-v4 IQ3_M, ~13 GB) ran at 46.06 tok/s with MTP and 25.88 without, with 62.7% draft acceptance and ~14.5/16 GB VRAM used. Settings: q8_0 KV, 16K→32K context, ROCm llama.cpp. Building with `-DGGML_CUDA_FA_ALL_QUANTS=ON` raised prefill with a quantized KV cache from 87 to 938 tok/s. The post is about 5 months old (~June 2026). — [Lemmy/r/LocalLLaMA crosspost](https://lemmy.world/post/48144487)
- RTX 3060 12 GB, measured: Qwen3.6-35B-A3B UD-Q4_K_XL ran at ~44 to 46 tok/s with `-ngl 99 --n-cpu-moe 26 -c 150000 -fa on -np 1 --cache-type-k q8_0 --cache-type-v q8_0 --no-mmproj-offload`. The user notes that the default `-np 4` multiplies the KV cache. — [Doğukan on X](https://x.com/DogukanUrker/status/2077472690156511643)
- RTX 4070 12 GB + 64 GB DDR5-6000, i5-12600K, measured: Qwen3-Coder-Next UD-Q4_K_XL (47 GB) gave ~40 tok/s generation and ~450 to 511 tok/s prompt processing with `--n-cpu-moe 40` or a `-ot` fit at 64K ctx with q8_0 KV. gpt-oss-120b (MXFP4 ~59 GB) gave ~25 to 30 tok/s and ~300 tok/s prompt processing. Practical context: 64K to 128K for Coder-Next and 24K to 32K for gpt-oss-120b. Coder-Next works with OpenCode, Roo, Claude Code and Qwen Code, but "sometimes loops". Post dated Feb to Mar 2026. — [carteakey.dev](https://carteakey.dev/blog/local-inference/optimizing-qwen3-coder-next-local-inference/)
- Qwen3-Coder-Next: Feb 2026, 80B/3B, SWE-bench Verified >70% (SWE-Agent scaffold). Devstral Small 2: Dec 2025, 24B dense, SWE-V 68.0%. Gemma 4 31B: Apr 2026, LCB v6 80.0. gpt-oss: Aug 2025, 120b is 65 GB and 20b is 14 GB in native MXFP4. October additions: Kolibri 1, LFM2.5-24B-A2B, Mellum2.1, Bonsai 2 (figures as listed above). Article updated Oct 14, 2026. — [vdf.ai roundup](https://vdf.ai/blog/best-local-llm-for-coding/)
- RX 9070 XT, gpt-oss-20b Q8_0 on llama.cpp b6401: Vulkan 152.7 tok/s generation and ~3,388 tok/s pp512; ROCm 117.2 and ~2,034 (~Sep 2025). — [OpenBenchmarking](https://openbenchmarking.org/result/2509078-NE-ROCMVSVUL92)
- RX 9070 XT under Ollama+ROCm: gpt-oss:20b 91.9 tok/s, qwen3:14b 52.2, qwen3.5:9b 57.8. qwen3.5:27b fell to 6.3 tok/s because it overflowed VRAM. — [hirokuze benchmark repo](https://github.com/hirokuze/local-llm-benchmark-rx9070xt/tree/main)
- An informal blog test using Unsloth Q6_K_XL found Qwen3.6-35B-A3B "significantly" better than Gemma4 26B-A4B on coding and agent tasks. Gemma did win one bug-fix test where Qwen hallucinated identifiers. — [grigio.org](https://grigio.org/can-i-really-code-on-my-pc-gemma4-26b-a4b-vs-qwen3-6-35b-a3b-coding-benchmark/)
- A July 2026 wiki names "Laguna XS 2.1 Q4_K_M (~14 GB)" as its top 16 GB pick and Devstral Small 2 as the dense option. I did not verify Laguna XS 2.1 from a primary source. — [spinningideas wiki](https://github.com/spinningideas/resources/wiki/AI-Development-Run-LLMs-Locally)
- Large October 2026 open releases are too big for this box: Mistral Large 4 (~1T, late Oct), Meta Muse Spark Open (816B/42B, Oct 15), Reflection Beam (501B/23B), GLM-5.3 (~753B), DeepSeek V4.1 Flash (552B). — [Fortune Oct 29 2026](https://fortune.com/2026/10/29/mistral-releases-new-model-large-4-and-claims-top-open-model-for-agentic-coding-and-cyber-defense/); [Meta](https://research.meta.ai/blog/muse-spark-open); [Reflection](https://reflection.ai/blog/introducing-beam); [vdf.ai](https://vdf.ai/blog/best-local-llm-for-coding/)

### Inferences
- **Agentic coding, fits in 16 GB:** use Qwen3.8-27B at UD-Q3_K_XL with MTP. Its vendor Terminal-Bench and SWE-Pro scores beat every other model in reach, but 3-bit on a dense 27B is a real quality cost and context will be about 32K or less unless the KV cache is quantized. Qwen3.6-27B on the same card is the one with a measured 46 tok/s.
- **Agentic coding, MoE with offload:** use Qwen3.6-35B-A3B UD-Q4_K_XL with `--n-cpu-moe` around 10 to 20 (tune). On a 9070 XT with 9800X3D and DDR5 it should do at least the ~45 tok/s seen on a 3060, with 128K+ context. Qwen3-Coder-Next and Kolibri 1 are the larger-MoE options that fit in 64 GB.
- **General chat/reasoning:** Qwen3.8-27B (GPQA 89.2) or Qwen3.6-35B-A3B. gpt-oss-120b is the larger-MoE option, but at 59 to 65 GB it leaves little RAM for the OS and KV cache on a 64 GB system.
- **Older than 4 months, probably superseded:** gpt-oss (Aug 2025), Devstral Small 2 (Dec 2025), Qwen3-Coder-Next (Feb 2026), Gemma 4 and Qwen3.6 (Apr 2026). Gemma 4 trails the Qwen models on agentic benchmarks in Qwen's own table, so treat that comparison as vendor-sourced.

### Gaps
- I found no measured Qwen3.8-27B speed on any 16 GB AMD card.
- I found no measured `--n-cpu-moe` numbers on an RX 9070 XT, 5070 Ti or 4070 Ti Super.
- I did not research Seed-OSS-36B, Nemotron (3.5 Super VL, Oct 16), GLM-4.x-Air / GLM-5.x-Flash small variants, Mistral Small 4.x or Laguna XS 2.1 because of the search budget. Nemotron 3.5 Super VL's open-weight status is "pending review" on Kilo.
- I found no current Aider Polyglot leaderboard entries for these models, and no independent SWE-bench Verified score for Qwen3.8-27B.

## Q2. Quantization levels and quant makers; low-bit degradation on small-active MoE

### Takeaway
Unsloth UD (Dynamic 2.0/3.0) quants are the default recommendation for the Qwen 3.6/3.8 family: UD-Q4_K_XL when it fits, UD-Q3_K_XL or IQ4_XS to fit a 27B in 16 GB, and no lower than UD-Q2_K_XL. I found no hard coding-benchmark data on 2 to 3 bit quants of A3B MoE models.

### Cited Findings
- Unsloth's Qwen3.6 guide recommends Dynamic UD-Q4_K_XL and suggests nothing below UD-Q2_K_XL. Memory needed: 27B is 15/18/24/30 GB at 3/4/6/8-bit; 35B-A3B is 17/23/30/38 GB. MTP variants need about 1 GB more. — [Unsloth Qwen3.6 docs](https://unsloth.ai/docs/models/qwen3.6)
- Unsloth Qwen3.6-35B-A3B GGUFs range from UD-IQ1_M (10 GB) through UD-Q6_K (29.3 GB) to Q8_0 (36.9 GB). The 27B at UD-Q4_K_XL is ~16 GB. — [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF); [unsloth/Qwen3.6-27B-GGUF](https://huggingface.co/unsloth/Qwen3.6-27B-GGUF)
- Unsloth Dynamic 3.0 claims up to ~10% better top-1% accuracy at the same size, mostly at small sizes. Unsloth itself calls top-1% a weak proxy for quality. — [Unsloth Dynamic 3.0](https://unsloth.ai/docs/basics/dynamic-3.0-ggufs)
- On Aider Polyglot, the Qwen3-Coder-480B 4-bit dynamic quant scored 60.9% vs 61.8% for bf16, so 4-bit loses little. I found no comparable 2 to 3 bit A3B data. — [Unsloth Qwen3-Coder docs](https://unsloth.ai/docs/models/qwen3-coder-how-to-run-locally)
- KV-cache precision: Gemma 4 26B-A4B is very sensitive (KL 0.377 already at q8_0). Qwen 3.6 models stay below KL 0.04 at q8_0 and 0.087 to 0.117 at q4_0. Post ~Apr 2026. — [localbench substack](https://localbench.substack.com/p/kv-cache-quantization-benchmark)
- An NVFP4 Unsloth quant of Qwen3.6 matched BF16 on MMLU-Pro and AIME, but lost about 1.8 points of GPQA on the 27B. NVFP4 is not relevant on RDNA4. — [Unsloth Qwen3.6 docs](https://unsloth.ai/docs/models/qwen3.6)
- An AMD-calibrated community quant exists: bakon3/Qwen3.6-35B-A3B-ROCMFP ("ROCmFPX"). It is unevaluated. — [HF](https://huggingface.co/bakon3/Qwen3.6-35B-A3B-ROCMFP)

### Inferences
- With 64 GB of RAM, a small-active MoE does not need to go below Q4. Offloading experts is cheap because only ~3B parameters are active per token, so Q4_K_XL (or Q5/Q6) with `--n-cpu-moe` beats a 2 to 3 bit quant squeezed into VRAM.
- Quantize the KV cache to q8_0 for Qwen, but avoid it for Gemma 4 26B-A4B.

### Gaps
- I found no source on ISTA DASLab GPTQ/"gsq" GGUFs for these models.
- I found no IQ4_XS vs Q4_K_M head-to-head for Qwen3.8-27B.
- I found no bartowski vs unsloth KLD comparison for these specific models.
- I found no SWE-bench or Aider numbers at 2 to 3 bit for A3B MoEs.

## Q3. Dense 27-32B in VRAM vs ~35B-A3B MoE with partial offload vs ~80-120B MoE in system RAM

### Takeaway
The community reports put the dense 27B at IQ3 to IQ4 at ~25 tok/s plain or ~46 tok/s with MTP on a 9070 XT, with short context. The 35B-A3B with offload reaches ~45 tok/s on even a 12 GB card, with 150K context. An 80B-A3B MoE mostly in RAM still reaches ~40 tok/s on 12 GB VRAM with 64 GB DDR5. A 117B/5.1B (gpt-oss-120b) drops to ~25 to 30 tok/s with only 24 to 32K practical context.

### Cited Findings
- Dense 27B on a 9070 XT runs at 25.9 tok/s, or 46 tok/s with MTP (IQ3_M, ~14.5 GB VRAM used, 16 to 32K ctx). — [Lemmy post](https://lemmy.world/post/48144487)
- In that thread, a commenter reports that Qwen3.6 27B with CPU offload on an 8 GB RTX 3070 collapses to 0.27 tok/s, while the 35B MoE runs at 20 to 30 tok/s on the same machine. Another commenter recommends experts-on-CPU, or ~120B MoE models, with 64 GB RAM. — [Lemmy post](https://lemmy.world/post/48144487)
- The 35B-A3B with `--n-cpu-moe 26` runs at ~45 tok/s with 150K context on 12 GB. — [X post](https://x.com/DogukanUrker/status/2077472690156511643)
- An 80B-A3B runs at ~40 tok/s with 64K to 128K practical context, and gpt-oss-120b at ~25 to 30 tok/s with 24 to 32K. — [carteakey.dev](https://carteakey.dev/blog/local-inference/optimizing-qwen3-coder-next-local-inference/)
- A llama.cpp wiki on CUDA "MoE expert cache" flags says they do not work on Vulkan or ROCm, so they don't apply to the 9070 XT. Standard `--n-cpu-moe` / `-ot` work on any backend. — [16GB VRAM Setup wiki](https://github.com/GenerelSchwerz/llama.cpp/wiki/16GB-VRAM-Setup)
- On the 9070 XT, Vulkan beat ROCm for gpt-oss-20b decode by ~30% (llama.cpp b6401). — [OpenBenchmarking](https://openbenchmarking.org/result/2509078-NE-ROCMVSVUL92)

### Inferences
- A dense model that spills past 16 GB is unusable, so the dense 27B must stay at 3-bit to IQ4_XS. MoE offload degrades gracefully.
- The 9800X3D with DDR5 should match or beat the i5/DDR5-6000 baseline for expert offload, but this is unmeasured on this hardware.
- Benchmark both Vulkan and ROCm builds on this card.

### Gaps
- I found no head-to-head agentic-coding quality comparison between dense 27B at IQ3 and 35B-A3B at Q4 on the same harness.
- I found no gpt-oss-120b or GLM-Air-class measurement on a 16 GB AMD card.

## Q3b. DeepSeek's October 2026 release (DeepSeek-V4.1-Flash-1017): can it run here?

### Takeaway
DeepSeek's October release is **DeepSeek-V4.1-Flash-1017**, released 17 Oct 2026 under the MIT license. It is an update to V4.1-Flash, which came out 10 Sep 2026. It is a very large MoE: 552B backbone per press reports, or "748B params" on Unsloth's GGUF card, with 8B active in prefill and 16B in decode. It is **out of reach on 16 GB VRAM + 64 GB RAM**, because the smallest GGUF, a 1-bit quant, is 233 GB, about 3× the box's 80 GB of combined memory. I found no official distill.

### Cited Findings
- Released Oct 17, 2026 as an update to DeepSeek-V4.1-Flash, MIT license, weights on Hugging Face and ModelScope. MoE with a 552B total backbone, 8B active during prefill and 16B during decoding. Terminal-Bench 4.0 42.3, HLE (no tools) 42.6. Article published Oct 19, 2026. — [Tech Insider](https://tech-insider.org/deepseek-v4-1-flash-1017-mit-license-update-2026/); [AI Weekly](https://aiweekly.co/alerts/deepseek-opens-v41-flash-1017-weights-and-075-search-api)
- DeepSeek's lineage: V4 preview on Apr 24, 2026; V4-Pro GA Aug 13; V4.1-Flash Sep 10. — [DeepSeek API news](https://api-docs.deepseek.com/news/news260424/); [vdf.ai](https://vdf.ai/blog/best-local-llm-for-coding/)
- Unsloth GGUF card: "748B params". It does not explain the gap from 552B; my guess is that it counts the vision encoder and DSpark modules, but that is unconfirmed. Quant sizes: UD-IQ1_S 233 GB, UD-IQ1_M 250 GB, UD-IQ2_XXS 300 GB, UD-Q2_K_XL 335 GB, UD-Q4_K_XL 501 GB, UD-Q8_K_XL 508 GB. Unsloth's guidance: "Run on a 128GB+ RAM device for the smallest 1-bit". Separate DSPARK draft files are 7.98 GB (Q8_0). Scores, 1017 vs V4.1-Flash: Terminal-Bench 4.0 42.3 vs 31.2, DeepSWE v1.1 77.0 vs 74.2, NL2Repo 68.2 vs 65.4. No SWE-bench Verified score is given. — [unsloth/DeepSeek-V4.1-Flash-1017-GGUF](https://huggingface.co/unsloth/DeepSeek-V4.1-Flash-1017-GGUF); [Unsloth on X](https://x.com/UnslothAI/status/2112212605930778830)
- Unsloth says the 1-bit quant keeps ~88.2% accuracy and calls 1017 "the strongest open model to date". That is Unsloth's claim. — [Unsloth on X](https://x.com/UnslothAI/status/2112212605930778830)
- The earlier DeepSeek-V4-Flash is 284B total / 13B active, 167 GB as shipped, so it is also beyond 80 GB. On its April preview card it scored 79.0 on SWE-bench Verified. — [unsloth/DeepSeek-V4-Flash-GGUF](https://huggingface.co/unsloth/DeepSeek-V4-Flash-GGUF); [vdf.ai](https://vdf.ai/blog/best-local-llm-for-coding/)
- A reported 1-bit, SSD-expert-streaming approach ("Mference") runs DeepSeek V4 Flash in ~5 to 7 GB RAM on an Apple M5 Pro. No speed was given that would make it useful for agentic coding. — [Latent Space, Aug 4 2026](https://latent.space/p/ainews-qwen-38-max24t-and-27b-new/)

### Inferences
- Even with every expert offloaded to RAM (`-ot`), the 233 GB minimum does not fit in 64 GB. The model would have to stream weights from SSD with mmap, giving well under 1 tok/s, which is impractical for coding agents. The only realistic way to use it on this box is DeepSeek's paid API or another hosted provider.
- The useful local proxies are still the Qwen 3.6/3.8 models above.

### Gaps
- I found no official DeepSeek distill of V4.x into a model that fits 16 to 80 GB. Search results mention community "Qwen-based DeepSeek-V4-Flash distills", but I did not verify them.
- I found no tok/s reports for 1017 on any hardware.
- I could not resolve the 552B vs 748B discrepancy.

## Q4. MTP heads and speculative decoding support in llama.cpp

### Takeaway
Qwen3.6 (27B, 35B-A3B), Qwen3.8-27B and Qwen3-Next-based models are MTP-trained. llama.cpp has merged MTP speculative decoding (PR #22673), and Unsloth ships `-MTP-` GGUFs. The speedup is ~1.4× or more for dense models and only ~1.15 to 1.2× for MoE.

### Cited Findings
- llama.cpp MTP is merged (PR #22673). Use the `unsloth/Qwen3.6-27B-MTP-GGUF` or `-35B-A3B-MTP-GGUF` files with `--spec-type draft-mtp --spec-draft-n-max 2`. Gains: dense ~1.4×, MoE ~1.15 to 1.2×. Draft acceptance falls from 83% to 50% at 4 draft tokens, so keep it at 2 or fewer. — [Unsloth Qwen3.6 docs](https://unsloth.ai/docs/models/qwen3.6)
- On a 9070 XT, MTP took the 27B from 25.9 to 46.1 tok/s (~1.8×) with 62.7% acceptance. It needs an MTP-specific GGUF and no separate draft model. A commenter warns that MTP slows prefill and uses extra memory. — [Lemmy post](https://lemmy.world/post/48144487)
- The Qwen3.8-27B card says the model was "trained with multiple steps" of MTP. — [Qwen3.8-27B card](https://huggingface.co/Qwen/Qwen3.8-27B)
- The Qwen3.6-35B-A3B card lists MTP serving configs: SGLang NEXTN and vLLM `qwen3_next_mtp`. — [Qwen3.6-35B-A3B card](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- llama.cpp also merged MTP/"DSpark" support for DeepSeek V4 Flash, a model too large for this box. — [Latent Space](https://latent.space/p/ainews-qwen-38-max24t-and-27b-new/)

### Inferences
- MTP matters most for the fits-in-VRAM dense 27B, the case where this card is bandwidth-bound. It matters less for offloaded MoE, where the bottleneck is CPU and RAM.

### Gaps
- I did not confirm whether official MTP GGUFs exist for Qwen3.8-27B (as opposed to Qwen3.6).
- I did not confirm whether gpt-oss, Gemma 4 or Devstral have small draft models in recommended use.
