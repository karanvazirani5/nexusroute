# NexusRoute — AI Model Advisor

Stop guessing which AI to use. NexusRoute analyzes any prompt and tells you
the best model to use — with full reasoning, alternates, and uncertainty
reporting — across 24+ frontier LLMs from 8 providers.

**No account. No API keys. No execution. Just advice.**

```
Your prompt
   │
   ▼
Interpretation ──► Hard eligibility ──► Multi-track scoring ──► Recommendation
   (structural +        (vision / audio /      (quality / value /
    optional LLM)        long context …)        latency / open)
```

**Stack:** FastAPI (read-only model registry) · SQLAlchemy · SQLite · Next.js 16 · React 19 · Tailwind 4 · shadcn/ui.

---

## What it does

### `/advisor` — the core
Describe any task and get:
- **Task classification** into 24 categories with confidence
- **Eligibility gating** against hard requirements (vision, audio, long
  context, real-time, web search, tool use, privacy/self-hosted)
- **Pareto multi-track scoring** — separate winners for quality, value,
  low-latency, and open/self-hosted
- **Uncertainty reporting** — interpretation confidence, ranking stability,
  top-score gap, marginal-winner warnings
- **Explanation** — why the winner won, why others lost, when to switch

### `/models` — the registry
24 frontier models across OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek,
Meta, Alibaba. Capability radar charts, benchmarks, pricing, and research
notes per model. Filter by tier, provider, or capability.

### `/compare` — head-to-head
Pick any two or three models and see them side-by-side — capabilities,
context window, cost, latency, enterprise readiness.

### Routing intelligence
- **7 scoring dimensions**: quality_fit, cost_efficiency, speed,
  reliability, format_support, reasoning_fit, capability_match
- **10 optimization presets**: balanced, quality, speed, cost, reasoning,
  coding, agentic, multimodal, enterprise, budget
- **Hard eligibility gates** on capabilities before scoring
- **Multi-track winners** across quality / value / latency / open
- **12-case regression eval** built into `src/test-engine.ts`

---

## Quick start

### Prerequisites
- Python 3.9+
- Node.js 18+

### 1. Backend (only needed for the /models registry page)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API lives at `http://localhost:8000`, docs at `/docs`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The advisor works immediately — no
configuration, no keys, no sign-up.

### 3. Docker
```bash
docker-compose up --build
```

---

## How the advisor runs with zero keys

The entire recommendation pipeline — interpretation, eligibility filtering,
scoring, Pareto selection — runs in the browser over a local model registry
(`frontend/src/lib/data/models.ts`). The backend is a thin read-only service
that ships the same registry to the `/models` explorer page.

If you set `OPENAI_API_KEY` in `frontend/.env.local`, the
`/api/advisor/interpret` route will use GPT-4o-mini to produce a richer prompt
interpretation. This is **strictly optional** — without a key, the advisor
falls back to the local structural interpreter and still passes every
assertion in the regression eval.

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Basic health check |
| `GET` | `/api/models` | List the active model registry |
| `GET` | `/api/models/{id}` | Get one model |
| `GET` | `/api/models/providers` | Provider → count map |
| `GET` | `/api/models/best-for/{task}` | Top 5 models for a task description |
| `GET` | `/api/models/stale` | Models marked stale/outdated |
| `GET` | `/api/models/deprecated` | Models marked deprecated |
| `PUT` | `/api/models/{id}` | Update model metadata / enable flag |

There are **no** chat, execution, streaming, history, analytics, auth, or
billing endpoints. This is a recommendation engine, not a provider reseller.

---

## Project structure
```
backend/
  app/
    main.py                    # FastAPI app + model seeding (no chat routes)
    config.py                  # Pydantic settings
    api/routes/
      health.py                # /api/health
      models.py                # /api/models CRUD
    core/
      classifier.py            # prompt → TaskProfile (used by /best-for)
      router.py                # TaskProfile → RoutingDecision
      scoring.py               # 7-dimensional scoring with 10 presets
      explainer.py             # Human-readable routing explanations
    models/
      database.py              # Single SQLAlchemy table: models
      schemas.py               # Pydantic types
    data/model_registry.json   # 24 seed models across 8 providers

frontend/
  src/
    app/
      page.tsx                 # Landing with inline live demo
      advisor/page.tsx         # Full recommendation dashboard
      models/page.tsx          # Registry grid
      models/[id]/page.tsx     # Model detail + radar chart
      compare/page.tsx         # Head-to-head comparison
      api/advisor/interpret/   # Optional LLM-backed interpreter (keyless fallback)
    lib/
      api.ts                   # Minimal backend client
      data/models.ts           # Browser-side model registry
      engine/
        interpret.ts           # Prompt → DemandTensor + HardConstraints
        eligibility.ts         # Hard-requirement gating
        scoring.ts             # Per-model alignment profile
        optimize-tracks.ts     # Pareto multi-track selection
        analyzer.ts            # Orchestrator
        eval.ts                # Regression eval suite (12 cases)
      types.ts                 # Shared TypeScript types
    components/ui/             # shadcn/ui wrappers
```

