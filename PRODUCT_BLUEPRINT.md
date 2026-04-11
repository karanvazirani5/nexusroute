# ModelPilot — Product Blueprint

> **The intelligence layer between humans and AI models.**

---

## 1. Product One-Liner

**ModelPilot analyzes your prompt and tells you exactly which AI model will produce the best result — and why.**

---

## 2. Product Vision

The AI model landscape is fragmented, fast-moving, and opaque. There are 100+ foundation models across OpenAI, Anthropic, Google, Meta, Mistral, Cohere, and others. Each has different strengths, weaknesses, pricing, context windows, and failure modes. No human can track this. Most users default to ChatGPT or whatever they tried first — and they leave enormous quality and cost savings on the table.

**ModelPilot exists to close that gap.**

The free version is the world's most knowledgeable AI model advisor. It understands what your prompt needs and matches it to the model that will deliver the best result. Not based on marketing claims — based on structured, continuously-updated research on actual model capabilities.

The paid version takes that intelligence and makes it operational: route prompts automatically, execute through user-provided API keys, build multi-model workflows, and optimize cost/quality tradeoffs at scale.

**The mental model:**

```
Free Version  = GPS that tells you the best route
Paid Version  = GPS + self-driving car that takes you there
```

The free version is not a demo. It is the brain. The paid version is the body.

---

## 3. Who It Is For

### Primary Personas (Free)

| Persona | Description | Pain Point |
|---|---|---|
| **The AI Power User** | Uses 3–5 AI tools weekly, switches between them, doesn't know which is best for what | Wastes time experimenting; uncertain if they're using the right model |
| **The Developer** | Building apps on top of LLMs, choosing models for production | Needs to justify model choice to team; benchmarks are confusing and synthetic |
| **The Prompt Engineer** | Crafting prompts professionally or seriously | Wants to optimize output quality per prompt type |
| **The AI-Curious Professional** | Marketer, lawyer, analyst, writer exploring AI tools | Overwhelmed by options; doesn't know what models are good at their specific tasks |

### Primary Personas (Paid)

| Persona | Description | Pain Point |
|---|---|---|
| **The Builder** | Shipping AI-powered products, needs a routing layer | Doesn't want to hardcode a single model; wants intelligent fallback |
| **The Team Lead** | Managing a team that uses AI across workflows | Needs visibility, cost control, standardization |
| **The Enterprise Buyer** | Evaluating AI for department or company-wide deployment | Needs defensible model selection, compliance, auditability |

### Deliberate Exclusion

This is NOT for people who want another ChatGPT wrapper. This is for people who want to use AI more effectively by choosing the right tool for the job.

---

## 4. Core Problem

**People use the wrong AI model for their task — constantly.**

- A developer uses GPT-4o for a simple formatting task that GPT-4o-mini could handle at 1/30th the cost.
- A writer uses Claude for structured JSON extraction when Gemini would be significantly more reliable.
- A researcher uses a 128K-context model for a 500-word summary, paying for capacity they don't need.
- A coder uses a general-purpose model when a code-specialized model would produce far better results.

The cost of this is invisible but massive: lower output quality, higher latency, wasted money, and growing frustration as model options multiply.

**There is no trusted, intelligent, prompt-aware system that helps users make this decision.**

Existing solutions are:
- Static model directories (Hugging Face, model cards) — no prompt analysis, no personalization
- Benchmark leaderboards (LMSYS Chatbot Arena, OpenRouter rankings) — aggregate scores, not task-specific
- AI aggregators (OpenRouter, TypingMind) — route by user choice, don't recommend
- Blog posts / Twitter threads — stale within weeks, anecdotal, biased

---

## 5. Core Solution

A prompt-aware recommendation engine backed by a continuously-updated AI model knowledge base.

**Input:** A user's actual prompt (or description of their task).

**Processing:**
1. Classify the task type (coding, writing, analysis, extraction, creative, multimodal, etc.)
2. Infer dimensional requirements (reasoning depth, speed need, cost sensitivity, output structure, etc.)
3. Score every tracked model against those requirements using a weighted matching algorithm
4. Rank and select top recommendations

**Output:**
- Primary recommendation with confidence score
- 2–4 backup options
- Per-model explanation of fit
- Tradeoff visualization (speed vs quality, cost vs capability)
- "Best for" and "Not ideal for" notes
- Educational context that builds user's own model literacy

---

## 6. Why This Is Compelling

### For Users
- **Immediate value:** Paste a prompt, get a smarter answer about what to use — in seconds, for free.
- **Education as a feature:** Every recommendation teaches the user something about the model landscape.
- **Trust through transparency:** Scoring logic is visible. No black box.

### As a Business
- **Network effects:** Every prompt analyzed improves the system's understanding of task patterns.
- **Wedge strategy:** Free recommendation engine → paid execution layer is a proven SaaS playbook (cf. Cloudflare, Figma, Slack).
- **Defensible knowledge base:** Structured, curated model intelligence is a moat that generic AI wrappers don't build.
- **Timing:** The model landscape is fragmenting rapidly. The need for a recommendation layer will only grow as models multiply.
- **Revenue expansion:** Once users trust the recommendations, routing and execution is the natural next step. Paid tier has strong unit economics (% of API spend or flat subscription).

---

## 7. Free Version Product Design

### Core Capability

The free version is a **standalone, fully-functional recommendation engine** that operates entirely without external API calls.

### Feature Breakdown

| Feature | Included | Notes |
|---|---|---|
| Prompt input and analysis | Yes | Single-prompt analysis, no batch |
| Task classification | Yes | Category, sub-category, complexity |
| Model recommendation (top 5) | Yes | With scoring and ranking |
| Explanation of recommendation | Yes | Per-model reasoning |
| Tradeoff visualization | Yes | Radar chart, comparison table |
| Model detail pages | Yes | Full capability profiles |
| Model comparison (2-model) | Yes | Side-by-side |
| History of last 10 analyses | Yes | Local storage, no account needed |
| Account creation | Optional | For saving history server-side |
| Prompt templates / examples | Yes | Pre-built for common tasks |
| "Best model for X" quick guides | Yes | Evergreen educational content |
| API key integration | No | Paid only |
| Prompt execution | No | Paid only |
| Batch analysis | No | Paid only |
| Team features | No | Paid only |
| Custom model profiles | No | Paid only |
| Webhook / API access | No | Paid only |

### What Makes It Feel Valuable (Not Crippled)

1. **The analysis is complete.** The user gets the full recommendation, full explanation, full scoring breakdown. Nothing is blurred or gated.
2. **The knowledge is deep.** Model profiles contain real, structured data — not marketing copy. Notes on weaknesses, edge cases, benchmark context.
3. **The UX is premium.** This should feel like using a Bloomberg terminal for AI models, not a basic comparison site.
4. **There is a learning loop.** The more prompts a user analyzes, the more they learn about the model landscape — building habit and trust.

### Conversion Hooks (Embedded, Not Annoying)

- After recommendation: "Want to run this prompt on [Model X] right now? → Connect your API key"
- On results page: "Save this analysis to your dashboard → Create free account → Upgrade for execution"
- After 3rd analysis in a session: Subtle banner — "You're becoming an AI model expert. Unlock routing for your team."
- On model detail page: "Test this model with your own prompt → Upgrade to execute"

---

## 8. Paid Version Product Design

### Tier Structure

| Tier | Price | Target |
|---|---|---|
| **Free** | $0 | Individual exploration and recommendation |
| **Pro** | $29/mo | Individual power user — execution + history + saved preferences |
| **Team** | $79/mo per seat | Team workspace, shared routing profiles, usage analytics |
| **Enterprise** | Custom | SSO, audit logs, SLAs, custom model integrations, on-prem knowledge base |

### Pro Features

| Feature | Description |
|---|---|
| API key vault | Store keys for OpenAI, Anthropic, Google, Mistral, etc. (encrypted, per-user) |
| One-click execution | Run the recommended model directly from the results page |
| Auto-routing | System selects and executes the best model automatically |
| Fallback chains | Define fallback models if primary fails or is slow |
| Full analysis history | Unlimited saved analyses with search |
| Saved prompt templates | Personal prompt library with preferred model mappings |
| Cost tracker | Track spend across providers, see optimization suggestions |
| Priority model updates | Get new model evaluations within 48 hours of release |

### Team Features

| Feature | Description |
|---|---|
| Shared workspace | Team-wide prompt library and routing rules |
| Usage dashboard | Who used what model, when, at what cost |
| Routing policies | "All legal prompts must use [Model X]" — admin-defined rules |
| Cost allocation | Per-team, per-project cost tracking |
| Shared API key pool | Team-managed key vault |

### Enterprise Features

| Feature | Description |
|---|---|
| SSO / SAML | Standard enterprise auth |
| Audit logging | Full prompt and routing audit trail |
| Custom models | Add proprietary or fine-tuned models to the knowledge base |
| On-prem option | Self-hosted knowledge base and routing engine |
| Dedicated support | SLA-backed response times |
| Compliance reports | Model selection justification documentation |

---

## 9. User Journey

