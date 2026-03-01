# Intelligence Module

Revenue Intelligence Agent for Polar/Spaire. Answers natural language questions
about merchant revenue using a two-stage AI pipeline backed by deterministic
Python computations.

## Architecture

### Two-stage pipeline (`agent.py`)

```
User question
      │
      ▼
┌──────────────┐     pydantic-ai Agent
│  Stage A     │  ─────────────────────►  QueryPlan
│  Planner     │     (structured output,
└──────────────┘      no tools, ~5s)
      │
      │  QueryPlan: intent, metrics, time windows, interpretation note
      ▼
┌──────────────┐     service.py + repository.py
│  Python      │  ─────────────────────►  MetricWindow, DimensionBreakdown,
│  Computation │                           ChurnSummary, anomalies, deltas
└──────────────┘
      │
      │  All numbers computed in Python (no LLM arithmetic)
      ▼
┌──────────────┐     pydantic-ai Agent
│  Stage B     │  ─────────────────────►  InsightResponse
│  Synthesizer │     (structured output,   (narrative only — numbers injected)
└──────────────┘      ~15s)
```

**Key invariant:** The LLM never does math. `InsightDriver.delta`, `pct_change`,
and `share_of_total_change` are computed in Python and injected into the response
after Stage B runs, replacing any LLM-generated values.

### File map

| File | Responsibility |
|---|---|
| `auth.py` | Authenticator using `metrics_read` + `web_read/write` scopes |
| `schemas.py` | Pydantic models: `IntelligenceQueryRequest`, `QueryPlan` (internal), `InsightDriver`, `InsightAction`, `InsightDebug`, `InsightResponse` |
| `repository.py` | All SQLAlchemy queries — product revenue by period, cancellation breakdown. Auth-scoped via `_apply_org_filter()` |
| `service.py` | Computation layer — calls metrics service + repository, computes breakdowns, z-score anomaly detection, period deltas |
| `agent.py` | Two pydantic-ai agents, orchestration, error/timeout handling |
| `endpoints.py` | `POST /v1/intelligence/query` (tagged `private`) |
| `tasks.py` | `intelligence.weekly_digest` Dramatiq actor |

## API

### `POST /v1/intelligence/query`

**Auth:** `metrics:read` scope (web session or org access token).

**Request body:**
```json
{
  "question": "Why did revenue drop last week?",
  "organization_id": "uuid",
  "start_date": null,
  "end_date": null,
  "timezone": "America/New_York"
}
```

- `start_date` / `end_date` are optional. If omitted, Stage A infers them from
  the question. If provided, they override Stage A's inference.
- Maximum date range: 365 days (validated in `IntelligenceQueryRequest`).

**Response:** `InsightResponse` — see `schemas.py` for full type.

Key fields:
- `answer` — one-sentence summary with numbers
- `confidence` — `high | medium | low`
- `summary_bullets` — 3–5 key findings
- `drivers` — ranked product/dimension contributors (computed in Python)
- `recommended_actions` — concrete next steps with effort + approval flag
- `followup_questions` — suggested next questions
- `debug` — time ranges, queries run, model used, warnings

## Adding a new metric/dimension

1. Add the metric slug to `_ALLOWED_METRICS` in `agent.py`.
2. If it needs a new DB query, add a method to `IntelligenceRepository`
   (use `_apply_org_filter()` for auth scoping).
3. Add a service method in `IntelligenceService` to fetch + compute.
4. Add the fetch to the `fetch_tasks` dict in `run_intelligence_query()`.
5. Inject the computed value into the Stage B prompt context.

## Security notes

- **Rate limiting:** The endpoint has no built-in rate limiting. Add at the
  reverse-proxy level or via a FastAPI middleware before enabling for all users.
- **Prompt injection:** User questions are embedded in LLM prompts. Validated
  for length (3–1000 chars) but not for content. Consider a content filter for
  production.
- **Date range cap:** Enforced at 365 days in `IntelligenceQueryRequest` to
  prevent expensive queries.
- **Auth:** All repository queries are scoped to the authenticated org/user via
  `_apply_org_filter()`. Cross-tenant data access is not possible through the
  standard auth flow.
- **Debug exposure:** `InsightDebug` is returned to the client. In production,
  consider omitting `queries_executed` and `model_used`.

## Environment

Requires `OPENAI_API_KEY` and `OPENAI_MODEL` in `server/.env` (already used by
the organization AI validation module).

## Frontend

Located at:
```
clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/intelligence/
├── page.tsx            # Server component: resolves organization from slug
└── IntelligencePage.tsx  # Client component: chat UI
```

Hook: `clients/apps/web/src/hooks/queries/intelligence.ts`

The UI is a chat interface (similar to Claude/ChatGPT):
- Message history scrolls up
- User messages right-aligned
- Assistant responses left-aligned with structured insight (drivers table,
  actions list, followup chips, provenance accordion)
- Composer pinned to bottom with Enter-to-send
- Empty state shows 4 starter prompt cards