---

## Changelog

### v3.1 — Intent Panel instrumentation layer
- Added a privacy-safe instrumentation layer that turns the free advisor
  into a labeled research panel without breaking the advisor-only promise
  (no execution, no keys required).
- New backend modules:
  - `backend/app/core/taxonomy.py` — versioned multi-axis taxonomy (16
    primary categories, ~60 subcategories, 8 orthogonal axes).
  - `backend/app/core/redaction.py` — synchronous PII redaction pipeline
    (emails, phones, SSNs, credit cards, API keys, JWTs, bearer tokens,
    URLs, name cues) with prompt hashing for de-duplication.
  - `backend/app/core/intent_classifier.py` — Tier 1 heuristic classifier,
    zero-cost, runs on every event in the hot path.
  - `backend/app/core/haiku_classifier.py` — Tier 2 batched Haiku
    classifier (async, ~$0.0002/event, strict taxonomy validation). No-op
    when `ANTHROPIC_API_KEY` is unset.
  - `backend/app/core/events_service.py` — event capture + outcome update
    service.
  - `backend/scripts/enrich_events.py` — Tier 2 enrichment worker.
- New tables: `panel_users`, `panel_sessions`, `panel_consents`,
  `prompt_events`, `gold_prompts`.
- New routes (all under `/api/panel/*`):
  - `POST /panel/sessions` — open an anonymous session.
  - `POST /panel/consents`, `DELETE /panel/consents/{user_id}` — tiered
    consent ledger (0 = essential, 1 = research, 2 = licensing).
  - `POST /panel/events` — capture an event with synchronous redaction +
    Tier 1 classification.
  - `PATCH /panel/events/{event_id}` — update outcome signals
    (selected_model, copied, overrode, rating, abandoned).
  - `GET /panel/insights/dashboard` — router health, category share,
    model leaderboard, top subcategories.
  - `GET /panel/insights/router-health`, `GET /panel/insights/categories`
  - `POST /panel/gold`, `GET /panel/gold`, `GET /panel/gold/regression`
    — hand-labeled gold set + classifier regression test runner.
- New frontend surfaces:
  - `frontend/src/lib/telemetry.ts` — fire-and-forget panel client,
    consent-gated, never blocks the advisor.
  - `frontend/src/components/ConsentBanner.tsx` — one-time Tier 0/1
    chooser that honours the zero-key fallback.
  - `/dashboard` — internal panel dashboard (router accuracy, override
    rate, category share, model leaderboard by category).
  - `/methodology` — full public methodology (taxonomy, classifier
    pipeline, calibration, sample sizes, versioning, reproducibility).
  - `/privacy` — per-tier consent controls and a "forget me" revoke
    button that hits `DELETE /panel/consents/{user_id}`.
- Advisor page now captures an event after every analysis and records
  outcome signals on copy / override (with a reason chip row).
- Optional dependency: `anthropic>=0.40.0` in `requirements.txt` for Tier
  2 enrichment. Everything downstream still works if the SDK or API key
  is absent — the panel just runs on Tier 1 labels.

### v3.0 — Advisor-only
- **Removed everything that required API keys or implied a paid tier.** The
  product is now a single-purpose recommendation engine. No execution, no
  streaming, no BYOK, no history / analytics, no settings, no pricing, no
  paid tier, no keys of any kind.
- Deleted frontend pages: `/router`, `/templates`, `/playground`,
  `/history`, `/analytics`, `/settings`, `/pricing`.
- Deleted backend routes: `/api/chat`, `/api/chat/stream`, `/api/history`,
  `/api/analytics`, `/api/feedback`, `/api/health/providers`,
  `/api/health/test-key`.
- Deleted backend modules: `core/executor.py`, `core/cache.py`,
  `services/feedback.py`, `api/routes/chat.py`, `api/routes/history.py`.
- Dropped `litellm`, `alembic`, and `httpx` from `requirements.txt`.
- Database schema trimmed to the single `models` table.
- Rate-limit middleware removed (no chat endpoint to protect).
- Nav is now **Advisor / Models / Compare**. That's it.

### v2.1 — Streaming + compare (superseded by v3.0)
### v2.0 — BYOK + pricing (superseded by v3.0)

---

## License
MIT — do what you want, at your own risk.