### Free User Journey

```
1. Land on homepage
   → See clear value prop: "Paste your prompt. We'll tell you the best AI model for it."
   → See example analyses (3-4 real examples pre-rendered)

2. Paste prompt into input
   → Prompt is analyzed in real-time (< 2 seconds)

3. View results
   → Top recommendation with confidence score (e.g., "Claude 3.5 Sonnet — 94% match")
   → 3-4 backup options ranked below
   → Expandable reasoning for each model
   → Tradeoff radar chart
   → "Why not [Model X]?" section

4. Explore model details
   → Click any model to see full profile
   → Capability scores, best/worst use cases, pricing, context window
   → Compare two models side-by-side

5. Build habit
   → Come back for next prompt
   → History shows last 10 analyses (local storage)

6. Conversion moment
   → After 5+ analyses, user trusts the system
   → CTA: "Run this prompt directly → Connect API key"
   → Or: "Save your analysis history → Create account"
```

### Paid User Journey (Pro)

```
1. Create account → Add API key(s) for 1+ providers

2. Paste prompt
   → Same analysis as free
   → Plus: "Execute on Claude 3.5 Sonnet →" button

3. Execute
   → Prompt sent to selected model via user's API key
   → Response rendered in-app
   → Cost logged

4. Iterate
   → "Try this on GPT-4o instead" → one-click re-run
   → Compare outputs side by side

5. Auto-route (optional)
   → Toggle: "Let ModelPilot choose and execute automatically"
   → System analyzes → selects → executes → returns response

6. Review analytics
   → Dashboard: prompts analyzed, models used, costs, quality trends
```

---

## 10. UX / UI Structure

### Design Principles

- **Dense but not cluttered.** Think Linear or Raycast — information-rich, but every pixel earns its place.
- **Dark mode default** with light mode option. AI power users expect this.
- **Speed is a feature.** Analysis must feel instant (< 2 seconds). Loading states must be smooth.
- **Trust through transparency.** Every score is clickable. Every recommendation is explained. No "trust us" moments.

### Page Architecture

#### Homepage (`/`)

```
┌─────────────────────────────────────────────────────┐
│  ModelPilot                          [Log in] [Try]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│     Paste your prompt.                               │
│     We'll tell you the best AI model for it.         │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │                                               │   │
│  │  Enter your prompt here...                    │   │
│  │                                               │   │
│  │                                               │   │
│  │                              [Analyze →]      │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ── Try an example ──                                │
│  [Write a cold email] [Summarize a paper]            │
│  [Generate React code] [Extract contract risks]      │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  How it works:                                       │
│  1. Paste your prompt                                │
│  2. We analyze what the task needs                   │
│  3. We match it to 50+ models                        │
│  4. You get the best recommendation with reasoning   │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [Example Analysis Preview - Interactive]            │
│  Shows a real analysis result inline so users        │
│  see the output quality before they try it           │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Trusted by X,000 developers and AI professionals    │
│  (social proof once available)                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**
- The prompt input is the hero. Not marketing copy, not features. The input.
- Example prompts reduce blank-page anxiety. They also demonstrate breadth.
- An inline example analysis shows the quality of output — this is the best marketing.

#### Results Page (`/analyze/{id}`)

```
┌──────────────────────────────────────────────────────────┐
│  ModelPilot              [New Analysis] [History] [Pro]   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  YOUR PROMPT                                              │
│  "Extract all risk factors from this legal contract       │
│   and return them as structured JSON with severity        │
│   ratings."                                               │
│                                         [Edit] [Re-run]   │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  TASK ANALYSIS                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Category: Data Extraction                         │     │
│  │ Sub-type: Structured output from unstructured     │     │
│  │ Complexity: Medium-High                           │     │
│  │ Key requirements:                                 │     │
│  │   ● Structured output (JSON) — Critical           │     │
│  │   ● Domain knowledge (legal) — Important          │     │
│  │   ● Reasoning depth — Important                   │     │
│  │   ● Instruction following — Critical              │     │
│  │   ● Creativity — Not needed                       │     │
│  │   ● Speed — Moderate                              │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ★ TOP RECOMMENDATION                                     │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Claude 3.5 Sonnet              Score: 94/100     │     │
│  │  Anthropic · $3/$15 per 1M tokens · 200K ctx      │     │
│  │                                                    │     │
│  │  Why this model:                                   │     │
│  │  → Best-in-class structured output reliability     │     │
│  │  → Strong legal/analytical reasoning               │     │
│  │  → Excellent instruction following for JSON        │     │
│  │  → High factuality in domain-specific extraction   │     │
│  │                                                    │     │
│  │  Watch out for:                                    │     │
│  │  → Slower than GPT-4o-mini for simple tasks        │     │
│  │  → Higher cost than necessary if contract is short │     │
│  │                                                    │     │
│  │  [Run on Claude 3.5 Sonnet → Pro]                  │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  ALSO STRONG                                              │
│  ┌─────────────────────┐ ┌─────────────────────┐         │
│  │ GPT-4o       89/100 │ │ Gemini 1.5 Pro 86/100│        │
│  │ Strong JSON output  │ │ Large context window │         │
│  │ Slightly less       │ │ Good for very long   │         │
│  │ reliable on         │ │ contracts. Weaker on │         │
│  │ complex nested JSON │ │ strict JSON schema   │         │
│  │ [Details ↓]         │ │ [Details ↓]          │         │
│  └─────────────────────┘ └─────────────────────┘         │
│                                                           │
│  BUDGET ALTERNATIVE                                       │
│  ┌──────────────────────────────────────────────────┐     │
│  │ GPT-4o-mini                     Score: 72/100     │     │
│  │ 90% cheaper · Good enough if contract is < 10pp   │     │
│  │ Risk: May miss nuanced legal language              │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  COMPARISON                                               │
│                                                           │
│  [Radar Chart comparing top 3 models across dimensions]  │
│                                                           │
│  Dimension        Claude 3.5  GPT-4o  Gemini 1.5 Pro    │
│  ─────────────────────────────────────────────────────    │
│  Structured Output    9.5       8.5       7.5            │
│  Legal Reasoning      9.0       8.5       8.0            │
│  Instruction Follow   9.5       9.0       8.0            │
│  Speed                7.0       8.5       7.5            │
│  Cost Efficiency      6.5       7.0       7.0            │
│  Context Capacity     8.5       7.0       9.5            │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  LEARN MORE                                               │
│  → Why structured output reliability matters              │
│  → How to write better prompts for JSON extraction        │
│  → Full Claude 3.5 Sonnet capability profile              │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  ─── Want to execute this? ───                            │
│  Connect your API key and run prompts directly.           │
│  [Upgrade to Pro — $29/mo]                                │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

#### Model Profile Page (`/models/{slug}`)

