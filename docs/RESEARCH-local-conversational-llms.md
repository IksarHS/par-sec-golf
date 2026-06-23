# Local / On-Device LLMs for a Conversational "Talking Golf Ball" Caddie

Research report — current as of **early–mid 2026**. Web-sourced; citations inline.

**Product context:** *Par Sec*'s in-game caddie companion is a **character**, not an assistant —
a chatty, in-character golf ball. It must run **fully locally, zero token/API cost**:
- **Now:** in-browser via **WebLLM (MLC, WebGPU)** — the prototype `prototypes/golfball-llm.html`.
- **Later (optional):** a packaged desktop/mobile app (**Tauri/Electron + Ollama or llama.cpp**).

> **TL;DR recommendation**
> - **In-browser now:** ship **Llama-3.2-3B-Instruct-q4f16_1-MLC** as the default "good GPU" pick,
>   with **Qwen2.5-1.5B-Instruct-q4f16_1-MLC** as the broad-compatibility middle, and
>   **Gemma-2-2b-it-q4f16_1-MLC** as the "punches-way-above-its-weight personality" option to test.
>   Keep **Qwen2.5-0.5B** as the phone / weak-GPU fallback. (The rule-based "ball-brain" stays as the no-WebGPU floor.)
> - **Packaged app later:** **Hermes-3-Llama-3.1-8B** (character-tuned) or **Mistral-NeMo-12B** at **Q4_K_M**
>   on a 16 GB machine — a clear, *noticeable* jump in charm and memory over any 3B.

---

## 1. What makes a model "good at conversation"?

A raw **base model** is just a next-token predictor trained on internet text. It will happily ramble,
repeat your prompt, or refuse to "answer" because it was never taught the question→answer shape.
A **chat / instruct model** is a base model put through extra training stages that teach it to *behave
in a dialogue*. Those stages are the levers that matter:

- **Instruction / chat tuning (SFT — supervised fine-tuning):** the base model is fine-tuned on
  prompt→ideal-response pairs (and multi-turn dialogues). This is what turns a text predictor into
  something that answers, stays on topic, and respects a system prompt. *Instruct models consistently
  outperform base models because they learn from high-quality demonstration data.*
  ([langcopilot](https://langcopilot.com/posts/2025-07-16-supervised-fine-tuning-sft-llms-practical-guide),
  [Medium / Yashwanth](https://medium.com/@yashwanths_29644/llm-finetuning-series-05-llm-architectures-base-instruct-and-chat-models-a6219c39c362))
- **Preference tuning (RLHF / DPO / KTO):** after SFT, the model is nudged toward responses humans
  *prefer* — more helpful, more natural, less robotic. SFT optimizes "correctness vs a label"; preference
  tuning optimizes the *subjective* qualities (tone, warmth, not being a wall of bullet points) that
  matter most for open-ended chat. *Online iterative RLHF significantly improves conversation quality*,
  and newer "think-then-chat" RL variants beat plain RLHF on creative-writing/conversation benchmarks.
  ([RLHF Workflow](https://arxiv.org/pdf/2405.07863),
  [CleverX](https://cleverx.com/blog/supervised-fine-tuning-vs-rlhf-choosing-the-right-path-to-train-your-llm/),
  [arXiv 2509.20357](https://arxiv.org/html/2509.20357v1))
- **Data quality > raw size at small scale.** The standout small models (Gemma-2-2B, Phi) get their
  punch from **distillation** — learning from a much larger teacher model — and curated data, not parameters.
  Gemma-2-2B beats GPT-3.5 and Mixtral-8x7B on LMSYS Chatbot Arena Elo *at 2B params* precisely because of this.
  ([Gemma 2 explainer](https://developers.googleblog.com/gemma-explained-new-in-gemma-2/),
  [Gemma 2 paper](https://arxiv.org/html/2408.00118v1))
- **Context length:** how much chat history + persona the model can "remember" in one go. For a caddie
  you need very little (persona + last few exchanges). More context = more VRAM, so for in-browser use
  a **1K–4K** window is plenty; long-context variants waste memory you don't have.

### What to look for (and avoid) for a *character chit-chat* companion

| Look for | Avoid |
| --- | --- |
| **Instruct/chat** tuned (never a `-base`) | Base models, "reasoning"/"thinking" models (e.g. Qwen3-thinking, R1 distills) — they emit `<think>` chains, are slow, and over-explain |
| **Personable, warm default tone** (Gemma-2, Llama-3.2, Hermes) | **Coder/Math** variants (Qwen2.5-Coder, Qwen2.5-Math) — terse, dry, refuse small talk |
| **Steerable by system prompt** (follows a persona) | Heavily "assistant-safety" models that constantly break character with disclaimers |
| **Roleplay/character finetunes** for max charm (Hermes-3, NeMo) | Huge context windows you'll never use (burns VRAM) |
| **Small enough to load fast** in a browser tab | 7B+ in-browser on a thin laptop (won't fit / crawls) |

For our use case the order of priorities is: **in-character personality > warmth/naturalness >
instruction-following > raw knowledge/reasoning.** A caddie that's witty and a little wrong beats a
caddie that's a precise, boring assistant.

---

## 2. Best small local conversational models, by size tier

Sizes are **q4 (~4-bit)** downloads; VRAM/RAM is the working footprint at that quant. Sources:
[Local AI Master SLM guide](https://localaimaster.com/blog/small-language-models-guide-2026),
[MachineLearningMastery](https://machinelearningmastery.com/top-7-small-language-models-you-can-run-on-a-laptop/),
[DataCamp](https://www.datacamp.com/blog/top-small-language-models),
WebLLM `config.ts` VRAM figures (next section).

### Size-tier cheat-sheet

| Tier | Standout models | Why good at *conversation* | ~q4 download | ~VRAM/RAM |
| --- | --- | --- | --- | --- |
| **Sub-1B** (0.5–1B) — phone / weak-GPU | **Qwen2.5-0.5B-Instruct**, **Llama-3.2-1B-Instruct**, **SmolLM2-1.7B/360M** | Coherent enough for short, scripted-feeling banter; needs heavy persona + few-shot help | 0.3–0.9 GB | 0.4–1.1 GB |
| **1–4B** — **the in-browser sweet spot** | **Llama-3.2-3B-Instruct**, **Gemma-2-2B-it**, **Qwen2.5-1.5B/3B-Instruct**, **Phi-3.5-mini (3.8B)** | First tier that feels genuinely chatty & natural; Gemma-2-2B & Llama-3.2-3B are the most *personable* | 1.0–2.5 GB | 1.2–3.2 GB |
| **7–9B** — best quality, needs a real GPU / packaged app | **Llama-3.1-8B-Instruct**, **Qwen2.5-7B-Instruct**, **Mistral-7B / Mistral-NeMo-12B**, **Gemma-2-9B**, **Hermes-3-8B** | Clearly more natural, witty, and consistent in character; remembers the bit | ~4.5–7 GB | 5–8 GB |

### Tier notes

- **Sub-1B:** Qwen2.5-0.5B is the strongest tiny chatter and the safest phone/weak-GPU fallback.
  Llama-3.2-1B is warmer but heavier. SmolLM2 is "tiny & fast" but bland — fine as a last resort.
  At this size, **personality comes almost entirely from your system prompt + few-shot examples**, not the weights.
- **1–4B (recommend these):**
  - **Gemma-2-2B-it** — the value champ for *personality*. Distilled from much larger Gemmas; on LMSYS
    Chatbot Arena it scores ~**1126 Elo**, ahead of Mixtral-8x7B (1114) and GPT-3.5-Turbo (1106) — astonishing
    for 2B. Warm, friendly default voice; great for a character.
    ([Gemma 2 paper](https://arxiv.org/html/2408.00118v1),
    [inferless](https://www.inferless.com/learn/the-ultimate-guide-to-gemma-models))
  - **Llama-3.2-3B-Instruct** — the well-rounded, most *documented* conversational small model; natural,
    friendly, strong instruction-following and persona adherence. Great default if you want one safe pick.
  - **Qwen2.5-1.5B / 3B-Instruct** — excellent instruction-following and multilingual; slightly more
    "assistant-y" than Gemma but very capable and small. 1.5B is the best *broad-compatibility* middle.
  - **Phi-3.5-mini (3.8B)** — smartest of the tier on benchmarks (reasoning/coding), but more formal/
    "assistant"-flavored — less naturally charming for pure chit-chat. Good when you want competence.
- **7–9B (best, but a leap):**
  - **Llama-3.1-8B-Instruct** — the natural/charming all-rounder; the quality you feel vs a 3B.
  - **Qwen2.5-7B-Instruct** — strong, slightly drier; great instruction-following.
  - **Mistral-7B / Mistral-NeMo-12B** — Mistral lineage is a perennial roleplay favorite; NeMo (12B) is
    a community darling for character work and creative writing.
  - **Gemma-2-9B** — Gemma's warmth scaled up; very pleasant conversationalist.

### Models specifically tuned for **roleplay / character / personality** (our actual use case)

Since the caddie is a *character*, these matter more than raw assistant benchmarks:

- **Hermes-3 (Nous Research)** — `Hermes-3-Llama-3.2-3B` and `Hermes-3-Llama-3.1-8B`. Tuned for
  steerability, persona-following, and *staying in character* with far fewer safety interruptions than
  vanilla Llama. **The 3B Hermes is directly available in WebLLM** — a strong in-browser character pick.
- **Mistral-NeMo-12B** + its RP finetunes (e.g. *MN Violet Lotus 12B*) — community-leading emotional
  depth and long character memory; packaged-app territory.
- **OpenHermes-2.5-Mistral-7B / Dolphin-Mistral-7B** — classic light-machine RP/chat finetunes; "small,
  light, good roleplay replies with the right prompts."
  ([nutstudio RP roundup](https://nutstudio.imyfone.com/llm-tips/best-llm-for-roleplay/),
  [techtactician 7B RP](https://techtactician.com/best-7b-llm-models-for-oobabooga-ai-roleplay-and-chatting/))

> For *Par Sec*, the character-tuned angle means: **try Hermes-3-Llama-3.2-3B in-browser** alongside
> Gemma-2-2B and Llama-3.2-3B; reach for **Hermes-3-8B or NeMo-12B** if/when you ship a packaged app.

---

## 3. In-browser reality: WebLLM / WebGPU (the "now" path)

WebLLM ships a curated set of **MLC prebuilt** model IDs; only these load with no compile step.
Verified against `mlc-ai/web-llm` `src/config.ts` and the model-list issue. WebGPU is now shipped by
default in Chrome, Edge, Firefox, and Safari (as of late 2025), so the audience is broad.
([web-llm repo](https://github.com/mlc-ai/web-llm),
[config.ts](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts),
[model list #683](https://github.com/mlc-ai/web-llm/issues/683))

### WebLLM-available conversational models (the subset that matters for us)

| MLC model ID | Params | Context | VRAM (q4f16_1) | Conversation fit |
| --- | --- | --- | --- | --- |
| `SmolLM2-360M-Instruct-q4f16_1-MLC` | 0.36B | 4K | ~376 MB | Last-resort tiny |
| `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | 0.5B | — | ~0.5 GB | **Phone / weak-GPU fallback** |
| `Llama-3.2-1B-Instruct-q4f16_1-MLC` | 1B | 4K | ~879 MB | Light, warmer than 0.5B |
| `SmolLM2-1.7B-Instruct-q4f16_1-MLC` | 1.7B | 4K | ~1.8 GB | OK, a bit bland |
| `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | 1.5B | — | ~1.63 GB | **Balanced broad-compat middle** |
| `gemma-2-2b-it-q4f16_1-MLC` | 2B | 4K | ~2.5 GB | **Best personality-per-MB** |
| `Llama-3.2-3B-Instruct-q4f16_1-MLC` | 3B | 4K | ~2.3 GB | **Best default conversationalist** |
| `Hermes-3-Llama-3.2-3B-q4f16_1-MLC` | 3B | 4K | ~2.3 GB | **Character-tuned 3B** (try this) |
| `Qwen2.5-3B-Instruct-q4f16_1-MLC` | 3B | — | ~2.5 GB | Capable, slightly drier |
| `Phi-3.5-mini-instruct-q4f16_1-MLC` | 3.8B | 4K (also -1k) | ~2.5 GB | Smart, more formal |
| `Qwen2.5-7B-Instruct-q4f16_1-MLC` | 7B | — | ~5+ GB | Edge-of-browser, real GPU only |
| `Hermes-3-Llama-3.1-8B-q4f16_1-MLC` | 8B | 4K | ~4.9 GB | Char-tuned, at the browser ceiling |
| `Llama-3.1-8B-Instruct-q4f16_1-MLC-1k` | 8B | 1K | ~4.6 GB | Best in-browser quality, risky fit |

(Avoid for our use: `Qwen2.5-Coder-*`, `Qwen2.5-Math-*`, `Phi-3.5-vision-*` — wrong flavor / VLM.)

### Practical ceiling & speed in a browser tab

- **Chrome caps GPU memory at ~4 GB per tab.** An 8B model in 4-bit sits *right at that edge* — it may
  load on a strong machine but will OOM on many. **The reliable cross-device sweet spot is 1B–3B; the hard
  practical max is 7B–8B on a dedicated GPU only.**
- **Tokens/sec (WebLLM published, M3 Max):** Llama-3.1-8B q4 ≈ **41 tok/s**, Phi-3.5-mini ≈ **71 tok/s**.
  On weaker machines: an **M1/8GB** runs 0.5B–3B comfortably at **20–40 tok/s**, and 8B at only ~**10–14 tok/s**.
  The general in-browser sweet spot (0.5–3B q4) runs **~40–180 tok/s** and downloads in 0.3–2 GB.
  ([buildmvpfast](https://www.buildmvpfast.com/blog/webgpu-browser-ai-inference-cost-savings-2026),
  [WebLLM paper](https://arxiv.org/html/2412.15803v2))
- **First-load download caching:** WebLLM downloads weights once and **caches them in the browser**
  (Cache Storage / IndexedDB); subsequent loads are fast and offline. So a one-time 1–2.5 GB download is
  acceptable; a 5 GB one (8B) is a rough first-run experience on slow connections.
- **Quantization — q4f16_1 vs q4f32_1:** both are ~4-bit weights; the suffix is the *activation/scale*
  precision. **`q4f16_1` (fp16) is smaller and faster and the right default for our caddie.** `q4f32_1`
  (fp32) is a bit larger/slower but more robust on GPUs/drivers with flaky fp16 support — keep it as a
  fallback if a user reports garbled output or load failures. (E.g. Llama-3.2-3B: q4f16 ≈ 2.3 GB vs
  q4f32 ≈ 2.9 GB.)

### Realistic best-conversation pick that still loads on a normal laptop in Chrome

**`Llama-3.2-3B-Instruct-q4f16_1-MLC`** (~2.3 GB) is the best balance of *natural conversation* and
*fits-on-a-normal-laptop*. **`gemma-2-2b-it-q4f16_1-MLC`** is the most *charming-per-byte* and loads even
more easily — strongly worth A/B-ing as the personality default. Below that, **`Qwen2.5-1.5B`** is the
graceful step-down for weak GPUs, and **`Qwen2.5-0.5B`** is the phone floor.
The prototype's current ladder (0.5B → 1B → 1.5B → 3B → Phi-3.5) is **already well chosen**; the only
refinements are to **add `gemma-2-2b-it` and `Hermes-3-Llama-3.2-3B`** as conversational/character options
and keep **Llama-3.2-3B as default** (Phi-3.5 is the "smart but formal" alt, not the charm pick).

---

## 4. Packaged-app path (Tauri/Electron — the "later" bigger leap)

Shipping a real app removes the browser's ~4 GB/tab VRAM cap and lets you use the **GGUF** ecosystem and
better quantization, so you can run **7B–12B** comfortably and get a *noticeably* warmer, more consistent caddie.

### Ollama vs llama.cpp / node-llama-cpp

- **Ollama** runs as a **separate localhost daemon** (`:11434`). Easiest to drive (simple HTTP API, model
  pulls), but it's an external dependency *next to* your app, not bundled inside it — extra install/UX surface.
- **llama.cpp / node-llama-cpp** can be **embedded directly in the binary** (Tauri Rust side, or Electron
  native module). Lowest overhead, fully bundled, offline, no separate daemon. **node-llama-cpp** is the
  natural fit for a JS/TS + Electron/Tauri app. This is the right path for a self-contained shippable product.
  ([codersera](https://codersera.com/blog/ollama-vs-lm-studio-vs-vllm-vs-llama-cpp-vs-mlx-2026/),
  [n1n Tauri+llama.cpp](https://explore.n1n.ai/blog/building-private-ai-desktop-app-rust-tauri-llamacpp-2026-06-09),
  [kunalganglani](https://www.kunalganglani.com/blog/ollama-vs-llama-cpp))
- **Tauri vs Electron:** Tauri uses the system WebView instead of bundling Chromium, so it's **much
  lighter on RAM** (no "Electron tax") — leaving more headroom for the model. Jan ships on Tauri for this reason.
  ([itsfoss](https://itsfoss.com/jan-ai/),
  [Medium / de Silva](https://medium.com/@dillon.desilva/building-local-lm-desktop-applications-with-tauri-f54c628b13d9))

### Realistic model sizes on a consumer laptop (GGUF, Q-quant)

- **8 GB RAM:** runs **7B at Q4_K_M** (fits; tight). **16 GB RAM is the sweet spot** for 7B–8B with room.
- **16–24 GB / a real GPU:** **12B (Mistral-NeMo) at Q4_K_M** is very comfortable and a real character upgrade.
- **Quantization:** **`Q4_K_M` is the recommended default** (best size/quality balance); step up to
  **`Q5_K_M`** if you notice quality shortfalls and have the RAM. (Analogous to q4f16 in WebLLM, but the
  GGUF K-quants are higher-quality at the same bit-width.)
- **Speed:** CPU-only on a typical laptop is modest (single-digit tok/s for 7B, e.g. ~6.6 tok/s observed),
  so target machines with a GPU/Apple-Silicon for a snappy feel; M2 Max does ~28 tok/s at 8B.
  ([Local AI Master](https://localaimaster.com/blog/small-language-models-guide-2026),
  [itsfoss](https://itsfoss.com/jan-ai/),
  [modelpiper Apple-Silicon](https://modelpiper.com/blog/local-llm-benchmarks-apple-silicon))

### How much better is conversation at 7–8B vs 3B?

Noticeably. A 3B caddie is *good* but occasionally stiff, loses the thread of a running joke, and breaks
character under pressure. A 7–8B (especially a character-tuned **Hermes-3-8B** or **NeMo-12B**) is markedly
more **natural, witty, and consistent** — it holds the bit, varies its phrasing, and stays in voice. That's
the single biggest quality jump available to this product, and it's only practical in a packaged app.

**Packaged-app pick:** **Hermes-3-Llama-3.1-8B (Q4_K_M)** for character fidelity on 16 GB, or
**Mistral-NeMo-12B (Q4_K_M)** if you have the headroom and want maximum charm/memory, via **node-llama-cpp
in a Tauri shell**.

---

## 5. Practical knobs beyond model choice (make even a small model feel alive)

These matter *more* than the exact model at the small-model end — a great persona + few-shot at temp 0.8
beats a bigger model with a lazy prompt.

- **System-prompt / persona design:** give the ball a **name, voice, quirks, and hard rules** ("You are
  a wisecracking sentient golf ball caddie. Always stay in character. 1–2 short sentences. Never mention
  you're an AI."). Pin tone, length, and the no-break-character rule explicitly — small models drift without it.
- **Few-shot persona examples (the biggest small-model lever):** include 2–4 short example exchanges in
  the prompt showing the exact voice. This "shows, not tells" the personality and dramatically improves
  in-character consistency for 0.5B–3B models that can't infer tone from a description alone.
- **Temperature / top-p:** for a *fun, varied* character, use **temperature ~0.8–1.0** (creativity with
  coherence). **Tune temperature *or* top-p, not both** — providers explicitly recommend this. A good
  start: `temperature 0.8, top_p 0.95`. Lower toward 0.6 if it goes off the rails on weak models.
  ([learnprompting](https://learnprompting.org/docs/intermediate/configuration_hyperparameters),
  [Muxup quick-ref](https://muxup.com/2025q2/recommended-llm-parameter-quick-reference))
- **Repetition penalty:** small models loop. Add a **light `frequency_penalty` ~0.3–0.7** (or
  `repetition_penalty` ~1.1) to break loops. **Don't exceed ~1.0–1.15** repetition_penalty / high frequency
  penalty — too high and it avoids needed common words and produces unnatural phrasing.
- **Context-window management:** keep history short — **persona + few-shot + last ~3–4 turns**. This keeps
  latency/VRAM low (critical in-browser at 1–4K context) and stops the model from getting confused; summarize
  or drop old turns rather than growing the window. (The prototype already "keeps context short for the tiny model" — good.)
- **Stop sequences & length caps:** cap `max_tokens` low (e.g. 60–100) so the caddie stays punchy, and set
  stop sequences to prevent it from inventing the user's next line.

---

## Final recommendation for *Par Sec*'s golf-ball caddie

1. **In-browser, ship now:** default to **`Llama-3.2-3B-Instruct-q4f16_1-MLC`** (best
   natural-conversation-that-still-loads). Add **`gemma-2-2b-it-q4f16_1-MLC`** (most charming per byte —
   A/B it for the personality default) and **`Hermes-3-Llama-3.2-3B-q4f16_1-MLC`** (character-tuned).
   Keep **`Qwen2.5-1.5B`** (weak-GPU middle) and **`Qwen2.5-0.5B`** (phone floor), and the **rule-based
   ball-brain** as the no-WebGPU fallback. Use **q4f16_1**, with **q4f32_1** as a robustness fallback.
2. **Packaged app later:** **`Hermes-3-Llama-3.1-8B` (Q4_K_M)** on 16 GB, or **`Mistral-NeMo-12B` (Q4_K_M)**
   for max charm, via **node-llama-cpp + Tauri** (bundled, light, offline). This is the biggest available
   jump in how alive the caddie feels.
3. **Spend effort on the persona, not just the weights:** a tight in-character system prompt, 2–4 few-shot
   exchanges, `temp ~0.8`, light repetition penalty, short context, and a low token cap will make even the
   0.5–3B models feel like a *character*.

### Biggest takeaways

1. **Pick chat/instruct, never base or coder/math/reasoning** variants — flavor matters more than benchmark scores for a companion.
2. **3B is the in-browser sweet spot; Gemma-2-2B over-delivers on personality** thanks to distillation (beats GPT-3.5 on Arena at 2B).
3. **The browser's ~4 GB/tab cap makes 8B risky in-tab; a Tauri+llama.cpp app is the real unlock for 7–12B** and a clearly warmer caddie.
4. **System prompt + few-shot + sampling settings are the cheapest, highest-leverage way to make a small model feel in-character.**

### Key sources

- WebLLM repo & model list / `config.ts` — [github.com/mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) · [config.ts](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts) · [models #683](https://github.com/mlc-ai/web-llm/issues/683)
- WebGPU/WebLLM perf — [WebLLM paper (arXiv 2412.15803)](https://arxiv.org/html/2412.15803v2) · [buildmvpfast](https://www.buildmvpfast.com/blog/webgpu-browser-ai-inference-cost-savings-2026)
- Small-model rankings — [Local AI Master](https://localaimaster.com/blog/small-language-models-guide-2026) · [DataCamp](https://www.datacamp.com/blog/top-small-language-models) · [MachineLearningMastery](https://machinelearningmastery.com/top-7-small-language-models-you-can-run-on-a-laptop/)
- Gemma-2 conversation/Arena — [Gemma 2 paper](https://arxiv.org/html/2408.00118v1) · [Gemma 2 explainer](https://developers.googleblog.com/gemma-explained-new-in-gemma-2/)
- Roleplay/character models — [nutstudio](https://nutstudio.imyfone.com/llm-tips/best-llm-for-roleplay/) · [techtactician](https://techtactician.com/best-7b-llm-models-for-oobabooga-ai-roleplay-and-chatting/)
- Base vs chat / SFT vs RLHF — [langcopilot SFT](https://langcopilot.com/posts/2025-07-16-supervised-fine-tuning-sft-llms-practical-guide) · [CleverX](https://cleverx.com/blog/supervised-fine-tuning-vs-rlhf-choosing-the-right-path-to-train-your-llm/) · [arXiv 2509.20357](https://arxiv.org/html/2509.20357v1)
- Packaged-app runtimes — [codersera](https://codersera.com/blog/ollama-vs-lm-studio-vs-vllm-vs-llama-cpp-vs-mlx-2026/) · [Tauri+llama.cpp](https://explore.n1n.ai/blog/building-private-ai-desktop-app-rust-tauri-llamacpp-2026-06-09) · [itsfoss/Jan](https://itsfoss.com/jan-ai/)
- Sampling/persona knobs — [learnprompting](https://learnprompting.org/docs/intermediate/configuration_hyperparameters) · [Muxup quick-ref](https://muxup.com/2025q2/recommended-llm-parameter-quick-reference)
</content>
</invoke>