```
┌──────────────────────────────────────────────────────────┐
│  Claude 3.5 Sonnet                       by Anthropic     │
│  Released: June 2024 · Last evaluated: 3 days ago         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  CAPABILITY SCORES (1-10)                                 │
│  ┌──────────────────────────────────────────────────┐     │
│  │ [Horizontal bar chart]                            │     │
│  │ Reasoning .............. ████████████░░ 9.0       │     │
│  │ Coding ................. █████████████░ 9.5       │     │
│  │ Structured Output ...... █████████████░ 9.5       │     │
│  │ Creativity ............. ████████░░░░░░ 7.5       │     │
│  │ Factuality ............. █████████████░ 9.0       │     │
│  │ Instruction Following .. █████████████░ 9.5       │     │
│  │ Speed .................. ████████░░░░░░ 7.0       │     │
│  │ Cost Efficiency ........ ██████░░░░░░░░ 6.0       │     │
│  │ Long Context ........... █████████░░░░░ 8.5       │     │
│  │ Multimodal ............. ████████████░░ 8.5       │     │
│  │ Tool Use ............... █████████████░ 9.0       │     │
│  │ Safety/Enterprise ...... █████████████░ 9.5       │     │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  BEST FOR                                                 │
│  ✓ Complex code generation and debugging                  │
│  ✓ Structured data extraction (JSON, XML)                 │
│  ✓ Legal and regulatory document analysis                 │
│  ✓ Long-form analytical writing                           │
│  ✓ Multi-step reasoning tasks                             │
│                                                           │
│  NOT IDEAL FOR                                            │
│  ✗ Ultra-low-latency applications                         │
│  ✗ Budget-constrained high-volume simple tasks            │
│  ✗ Real-time conversational agents (cost)                 │
│  ✗ Tasks requiring web access (no native browsing)        │
│                                                           │
│  SPECS                                                    │
│  Context window: 200,000 tokens                           │
│  Input cost: $3.00 / 1M tokens                            │
│  Output cost: $15.00 / 1M tokens                          │
│  Multimodal: Vision (images)                              │
│  Tool use: Yes (function calling)                         │
│  Knowledge cutoff: April 2024                             │
│                                                           │
│  KNOWN WEAKNESSES                                         │
│  - Can be overly cautious with safety-adjacent prompts    │
│  - Occasionally verbose when conciseness is requested     │
│  - Higher latency on long outputs vs GPT-4o               │
│                                                           │
│  BENCHMARK CONTEXT                                        │
│  - LMSYS Arena ELO: 1271 (as of last update)              │
│  - HumanEval: 92.0%                                       │
│  - MMLU: 88.7%                                            │
│  - Note: Benchmarks are directional, not absolute.        │
│    Our scoring weights real-world task performance         │
│    more heavily than synthetic benchmarks.                 │
│                                                           │
│  [Compare with another model ↓]                           │
│  [Try a prompt with this model → Pro]                     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

#### Model Comparison Page (`/compare?models=claude-3.5-sonnet,gpt-4o`)

Side-by-side comparison with:
- Radar chart overlay
- Dimension-by-dimension table
- "Better for" / "Worse for" callouts
- Price comparison calculator (input tokens × cost)
- "Which should I use?" summary

---

## 11. Information Architecture

```
/                           → Homepage + prompt input
/analyze/{id}               → Analysis results page
/models                     → Model directory (browsable, searchable)
/models/{slug}              → Individual model profile
/compare                    → Side-by-side model comparison
/guides                     → "Best model for X" evergreen guides
/guides/{slug}              → Individual guide
/changelog                  → Model knowledge base update log
/pricing                    → Free vs Pro vs Team vs Enterprise
/account                    → User settings (Pro+)
/account/keys               → API key management (Pro+)
/account/history            → Full analysis history (Pro+)
/dashboard                  → Usage analytics (Pro+)
/team                       → Team workspace (Team+)
/admin/models               → Internal: model research admin
/admin/research             → Internal: research queue + freshness
/api/v1/analyze             → Public API (Team+, Enterprise)
/api/v1/execute             → Execution API (Pro+)
/api/v1/models              → Models API (Free, rate-limited)
```

---

## 12. Model Research System

### Overview

This is the product's core intellectual asset. It must be:
- **Structured** — not free-text opinions, but scored dimensions with methodology
- **Sourced** — every claim should trace back to benchmarks, research papers, or systematic testing
- **Fresh** — stale data is worse than no data in a fast-moving field
- **Opinionated** — aggregate scores require judgment calls; document them

### Model Knowledge Schema

Every model in the system is stored with the following structured profile:

```
MODEL PROFILE
├── Identity
│   ├── model_id (unique slug: "claude-3.5-sonnet")
│   ├── display_name ("Claude 3.5 Sonnet")
│   ├── provider ("Anthropic")
│   ├── model_family ("Claude 3.x")
│   ├── release_date (2024-06-20)
│   ├── is_active (true — still available via API)
│   ├── is_deprecated (false)
│   └── api_identifiers ({"anthropic": "claude-3-5-sonnet-20241022"})
│
├── Specifications
│   ├── context_window (200000)
│   ├── max_output_tokens (8192)
│   ├── input_price_per_1m_tokens (3.00)
│   ├── output_price_per_1m_tokens (15.00)
│   ├── supports_vision (true)
│   ├── supports_audio (false)
│   ├── supports_video (false)
│   ├── supports_function_calling (true)
│   ├── supports_json_mode (true)
│   ├── supports_streaming (true)
│   ├── knowledge_cutoff ("2024-04")
│   └── supported_languages (["en", "fr", "de", "es", ...])
│
├── Capability Scores (1.0–10.0 scale)
│   ├── reasoning_ability (9.0)
│   ├── coding_ability (9.5)
│   ├── long_context_quality (8.5)
│   ├── structured_output_reliability (9.5)
│   ├── multimodal_understanding (8.5)
│   ├── speed (7.0)
│   ├── cost_efficiency (6.0)
│   ├── creativity (7.5)
│   ├── factuality (9.0)
│   ├── instruction_following (9.5)
│   ├── tool_use_quality (9.0)
│   ├── safety_enterprise_suitability (9.5)
│   └── conversational_quality (8.5)
│
├── Qualitative Intelligence
│   ├── best_use_cases (["Complex code generation", "JSON extraction", ...])
│   ├── worst_use_cases (["Budget-constrained high-volume", ...])
│   ├── known_weaknesses (["Overly cautious on safety-adjacent", ...])
│   ├── known_strengths (["Exceptional at following complex instructions", ...])
│   ├── edge_case_notes (["May refuse to generate content about...", ...])
│   └── provider_notes ("Anthropic emphasizes safety; model tends to err conservative")
│
├── Benchmark Data
│   ├── mmlu_score (88.7)
│   ├── humaneval_score (92.0)
│   ├── arena_elo (1271)
│   ├── gsm8k_score (96.4)
│   ├── custom_benchmarks ({})
│   └── benchmark_notes ("Scores from provider; independently validated on Arena")
│
├── Research Metadata
│   ├── last_evaluated_date (2025-04-01)
│   ├── evaluation_method ("benchmark + manual testing + community consensus")
│   ├── source_confidence (0.9) — 0-1, how confident we are in our scores
│   ├── sources (["Anthropic model card", "LMSYS Arena", "Internal testing"])
│   └── needs_re_evaluation (false)
│
└── Taxonomy Tags
    ├── tier ("frontier") — frontier | mid | budget | specialized
    ├── primary_modality ("text") — text | multimodal | code | embedding
    └── tags (["enterprise-ready", "coding", "reasoning", "structured-output"])
```

### Capability Scoring Methodology

Each capability dimension is scored on a 1.0–10.0 scale using a composite of:

| Weight | Source | Description |
|--------|--------|-------------|
| 30% | Public benchmarks | MMLU, HumanEval, Arena ELO, GSM8K, etc. — normalized to 1-10 |
| 30% | Systematic internal testing | Standardized prompt battery across task types |
| 20% | Community consensus | Aggregated signal from developer forums, Reddit, Twitter, expert reviews |
| 20% | Provider documentation | Official capabilities, model cards, technical reports |

**Scoring calibration rules:**
- 10.0 = Best model available for this dimension, by a clear margin
- 8.0–9.5 = Excellent, frontier-tier performance
- 6.0–7.9 = Good, competent but not best-in-class
- 4.0–5.9 = Adequate but notable weaknesses
- 1.0–3.9 = Significant limitations, actively avoid for this dimension

Scores are relative to the current model landscape, not absolute. They are recalibrated when a new frontier model shifts the curve.

### Research Freshness Protocol

| Trigger | Action |
|---------|--------|
| New model released by tracked provider | Evaluate within 7 days; publish preliminary scores within 14 days |
| Major model update (e.g., new version) | Re-evaluate affected dimensions within 5 days |
| 30 days since last evaluation | Flag for review; re-run internal test battery |
| 90 days since last evaluation | Mark as "potentially stale"; show warning in UI |
| Community reports conflicting with scores | Queue for priority re-evaluation |
| Benchmark leaderboard shift | Re-calibrate relative scores across all models in affected dimensions |

### Tracked Model Universe (Launch)

Start with 25–35 models across these providers:

| Provider | Models to Track |
|----------|----------------|
| OpenAI | GPT-4o, GPT-4o-mini, GPT-4 Turbo, o1, o1-mini, o3-mini |
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus |
| Google | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash |
| Meta | Llama 3.1 405B, Llama 3.1 70B, Llama 3.1 8B (via providers) |
| Mistral | Mistral Large, Mistral Medium, Mistral Small, Codestral |
| Cohere | Command R+, Command R |
| DeepSeek | DeepSeek-V3, DeepSeek-Coder-V2 |
| xAI | Grok-2 |

Expand to 50+ models within 3 months. Include specialized models (code-specific, embedding, etc.) as the taxonomy grows.

---

## 13. Prompt Analysis System

### Design Constraint

The free version cannot call external model APIs. All prompt analysis must be done locally using:
- Rule-based classifiers
- Keyword/pattern matching
- Lightweight statistical NLP (TF-IDF, regex)
- Decision trees
- Optionally: a small, self-hosted classifier model (e.g., fine-tuned DistilBERT or similar)

### Analysis Pipeline

```
User Prompt
    │
    ▼
┌─────────────────────────┐
│  Stage 1: Preprocessing │
│  - Normalize whitespace  │
│  - Detect language        │
│  - Estimate token count   │
│  - Extract key phrases    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  Stage 2: Task Classification   │
│  - Rule-based category matcher  │
│  - Keyword signal scoring       │
│  - Pattern detection            │
│  - Output: primary + secondary  │
│    task categories              │
└───────────┬─────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Stage 3: Requirement Extraction     │
│  - Infer dimensional weights from    │
│    task category + prompt signals    │
│  - Output: requirement vector        │
│    (13 dimensions, each 0.0–1.0)     │
└───────────┬──────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Stage 4: Context Enrichment         │
│  - Estimate required context length  │
│  - Detect budget sensitivity signals │
│  - Detect precision vs ideation mode │
│  - Detect business risk level        │
│  - Detect multi-step needs           │
└───────────┬──────────────────────────┘
            │
            ▼
  Structured PromptAnalysis object
  → passed to Recommendation Engine
```

### Stage 2: Task Classification — Detailed Design

**Task Taxonomy (2-level):**

```
CODING
├── code_generation          "Write a function that..."
├── code_debugging           "Fix this error...", "Why does this fail..."
├── code_review              "Review this code...", "What's wrong with..."
├── code_explanation         "Explain what this code does..."
├── code_refactoring         "Refactor this to...", "Optimize this..."
└── code_translation         "Convert this Python to TypeScript..."

WRITING
├── creative_writing         "Write a story...", "Draft a poem..."
├── business_writing         "Write an email...", "Draft a proposal..."
├── technical_writing        "Write documentation...", "Create a README..."
├── copywriting              "Write ad copy...", "Create a tagline..."
├── editing_proofreading     "Edit this for...", "Improve the tone..."
└── translation              "Translate this to..."

ANALYSIS
├── summarization            "Summarize this...", "TL;DR..."
├── data_extraction          "Extract...", "Pull out the..."
├── sentiment_analysis       "What is the sentiment...", "How does this read..."
├── comparison               "Compare X and Y..."
├── research_synthesis       "What does the research say about..."
└── document_analysis        "Analyze this contract...", "Review this paper..."

REASONING
├── math_computation         "Calculate...", "Solve this equation..."
├── logic_puzzles            "If A then B...", logical reasoning
├── strategic_planning       "Create a plan for...", "How should we..."
├── decision_support         "Should I...", "What's the best approach..."
└── multi_step_reasoning     "Think through...", "Step by step..."

STRUCTURED_OUTPUT
├── json_generation          "Return as JSON...", "Format as {"
├── table_generation         "Create a table...", "Organize into columns..."
├── list_generation          "List the top...", "Give me 10..."
├── schema_design            "Design a schema...", "What fields should..."
└── data_transformation      "Convert this CSV to...", "Restructure..."

MULTIMODAL
├── image_analysis           "What's in this image...", "Describe this photo..."
├── image_generation         "Generate an image of..."
├── document_ocr             "Read the text in this...", image + extraction
└── visual_reasoning         "Based on this chart...", "Compare these images..."

CONVERSATION
├── brainstorming            "Help me brainstorm...", "Give me ideas..."
├── tutoring                 "Explain ... to me like...", "Teach me..."
├── roleplay                 "Act as a...", "You are a..."
├── open_qa                  "What is...", "How does..."
└── debate                   "Argue for/against..."
```

**Classification Method:**

The classifier uses a **weighted keyword signal approach** with the following process:

```python
# Simplified classification logic

TASK_SIGNALS = {
    "code_generation": {
        "strong": ["write a function", "implement", "create a class",
                   "build a component", "code that", "write code"],
        "moderate": ["python", "javascript", "typescript", "react", "api",
                     "endpoint", "database", "query", "algorithm"],
        "weak": ["function", "code", "program", "script", "app"]
    },
    "data_extraction": {
        "strong": ["extract", "pull out", "parse and return",
                   "return as json", "structured output"],
        "moderate": ["find all", "identify", "list the", "from this document"],
        "weak": ["get", "show me", "what are the"]
    },
    # ... (all categories defined)
}

def classify_task(prompt: str) -> TaskClassification:
    prompt_lower = prompt.lower()
    scores = {}

    for task, signals in TASK_SIGNALS.items():
        score = 0
        matched_signals = []
        for phrase in signals["strong"]:
            if phrase in prompt_lower:
                score += 3.0
                matched_signals.append(("strong", phrase))
        for phrase in signals["moderate"]:
            if phrase in prompt_lower:
                score += 1.5
                matched_signals.append(("moderate", phrase))
        for phrase in signals["weak"]:
            if phrase in prompt_lower:
                score += 0.5
                matched_signals.append(("weak", phrase))

        scores[task] = (score, matched_signals)

    ranked = sorted(scores.items(), key=lambda x: x[1][0], reverse=True)

    return TaskClassification(
        primary=ranked[0][0],
        primary_confidence=min(ranked[0][1][0] / 10.0, 1.0),
        secondary=ranked[1][0] if ranked[1][1][0] > 1.0 else None,
        signals=ranked[0][1][1]
    )
```

**Additional classification signals:**

| Signal | Detection Method |
|--------|-----------------|
| Code present in prompt | Regex: backticks, indentation patterns, common syntax |
| JSON/structured output requested | Keywords: "JSON", "structured", "format as", curly braces |
| Image/file referenced | Keywords: "this image", "attached", "screenshot", file extensions |
| Long context likely needed | Prompt length > 2000 chars, or mentions "document", "paper", "contract" |
| Speed emphasized | Keywords: "quickly", "fast", "brief", "short" |
| High precision needed | Keywords: "exactly", "precise", "accurate", "must be correct" |
| Creative freedom | Keywords: "creative", "brainstorm", "ideas", "possibilities" |
| Budget sensitive | Keywords: "cheap", "affordable", "free", "low cost", "budget" |

### Stage 3: Requirement Vector Generation

Once the task is classified, the system generates a **requirement vector** — a 13-dimensional vector where each dimension represents how important that capability is for this specific prompt.

**Dimensions:**

```
requirement_vector = {
    "reasoning":              0.0–1.0,   # How much reasoning depth is needed
    "coding":                 0.0–1.0,   # How much code ability is needed
    "long_context":           0.0–1.0,   # How important is long context handling
    "structured_output":      0.0–1.0,   # How important is structured output reliability
    "multimodal":             0.0–1.0,   # Does the task require vision/audio
    "speed":                  0.0–1.0,   # How important is low latency
    "cost_efficiency":        0.0–1.0,   # How important is low cost
    "creativity":             0.0–1.0,   # How much creative generation is needed
    "factuality":             0.0–1.0,   # How important is factual accuracy
    "instruction_following":  0.0–1.0,   # How important is precise instruction adherence
    "tool_use":               0.0–1.0,   # Does the task benefit from tool/function calling
    "safety_enterprise":      0.0–1.0,   # Is this a high-stakes enterprise context
    "conversational":         0.0–1.0,   # Is this a conversational/interactive task
}
```

**Mapping from task category to requirement vector:**

Each task category has a **base requirement template** that is then adjusted by prompt-level signals.

```python
TASK_REQUIREMENT_TEMPLATES = {
    "code_generation": {
        "reasoning": 0.7, "coding": 1.0, "long_context": 0.4,
        "structured_output": 0.6, "multimodal": 0.0, "speed": 0.4,
        "cost_efficiency": 0.3, "creativity": 0.2, "factuality": 0.8,
        "instruction_following": 0.9, "tool_use": 0.3,
        "safety_enterprise": 0.2, "conversational": 0.1
    },
    "data_extraction": {
        "reasoning": 0.6, "coding": 0.1, "long_context": 0.5,
        "structured_output": 1.0, "multimodal": 0.0, "speed": 0.5,
        "cost_efficiency": 0.4, "creativity": 0.0, "factuality": 0.9,
        "instruction_following": 1.0, "tool_use": 0.2,
        "safety_enterprise": 0.3, "conversational": 0.0
    },
    "creative_writing": {
        "reasoning": 0.3, "coding": 0.0, "long_context": 0.3,
        "structured_output": 0.1, "multimodal": 0.0, "speed": 0.3,
        "cost_efficiency": 0.3, "creativity": 1.0, "factuality": 0.2,
        "instruction_following": 0.6, "tool_use": 0.0,
        "safety_enterprise": 0.1, "conversational": 0.3
    },
    "brainstorming": {
        "reasoning": 0.5, "coding": 0.0, "long_context": 0.2,
        "structured_output": 0.2, "multimodal": 0.0, "speed": 0.6,
        "cost_efficiency": 0.5, "creativity": 0.9, "factuality": 0.3,
        "instruction_following": 0.5, "tool_use": 0.0,
        "safety_enterprise": 0.1, "conversational": 0.7
    },
    "math_computation": {
        "reasoning": 1.0, "coding": 0.3, "long_context": 0.2,
        "structured_output": 0.5, "multimodal": 0.0, "speed": 0.3,
        "cost_efficiency": 0.2, "creativity": 0.0, "factuality": 1.0,
        "instruction_following": 0.8, "tool_use": 0.5,
        "safety_enterprise": 0.2, "conversational": 0.1
    },
    # ... all categories defined
}
```

**Prompt-level adjustments:**

After applying the base template, the system adjusts based on prompt-specific signals:

```python
def adjust_requirements(base: dict, prompt: str) -> dict:
    adjusted = base.copy()

    # Long prompt → increase long_context need
    token_estimate = len(prompt.split()) * 1.3
    if token_estimate > 1000:
        adjusted["long_context"] = min(adjusted["long_context"] + 0.3, 1.0)

    # JSON/structured output explicitly requested
    if any(kw in prompt.lower() for kw in ["json", "csv", "xml", "yaml", "table format"]):
        adjusted["structured_output"] = min(adjusted["structured_output"] + 0.3, 1.0)

    # Speed signals
    if any(kw in prompt.lower() for kw in ["quick", "fast", "brief", "asap"]):
        adjusted["speed"] = min(adjusted["speed"] + 0.3, 1.0)

    # Budget signals
    if any(kw in prompt.lower() for kw in ["cheap", "budget", "affordable", "cost"]):
        adjusted["cost_efficiency"] = min(adjusted["cost_efficiency"] + 0.4, 1.0)

    # Precision signals
    if any(kw in prompt.lower() for kw in ["exactly", "precise", "must be correct", "accurate"]):
        adjusted["factuality"] = min(adjusted["factuality"] + 0.2, 1.0)
        adjusted["instruction_following"] = min(adjusted["instruction_following"] + 0.2, 1.0)

    # Image/multimodal detected
    if any(kw in prompt.lower() for kw in ["image", "photo", "screenshot", "picture", "diagram"]):
        adjusted["multimodal"] = 1.0

    return adjusted
```

### Stage 4: Context Enrichment

Additional metadata that helps the recommendation engine but doesn't map directly to model capabilities:

```python
@dataclass
class PromptContext:
    estimated_input_tokens: int        # Approximate token count of the prompt
    estimated_output_tokens: int       # Estimated based on task type (short answer vs essay)
    requires_multi_turn: bool          # Does this seem like a conversation starter?
    business_risk: str                 # "low" | "medium" | "high" — based on domain signals
    single_model_sufficient: bool      # Or would a workflow be better?
    domain: str | None                 # Detected domain: "legal", "medical", "financial", etc.
    language: str                      # Detected language of the prompt
```

---

## 14. Recommendation Engine Logic

### Core Algorithm: Weighted Dimensional Matching

The recommendation engine computes a **match score** between the prompt's requirement vector and each model's capability vector.

**Algorithm:**

```python
def compute_match_score(
    requirements: dict[str, float],     # 13-dimensional requirement vector (0-1)
    model_capabilities: dict[str, float] # 13-dimensional capability vector (1-10)
) -> float:
    """
    Compute how well a model matches the prompt's requirements.

    Returns a score from 0-100.

    Logic:
    1. For each dimension, compute: requirement_weight × model_capability_normalized
    2. Sum weighted scores
    3. Apply penalty for critical misses (high requirement, low capability)
    4. Normalize to 0-100

    This is NOT cosine similarity. It is a weighted fulfillment score:
    "How well does this model fulfill what this prompt needs?"
    """
    DIMENSIONS = [
        "reasoning", "coding", "long_context", "structured_output",
        "multimodal", "speed", "cost_efficiency", "creativity",
        "factuality", "instruction_following", "tool_use",
        "safety_enterprise", "conversational"
    ]

    raw_score = 0.0
    total_weight = 0.0
    penalties = 0.0

    for dim in DIMENSIONS:
        req = requirements.get(dim, 0.0)       # 0-1: how important is this?
        cap = model_capabilities.get(dim, 5.0)  # 1-10: how good is the model?
        cap_normalized = cap / 10.0              # normalize to 0-1

        if req == 0.0:
            continue  # dimension irrelevant for this prompt

        # Weighted contribution
        contribution = req * cap_normalized
        raw_score += contribution
        total_weight += req

        # Critical miss penalty: high requirement + low capability
        if req >= 0.7 and cap < 5.0:
            penalties += (req - cap_normalized) * 0.5

    if total_weight == 0:
        return 50.0  # no requirements detected; neutral score

    # Normalize to 0-100
    base_score = (raw_score / total_weight) * 100
    final_score = max(0, base_score - (penalties * 20))

    return round(min(final_score, 100), 1)
```

### Hard Filters (Pre-Scoring)

Before scoring, eliminate models that cannot fulfill hard requirements:

| Hard Filter | Logic |
|---|---|
| Multimodal required but model doesn't support vision | Exclude |
| Context window needed > model's context window | Exclude |
| JSON mode required but model has no JSON mode | Exclude (or penalize heavily) |
| Model is deprecated | Exclude |
| Model is marked inactive | Exclude |

### Tie-Breaking Rules

When two or more models score within 3 points of each other:

1. **Prefer the model with higher scores on the most important dimension** (the requirement dimension with the highest weight)
2. **Prefer the more cost-efficient model** (if scores are near-identical, why pay more?)
3. **Prefer the more recent model** (newer models tend to have better overall quality)
4. **Prefer the model with higher source confidence** (we're more sure about our scores)

### Confidence Scoring

The system outputs a confidence score for the recommendation:

```python
def compute_confidence(
    top_score: float,
    second_score: float,
    primary_task_confidence: float,  # from classifier
    source_confidence: float          # from model research metadata
) -> float:
    """
    Confidence that the top recommendation is correct.

    Factors:
    - Score gap: larger gap = more confident
    - Classification confidence: if we're unsure about the task, we're unsure about the match
    - Source confidence: if our model data is stale, lower confidence
    """
    score_gap_factor = min((top_score - second_score) / 20.0, 1.0)  # 20+ point gap = max
    classification_factor = primary_task_confidence
    source_factor = source_confidence

    confidence = (
        score_gap_factor * 0.4 +
        classification_factor * 0.35 +
        source_factor * 0.25
    )

    return round(confidence * 100, 0)  # 0-100%
```

### Recommendation Output Structure

```python
@dataclass
class ModelRecommendation:
    model_id: str
    model_name: str
    provider: str
    score: float                           # 0-100
    rank: int                              # 1, 2, 3...
    reasoning: list[str]                   # ["Best-in-class structured output", ...]
    warnings: list[str]                    # ["Higher cost than alternatives", ...]
    best_for: list[str]                    # from model profile, filtered to relevant
    not_ideal_for: list[str]               # from model profile, filtered to relevant
    dimensional_scores: dict[str, float]   # per-dimension match breakdown
    pricing_estimate: dict                 # {"input_cost": "$0.003", "output_cost": "$0.015"}

@dataclass
class AnalysisResult:
    prompt_hash: str
    task_classification: TaskClassification
    requirement_vector: dict[str, float]
    prompt_context: PromptContext
    recommendations: list[ModelRecommendation]  # ordered by score, top 5
    confidence: float                            # 0-100%
    analysis_timestamp: str
    budget_alternative: ModelRecommendation | None  # cheapest "good enough" option
    explanation_summary: str                         # 2-3 sentence plain English summary
```

### Example Walkthrough

**Prompt:** "Extract all risk factors from this legal contract and return them as structured JSON with severity ratings."

**Stage 2 — Classification:**
```
primary: "data_extraction"
secondary: "json_generation"
confidence: 0.85
signals: [("strong", "extract"), ("strong", "return as json"), ("moderate", "from this document")]
```

**Stage 3 — Requirement Vector:**
```
reasoning:             0.6  (base) → 0.6 (no adjustment)
coding:                0.1  (base) → 0.1
long_context:          0.5  (base) → 0.8 (+0.3, "contract" suggests long document)
structured_output:     1.0  (base) → 1.0 (already max, JSON explicitly requested)
multimodal:            0.0  (base) → 0.0
speed:                 0.5  (base) → 0.5
cost_efficiency:       0.4  (base) → 0.4
creativity:            0.0  (base) → 0.0
factuality:            0.9  (base) → 0.9
instruction_following: 1.0  (base) → 1.0
tool_use:              0.2  (base) → 0.2
safety_enterprise:     0.3  (base) → 0.5 (+0.2, "legal" domain detected)
conversational:        0.0  (base) → 0.0
```

**Stage 4 — Context:**
```
estimated_input_tokens: ~5000 (contract assumed)
estimated_output_tokens: ~2000 (structured extraction)
requires_multi_turn: false
business_risk: "medium" (legal domain)
single_model_sufficient: true
domain: "legal"
```

**Scoring (top 3):**

| Model | reasoning | structured | instruction | factuality | long_ctx | ... | **Total** |
|---|---|---|---|---|---|---|---|
| Claude 3.5 Sonnet | 9.0→0.54 | 9.5→0.95 | 9.5→0.95 | 9.0→0.81 | 8.5→0.68 | ... | **94.2** |
| GPT-4o | 8.5→0.51 | 8.5→0.85 | 9.0→0.90 | 8.5→0.77 | 7.0→0.56 | ... | **89.1** |
| Gemini 1.5 Pro | 8.0→0.48 | 7.5→0.75 | 8.0→0.80 | 8.0→0.72 | 9.5→0.76 | ... | **85.7** |

**Output:**
```
Top recommendation: Claude 3.5 Sonnet (94/100, confidence: 87%)
Reasoning:
  → Best-in-class structured output reliability (9.5/10)
  → Excellent instruction following for complex JSON schemas (9.5/10)
  → Strong factuality in legal/analytical contexts (9.0/10)
  → 200K context window handles long contracts
Warnings:
  → Higher cost than GPT-4o-mini if the contract is short
  → Slower than alternatives for simple extractions

Budget alternative: GPT-4o-mini (72/100)
  → 90% cheaper, adequate for shorter/simpler contracts
  → Risk: may miss nuanced legal language in complex clauses
```

### Upgrade Hooks in the Engine

The recommendation engine is designed to evolve:

| Current (Free/v1) | Future (Paid/v2+) |
|---|---|
| Rule-based classification | ML classifier (fine-tuned on user prompt data) |
| Static requirement templates | Learned requirement profiles from execution feedback |
| Manual capability scores | Auto-updated from benchmark scraping + A/B testing |
| No execution feedback | Feedback loop: "Was this recommendation helpful?" + actual output quality comparison |
| Single-prompt analysis | Multi-prompt workflow detection and chain recommendation |

---

## 15. Data Model / Schema

### PostgreSQL Schema

```sql
-- Core model data
CREATE TABLE models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) UNIQUE NOT NULL,      -- "claude-3-5-sonnet"
    display_name    VARCHAR(200) NOT NULL,              -- "Claude 3.5 Sonnet"
    provider_id     UUID REFERENCES providers(id),
    family          VARCHAR(100),                       -- "Claude 3.x"
    tier            VARCHAR(20) NOT NULL,               -- frontier | mid | budget | specialized
    is_active       BOOLEAN DEFAULT true,
    is_deprecated   BOOLEAN DEFAULT false,
    release_date    DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Provider registry
CREATE TABLE providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(50) UNIQUE NOT NULL,         -- "anthropic"
    display_name    VARCHAR(100) NOT NULL,                -- "Anthropic"
    website_url     VARCHAR(500),
    api_base_url    VARCHAR(500),                         -- for paid execution later
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Model specifications (hard facts)
CREATE TABLE model_specs (
    model_id                UUID PRIMARY KEY REFERENCES models(id),
    context_window          INTEGER NOT NULL,             -- 200000
    max_output_tokens       INTEGER,
    input_price_per_1m      DECIMAL(10,4),                -- 3.0000
    output_price_per_1m     DECIMAL(10,4),                -- 15.0000
    supports_vision         BOOLEAN DEFAULT false,
    supports_audio          BOOLEAN DEFAULT false,
    supports_video          BOOLEAN DEFAULT false,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_json_mode      BOOLEAN DEFAULT false,
    supports_streaming      BOOLEAN DEFAULT true,
    knowledge_cutoff        VARCHAR(20),                  -- "2024-04"
    api_identifier          JSONB,                        -- {"anthropic": "claude-3-5-sonnet-20241022"}
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Capability scores (our evaluated scores)
CREATE TABLE model_capabilities (
    model_id                    UUID PRIMARY KEY REFERENCES models(id),
    reasoning_ability           DECIMAL(3,1) NOT NULL,    -- 9.0
    coding_ability              DECIMAL(3,1) NOT NULL,
    long_context_quality        DECIMAL(3,1) NOT NULL,
    structured_output_reliability DECIMAL(3,1) NOT NULL,
    multimodal_understanding    DECIMAL(3,1) NOT NULL,
    speed                       DECIMAL(3,1) NOT NULL,
    cost_efficiency             DECIMAL(3,1) NOT NULL,
    creativity                  DECIMAL(3,1) NOT NULL,
    factuality                  DECIMAL(3,1) NOT NULL,
    instruction_following       DECIMAL(3,1) NOT NULL,
    tool_use_quality            DECIMAL(3,1) NOT NULL,
    safety_enterprise           DECIMAL(3,1) NOT NULL,
    conversational_quality      DECIMAL(3,1) NOT NULL,
    updated_at                  TIMESTAMPTZ DEFAULT now()
);

-- Qualitative model intelligence
CREATE TABLE model_intelligence (
    model_id            UUID PRIMARY KEY REFERENCES models(id),
    best_use_cases      JSONB NOT NULL,           -- ["Complex code gen", ...]
    worst_use_cases     JSONB NOT NULL,
    known_strengths     JSONB NOT NULL,
    known_weaknesses    JSONB NOT NULL,
    edge_case_notes     JSONB,
    provider_notes      TEXT,
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Benchmark data
CREATE TABLE model_benchmarks (
    model_id            UUID PRIMARY KEY REFERENCES models(id),
    mmlu_score          DECIMAL(5,2),
    humaneval_score     DECIMAL(5,2),
    arena_elo           INTEGER,
    gsm8k_score         DECIMAL(5,2),
    custom_benchmarks   JSONB,                    -- flexible for new benchmarks
    benchmark_notes     TEXT,
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Research metadata
CREATE TABLE model_research_meta (
    model_id                UUID PRIMARY KEY REFERENCES models(id),
    last_evaluated_date     DATE NOT NULL,
    evaluation_method       VARCHAR(200),
    source_confidence       DECIMAL(3,2) NOT NULL,   -- 0.00-1.00
    sources                 JSONB NOT NULL,           -- ["Anthropic model card", ...]
    needs_re_evaluation     BOOLEAN DEFAULT false,
    next_evaluation_due     DATE,
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Task taxonomy
CREATE TABLE task_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                VARCHAR(50) UNIQUE NOT NULL,     -- "code_generation"
    parent_slug         VARCHAR(50),                     -- "coding"
    display_name        VARCHAR(100) NOT NULL,
    description         TEXT,
    base_requirements   JSONB NOT NULL,                  -- requirement template vector
    classification_signals JSONB NOT NULL,               -- keywords/patterns
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Users (optional for free, required for paid)
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE,
    display_name        VARCHAR(100),
    tier                VARCHAR(20) DEFAULT 'free',      -- free | pro | team | enterprise
    team_id             UUID REFERENCES teams(id),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Teams (Team+)
CREATE TABLE teams (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(100) UNIQUE NOT NULL,
    owner_id            UUID REFERENCES users(id),
    tier                VARCHAR(20) DEFAULT 'team',
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- API key vault (Pro+, encrypted)
CREATE TABLE user_api_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    provider_id         UUID NOT NULL REFERENCES providers(id),
    encrypted_key       BYTEA NOT NULL,                   -- AES-256 encrypted
    key_nickname        VARCHAR(100),
    is_active           BOOLEAN DEFAULT true,
    last_used_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Analysis history
CREATE TABLE analyses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id),        -- null for anonymous
    session_id          VARCHAR(100),                      -- anonymous session tracking
    prompt_hash         VARCHAR(64) NOT NULL,              -- SHA-256 of prompt (privacy)
    prompt_preview      VARCHAR(200),                      -- first 200 chars (user-consented)
    task_primary        VARCHAR(50) NOT NULL,
    task_secondary      VARCHAR(50),
    task_confidence     DECIMAL(3,2),
    requirement_vector  JSONB NOT NULL,
    prompt_context      JSONB NOT NULL,
    top_model_id        UUID REFERENCES models(id),
    top_score           DECIMAL(5,1),
    confidence          DECIMAL(5,1),
    full_results        JSONB NOT NULL,                   -- serialized AnalysisResult
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Execution log (Pro+)
CREATE TABLE executions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID REFERENCES analyses(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    model_id            UUID NOT NULL REFERENCES models(id),
    input_tokens        INTEGER,
    output_tokens       INTEGER,
    latency_ms          INTEGER,
    estimated_cost      DECIMAL(10,6),
    status              VARCHAR(20) NOT NULL,             -- success | error | timeout
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Feedback (for learning loop)
CREATE TABLE recommendation_feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID NOT NULL REFERENCES analyses(id),
    user_id             UUID REFERENCES users(id),
    feedback_type       VARCHAR(20) NOT NULL,             -- helpful | not_helpful | wrong_model
    suggested_model_id  UUID REFERENCES models(id),       -- if user thinks another model was better
    comment             TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_analyses_user ON analyses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analyses_task ON analyses(task_primary);
CREATE INDEX idx_analyses_created ON analyses(created_at);
CREATE INDEX idx_models_active ON models(is_active) WHERE is_active = true;
CREATE INDEX idx_executions_user ON executions(user_id);
CREATE INDEX idx_executions_model ON executions(model_id);
```

---

## 16. Differentiation vs Existing Platforms

| Competitor | What They Do | How ModelPilot Is Different |
|---|---|---|
| **OpenRouter** | Multi-provider gateway; routes by user selection | No intelligence layer. User must know which model to pick. ModelPilot tells them. |
| **LMSYS Chatbot Arena** | Crowdsourced model comparison via blind voting | Aggregate rankings, not task-specific. Doesn't analyze your prompt. |
| **Hugging Face** | Model hub with cards and benchmarks | Directory, not a recommendation engine. No prompt analysis. |
| **TypingMind / Poe** | Chat UI that supports multiple models | UI wrapper, not an advisor. No recommendation logic. |
| **Artificial Analysis** | Benchmark comparison dashboards | Static comparisons, no prompt-level intelligence. |
| **Portkey / LiteLLM** | Developer routing SDKs | Infrastructure, not user-facing. No recommendation engine. Technical users only. |
| **Perplexity** | AI search engine | Uses one model. Doesn't help you choose. |

**ModelPilot's unique position:** The only product that takes your actual prompt, understands what it needs, and recommends the specific model that will produce the best result — with full transparency on why.

**The moat:**
1. Structured, continuously-updated model knowledge base (labor-intensive to replicate)
2. Task-specific scoring methodology (not generic benchmarks)
3. User prompt data (aggregate patterns reveal which tasks go to which models)
4. Trust and habit (once users rely on it, switching cost is high)
5. Execution layer network effects (more users → more feedback → better recommendations → more users)

---

## 17. Monetization Strategy

### Revenue Model

| Stream | Tier | Pricing | Notes |
|---|---|---|---|
| Recommendation engine | Free | $0 | User acquisition + trust building |
| Pro subscription | Pro | $29/mo | Power users who want execution |
| Team subscription | Team | $79/seat/mo | Teams standardizing on AI usage |
| Enterprise | Enterprise | Custom ($500+/mo) | Large orgs, compliance needs |
| API access | Team+ | Usage-based ($0.001/analysis) | Developers embedding routing logic |
| Affiliate/referral | Free | Commission | Link to model provider sign-up pages |

### Unit Economics Target

- **Free user cost:** ~$0.02/analysis (server compute, no API calls)
- **Pro conversion rate target:** 3–5% of active free users
- **Pro LTV target:** $29 × 12 months avg = $348
- **CAC target:** < $50 (organic + content-driven)

### Revenue Milestones

| Milestone | Users | Revenue |
|---|---|---|
| Month 3 | 5,000 free, 50 Pro | ~$1,500 MRR |
| Month 6 | 25,000 free, 300 Pro | ~$9,000 MRR |
| Month 12 | 100,000 free, 1,500 Pro, 10 Team | ~$52,000 MRR |
| Month 18 | 300,000 free, 5,000 Pro, 50 Team, 5 Enterprise | ~$200,000+ MRR |

---

## 18. Technical Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    Next.js 14+ (App Router)                       │
│                                                                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Homepage  │  │  Analyze  │  │  Models  │  │  Dashboard    │   │
│  │           │  │  Results  │  │  Compare │  │  (Pro+)       │   │
│  └──────────┘  └───────────┘  └──────────┘  └───────────────┘   │
│                                                                   │
│  Styling: Tailwind CSS + shadcn/ui                                │
│  State: React Query (TanStack Query) + Zustand                    │
│  Charts: Recharts (radar charts, bar charts)                      │
│  Auth: NextAuth.js / Clerk                                        │
│                                                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY                                  │
│                 Next.js API Routes / tRPC                         │
│                                                                   │
│  Rate limiting: Upstash Redis                                     │
│  Auth: JWT tokens (for logged-in users)                           │
│  Anonymous: Session-based (cookie)                                │
│                                                                   │
└───────────┬───────────────────────────────┬─────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐     ┌──────────────────────────────────┐
│   ANALYSIS ENGINE     │     │      MODEL KNOWLEDGE BASE        │
│   (Python / FastAPI)  │     │      (PostgreSQL)                │
│                       │     │                                   │
│  Prompt Classifier    │     │  models, capabilities, specs,     │
│  Requirement Builder  │     │  benchmarks, intelligence,        │
│  Scoring Engine       │     │  research metadata                │
│  Ranking + Explain    │     │                                   │
│                       │     │  Cached in Redis for fast reads   │
│  Deployed as:         │     │                                   │
│  - Microservice       │     └──────────────────────────────────┘
│  - or Edge function   │
│  - or embedded in     │
│    Next.js via Python │
│    worker             │
└───────────┬───────────┘
            │
            ▼ (Paid version only)
┌───────────────────────────────────────────────────────────────┐
│                    EXECUTION ENGINE                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ Key Vault    │  │ Provider     │  │ Response           │    │
│  │ (encrypted)  │  │ Adapters     │  │ Streamer           │    │
│  │              │  │ OpenAI       │  │                     │    │
│  │ Per-user     │  │ Anthropic    │  │ Handles streaming   │    │
│  │ AES-256      │  │ Google       │  │ back to client      │    │
│  │              │  │ Mistral      │  │                     │    │
│  │              │  │ Cohere       │  │                     │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
│                                                                 │
│  Usage Tracker → executions table                               │
│  Cost Calculator → real-time token counting                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | **Next.js 14+ (App Router)** | SSR for SEO (model pages, guides), React ecosystem, Vercel deployment |
| Styling | **Tailwind CSS + shadcn/ui** | Rapid iteration, consistent design system, dark mode built-in |
| UI components | **shadcn/ui + Radix primitives** | Accessible, composable, owns the code |
| Charts | **Recharts** | Radar charts for capability comparison, lightweight |
| Frontend state | **TanStack Query + Zustand** | Server state (Query) + client state (Zustand), minimal boilerplate |
| API layer | **tRPC** (or Next.js API routes) | End-to-end type safety between frontend and backend |
| Analysis engine | **Python (FastAPI)** | Best NLP ecosystem, easy to add ML classifiers later |
| Database | **PostgreSQL (Supabase or Neon)** | Structured data, JSONB for flexible fields, proven at scale |
| Cache | **Redis (Upstash)** | Model data caching, rate limiting, session storage |
| Auth | **Clerk** | Fast to implement, supports free + paid tiers, team management |
| Payments | **Stripe** | Standard for SaaS, supports subscriptions + usage-based |
| Hosting | **Vercel (frontend) + Railway/Render (Python service)** | Fast to deploy, auto-scaling, reasonable cost |
| Monitoring | **PostHog** (analytics) + **Sentry** (errors) | Product analytics + error tracking |
| Search | **Meilisearch** (model search) | Fast, typo-tolerant search for model directory |

### Why Split Frontend (Next.js) and Analysis Engine (Python)?

The analysis engine benefits from Python's NLP ecosystem (spaCy, scikit-learn, NLTK, transformers). At launch, the rules-based classifier is simple enough to embed anywhere, but the architecture should support upgrading to ML classifiers without rewriting the frontend. The Python service is a focused microservice with a clean API contract:

```
POST /api/analyze
Body: { "prompt": "..." }
Response: { AnalysisResult }

GET /api/models
Response: [ModelProfile]

GET /api/models/{slug}
Response: ModelProfile
```

### Performance Targets

| Metric | Target | How |
|---|---|---|
| Time to first recommendation | < 2 seconds | Redis-cached model data + lightweight classifier |
| Homepage load | < 1.5 seconds | Next.js SSR + edge caching |
| Model page load | < 1 second | Static generation with ISR (revalidate daily) |
| Analysis API p95 | < 500ms | No external API calls, all local computation |
| Uptime | 99.9% | Vercel + Railway redundancy |

---

## 19. Roadmap

### Phase 0: Foundation (Weeks 1–3)

| Task | Details |
|---|---|
| Set up Next.js project with Tailwind + shadcn/ui | Dark mode, responsive, component library |
| Set up PostgreSQL schema | All tables from Section 15 |
| Seed initial model data | 25–30 models, fully scored and documented |
| Build model profile pages | Static-generated, SEO-optimized |
| Build model comparison page | Side-by-side with radar chart |

**Deliverable:** A browsable model knowledge base with rich, structured profiles. Useful on its own. Generates SEO traffic.

### Phase 1: MVP — Recommendation Engine (Weeks 4–7)

| Task | Details |
|---|---|
| Build prompt input UX | Homepage hero input, example prompts |
| Implement task classifier (Python) | Rule-based, covers top 25 task categories |
| Implement requirement vector builder | Templates + prompt-level adjustments |
| Implement scoring engine | Weighted dimensional matching |
| Build results page | Top recommendation + backups + explanations |
| Build analysis API | POST /api/analyze → full AnalysisResult |
| Add local storage history | Last 10 analyses, no login required |
| Implement basic analytics | PostHog events for prompt analysis, model clicks |

**Deliverable:** The core free product. Users can paste a prompt and get intelligent recommendations. Ship this and start getting users.

### Phase 2: Polish + Growth (Weeks 8–11)

| Task | Details |
|---|---|
| Add user accounts (Clerk) | Optional sign-up, persistent history |
| Add feedback mechanism | "Was this helpful?" on results page |
| Build "Best model for X" guide pages | 10–15 evergreen guides (coding, writing, analysis, etc.) |
| Add model change log | Public page showing when scores were updated |
| SEO optimization | Meta tags, structured data, OG images |
| Performance optimization | Edge caching, ISR, CDN |
| Launch on Product Hunt, Hacker News | With polished landing page |

**Deliverable:** Growth-ready product with content marketing, feedback loop, and SEO foundation.

### Phase 3: Pro Tier — Execution (Weeks 12–18)

| Task | Details |
|---|---|
| Implement API key vault | Per-user, encrypted storage |
| Build provider adapters | OpenAI, Anthropic, Google, Mistral |
| Build execution engine | Route prompt → provider → stream response |
| Add "Run on [Model]" button to results | One-click execution for Pro users |
| Build usage dashboard | Tokens used, costs, model distribution |
| Implement Stripe billing | Pro subscription ($29/mo) |
| Add cost calculator | Per-analysis cost estimate before execution |
| Build output comparison | Run on 2 models, compare side-by-side |

**Deliverable:** Revenue-generating Pro tier. Free users see execution CTAs; conversion begins.

### Phase 4: Team + Scale (Weeks 19–26)

| Task | Details |
|---|---|
| Team workspaces | Shared prompt library, usage dashboard |
| Routing policies | Admin-defined rules ("legal prompts → Claude only") |
| Auto-routing mode | System picks + executes automatically |
| Fallback chains | Define backup models if primary fails |
| API access for developers | Programmatic analysis + execution |
| Upgrade classifier to ML | Fine-tune on accumulated prompt data |
| Model knowledge auto-refresh | Scrape benchmarks, detect new releases |

**Deliverable:** Team product, developer platform, and intelligence improvements based on real data.

### Phase 5: Enterprise + Platform (Months 7–12)

| Task | Details |
|---|---|
| SSO / SAML | Enterprise auth |
| Audit logging | Full prompt and routing audit trail |
| Custom model profiles | Add proprietary/fine-tuned models |
| Evaluation workflows | Automated model testing for specific use cases |
| Multi-model chains | Sequential workflows (e.g., "draft with GPT-4o, refine with Claude") |
| On-prem option | Self-hosted deployment for regulated industries |
| Enterprise sales motion | Outbound, case studies, compliance docs |

---

## 20. Biggest Risks and How to Reduce Them

### Risk 1: Model Data Goes Stale Quickly

**Severity:** Critical
**Why:** The AI model landscape changes weekly. If our scores are outdated, users lose trust instantly.

**Mitigation:**
- Show "Last evaluated: X days ago" on every model profile and recommendation
- Automated freshness alerts: flag any model not re-evaluated in 30 days
- Semi-automated benchmark scraping pipeline (Phase 4)
- Community contribution system: let power users flag outdated scores
- Dedicate 20% of engineering time to research maintenance
- Start with a manageable number of models (25–30) rather than trying to cover everything

### Risk 2: Recommendations Feel Generic or Wrong

**Severity:** Critical
**Why:** If the top recommendation is obviously wrong even once, users won't come back.

**Mitigation:**
- Show confidence scores — when the system isn't sure, say so
- Provide explanations for every recommendation — transparency builds trust even when wrong
- "Why not [Model X]?" section preempts user objections
- Feedback mechanism ("Was this helpful?") catches errors quickly
- Curate 50+ test prompts across all task categories; manually verify recommendations before launch
- Start with clear-cut task categories (coding, extraction, writing) where model differences are stark; avoid ambiguous tasks initially

### Risk 3: Free Version Isn't Valuable Enough to Create Habit

**Severity:** High
**Why:** If users try it once and forget, there's no conversion funnel.

**Mitigation:**
- Make the analysis feel genuinely insightful — task breakdown, dimensional scoring, tradeoff visualization
- Build model profile pages as a standalone resource (SEO + direct traffic)
- "Best model for X" guides create recurring traffic
- Email digest for users with accounts: "New model released — here's how it compares for your common tasks"
- History feature encourages return visits

### Risk 4: Prompt Classification Without an LLM Is Too Crude

**Severity:** Medium-High
**Why:** Rule-based classifiers will fail on ambiguous or complex prompts.

**Mitigation:**
- Accept graceful degradation: show lower confidence score when uncertain
- Support compound classifications: "This prompt is 60% code generation, 40% data extraction"
- Design the UI to let users correct the classification ("Not quite? Tell us what this prompt is for →")
- Plan for ML upgrade in Phase 4 (accumulate labeled data from user corrections)
- Consider running a small, self-hosted classifier model (DistilBERT-level) as a Phase 2 enhancement — technically not an external API call

### Risk 5: Low Conversion from Free to Paid

**Severity:** Medium
**Why:** If the free version is too good, users may not see the value in paying.

**Mitigation:**
- The free version is the intelligence (what to use). The paid version is the convenience (just do it for me). These are fundamentally different values.
- Conversion hooks are embedded at natural decision points, not paywalled artificially
- The value of execution increases with frequency — occasional users stay free, power users pay
- Track conversion funnel meticulously from day one
- Experiment with usage-based pricing if flat subscription doesn't convert

### Risk 6: Building Too Much Before Finding Product-Market Fit

**Severity:** Medium
**Why:** Classic startup over-engineering risk.

**Mitigation:**
- Ship Phase 1 MVP in 7 weeks, get real users
- Do not build execution engine (Phase 3) until free version has at least 1,000 active users
- Validate demand for paid features through surveys and waiting list before building them
- Use the roadmap above as a guide, not a contract — adapt based on user feedback

---

## 21. Final Recommendation on How to Build This Correctly

### The Right Sequence

1. **Build the knowledge base first.** Spend the first 2–3 weeks doing deep research on 25–30 models. Populate every field in the schema. This is the foundation everything else stands on. If the model data is thin, everything downstream is useless.

2. **Ship model profiles as a standalone product.** Before you even build the recommendation engine, publish beautifully-designed model profile pages. This is immediately useful, generates SEO traffic, and validates that your research is valued.

3. **Add the recommendation engine as the main attraction.** The prompt input + analysis + recommendation flow is the core product. Ship it as soon as the classifier covers the top 10 task categories reliably. It doesn't need to be perfect — it needs to be better than "I'll just use ChatGPT."

4. **Measure, don't assume.** Track: analyses per user, return rate, feedback scores, model click-throughs. These metrics tell you if the product is working before you build the paid tier.

5. **Build execution only when trust is established.** The paid tier only converts if users trust the recommendations. Don't rush to build execution infrastructure before the free product has earned that trust.

6. **Invest in research as a core function, not an afterthought.** Hire or dedicate a role for model research/evaluation. This is the product's moat. It's not engineering work — it's domain expertise work.

### The Right Team (Minimum Viable)

| Role | Responsibility |
|---|---|
| Full-stack engineer (founder) | Next.js frontend, API, deployment, infrastructure |
| AI/ML engineer (or the same person) | Classification engine, scoring logic, Python service |
| Model researcher (part-time / contractor) | Evaluate models, maintain scores, write qualitative intelligence |
| Designer (contract or template-based) | UI polish, UX flow, brand identity |

### The Right Launch

- **Week 7:** Ship MVP to Hacker News, Product Hunt, Twitter/X
- **Positioning:** "Paste any prompt. We'll tell you the best AI model for it — and why."
- **Hook:** The example analysis on the homepage must be so good that people immediately want to try their own prompt
- **Distribution:** AI Twitter, developer communities, Reddit (r/LocalLLaMA, r/ChatGPT, r/artificial), AI newsletters
- **Content:** "Best AI model for [task]" blog posts drive long-tail SEO

---

## A) Best Product Positioning Statement

> **ModelPilot is the AI model recommendation engine. Paste any prompt, and we'll analyze what it needs, match it against 50+ models, and tell you exactly which one will give you the best result — with full transparency on why. Free to use. No API keys required.**

## B) Best Free-to-Paid Conversion Strategy

**The "You're already here" strategy:**

The free version gets users to the point of decision: "Claude 3.5 Sonnet is the best model for this prompt." The user now has to leave ModelPilot, go to the Anthropic console, paste their prompt, and run it. That friction is the conversion opportunity.

The paid version collapses that friction: **"Run it right here. One click."**

This is not an artificial gate. It's a real convenience gap. The more prompts a user analyzes, the more friction they feel switching to another tool to execute. The upgrade sells itself.

**Specific tactics:**
- Show "Run on [Model] →" button on every recommendation (grayed for free, active for Pro)
- After 5 analyses, show: "You've analyzed 5 prompts this week. Pro users can run them all from here."
- After user copies a recommendation: "Heading to [Provider]? Run it here instead — connect your key in 30 seconds."
- Email for registered free users: "You analyzed 12 prompts this month. The most popular one was [category]. Here's what Pro users are doing with that."

## C) The Single Best Wedge to Launch With First

**"Best AI model for coding prompts."**

Why coding specifically:
1. Developers are the highest-intent early adopters for AI model selection
2. Model differences are most stark and measurable for code tasks (test pass rates, benchmark gaps)
3. Developers will share a useful tool on Twitter, HN, Reddit — viral distribution
4. Code-related prompts have the clearest classification signals (language names, "function", "debug", etc.)
5. The developer audience converts to paid at higher rates (they have API keys already)

Launch with 15 models scored specifically for coding tasks. Expand to all task types within 4 weeks. But launch day, own one use case completely.

## D) The Biggest Mistake to Avoid

**Do not try to be a model execution platform before you have earned trust as a recommendation engine.**

The temptation will be to rush to the paid tier because that's where revenue is. Resist it. If you launch execution before the recommendations are excellent and trusted, you're just another AI gateway — competing with OpenRouter, TypingMind, and every ChatGPT wrapper. You lose.

The recommendation engine IS the moat. It's what makes the execution platform worth paying for. It's what makes users choose ModelPilot over going directly to a provider. Build the brain first. Then build the body.

**The second biggest mistake:** Trying to score 100 models at launch instead of scoring 25 models excellently. Depth of research beats breadth. A user who sees a model profile with real weaknesses, edge cases, and nuanced scoring trusts you. A user who sees 100 models with suspiciously round numbers does not.

---

*This blueprint is a living document. Update it as you learn from users, validate assumptions, and adapt the roadmap.*
