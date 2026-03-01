"""
Two-stage Intelligence Agent:

Stage A — Query Planner (deterministic-ish)
  Input : natural language question
  Output: QueryPlan (intent, metrics, time windows)

Stage B — Insight Synthesizer
  Input : question + QueryPlan + all computed data (as structured prompt context)
  Output: InsightResponse (narrative fields only — all numbers come from Python)

The LLM writes narrative; Python computes the numbers.
"""

import asyncio
import json
import uuid
from dataclasses import asdict
from datetime import date, timedelta

import structlog
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.auth.models import AuthSubject, User, Organization
from polar.config import settings
from polar.kit.time_queries import TimeInterval
from polar.postgres import AsyncReadSession

from .schemas import (
    InsightAction,
    InsightDebug,
    InsightDriver,
    InsightResponse,
    QueryPlan,
)
from .service import (
    ChurnSummary,
    DimensionBreakdown,
    IntelligenceService,
    MetricWindow,
    intelligence_service,
)

log = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Shared model
# ---------------------------------------------------------------------------

_ALLOWED_METRICS = {
    "revenue",
    "net_revenue",
    "orders",
    "new_subscriptions",
    "active_subscriptions",
    "canceled_subscriptions",
    "churn_rate",
    "monthly_recurring_revenue",
    "annual_recurring_revenue",
    "average_order_value",
    "checkout_conversion_rate",
}

TODAY = date.today()


def _make_model() -> OpenAIChatModel:
    provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
    return OpenAIChatModel(settings.OPENAI_MODEL, provider=provider)


# ---------------------------------------------------------------------------
# Stage A — Query Planner
# ---------------------------------------------------------------------------

_PLANNER_SYSTEM_PROMPT = f"""
You are a revenue analytics query planner for a SaaS payment platform.
Your job is to parse a merchant's natural language question into a structured
query plan.

Today's date is {TODAY.isoformat()}.

Rules:
1. Choose intent from: trend_explain | breakdown | compare | churn | top_items | forecast
2. Only select metrics from this approved list:
   {", ".join(sorted(_ALLOWED_METRICS))}
3. If the question implies "last week", use the 7 days before today (Mon–Sun or rolling).
4. Always set baseline_start_date / baseline_end_date to the equivalent prior period
   (e.g. if current = last 7 days, baseline = 7 days before that).
5. Choose granularity:
   - day   → windows up to 14 days
   - week  → windows 14–90 days
   - month → windows > 90 days
6. Write interpretation_note as: "I interpreted '[original phrase]' as [date range] UTC."
7. If the question is about churn, include canceled_subscriptions and churn_rate.
8. Never select more than 5 metrics.
"""

_planner_agent: Agent[None, QueryPlan] = Agent(
    _make_model(),
    output_type=QueryPlan,
    system_prompt=_PLANNER_SYSTEM_PROMPT,
)

# ---------------------------------------------------------------------------
# Stage B — Insight Synthesizer
# ---------------------------------------------------------------------------

_SYNTHESIZER_SYSTEM_PROMPT = """
You are a revenue intelligence analyst for a SaaS payment platform.
You receive pre-computed data (all numbers are exact, from a database).
Your job is to write the narrative fields of a structured InsightResponse.

Rules:
1. answer: one sentence with the key metric change and numbers. Be precise.
   Example: "Net revenue fell 8.4% week-over-week from $42,190 to $38,640."
2. confidence: high if data covers > 30 data points and all requested metrics returned;
   medium if some gaps; low if sparse data or < 7 data points.
3. confidence_reasons: 1–3 short bullets.
4. summary_bullets: exactly 3–5 bullets, each starting with a number or %.
5. drivers: use the pre-computed driver rows. Write zero drivers if the breakdown is empty.
   For each driver: description is a short sentence explaining the driver.
6. recommended_actions: 2–4 concrete actions. Be specific.
7. followup_questions: 3–4 natural follow-up questions the merchant might ask.
8. Do NOT hallucinate metrics or numbers. Only reference values from the provided data.
9. Currency is in cents in the data; format as dollars in narrative (divide by 100).
"""

_synthesizer_agent: Agent[None, InsightResponse] = Agent(
    _make_model(),
    output_type=InsightResponse,
    system_prompt=_SYNTHESIZER_SYSTEM_PROMPT,
)

# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


async def run_intelligence_query(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    *,
    organization_id: uuid.UUID,
    question: str,
    explicit_start: date | None = None,
    explicit_end: date | None = None,
    timeout_seconds: int = 45,
) -> InsightResponse:
    """
    Full two-stage pipeline:
      1. Stage A produces QueryPlan from the question.
      2. Service fetches and computes all data (no LLM math).
      3. Stage B synthesizes narrative from computed data.
    """
    service = intelligence_service

    try:
        # ----------------------------------------------------------------
        # Stage A: Plan
        # ----------------------------------------------------------------
        plan_result = await asyncio.wait_for(
            _planner_agent.run(question), timeout=15
        )
        plan: QueryPlan = plan_result.output
        log.info(
            "intelligence.plan",
            intent=plan.intent,
            metrics=plan.metrics,
            start=str(plan.start_date),
            end=str(plan.end_date),
        )

        # Override dates if caller specified them explicitly
        start = explicit_start or plan.start_date
        end = explicit_end or plan.end_date
        baseline_start = plan.baseline_start_date
        baseline_end = plan.baseline_end_date

        # Validate metrics against allowlist
        safe_metrics = [m for m in plan.metrics if m in _ALLOWED_METRICS]
        if not safe_metrics:
            safe_metrics = ["revenue", "orders"]

        granularity = TimeInterval(plan.granularity)

        # ----------------------------------------------------------------
        # Stage B prep: Fetch all data in parallel
        # ----------------------------------------------------------------
        org_ids = [organization_id]

        fetch_tasks = {
            "current": service.fetch_metric_window(
                session,
                auth_subject,
                start_date=start,
                end_date=end,
                granularity=granularity,
                metric_slugs=safe_metrics,
                organization_id=org_ids,
            ),
        }

        if baseline_start and baseline_end:
            fetch_tasks["baseline"] = service.fetch_metric_window(
                session,
                auth_subject,
                start_date=baseline_start,
                end_date=baseline_end,
                granularity=granularity,
                metric_slugs=safe_metrics,
                organization_id=org_ids,
            )

        # Product breakdown for all intents
        fetch_tasks["breakdown"] = service.fetch_product_breakdown(
            session,
            auth_subject,
            start_date=start,
            end_date=end,
            baseline_start=baseline_start,
            baseline_end=baseline_end,
        )

        if plan.intent in ("churn", "trend_explain"):
            fetch_tasks["churn"] = service.fetch_churn_summary(
                session,
                auth_subject,
                start_date=start,
                end_date=end,
            )

        results = await asyncio.gather(*fetch_tasks.values(), return_exceptions=True)
        computed: dict = {}
        warnings: list[str] = []
        for key, result in zip(fetch_tasks.keys(), results):
            if isinstance(result, Exception):
                log.warning("intelligence.fetch_error", key=key, error=str(result))
                warnings.append(f"Could not fetch {key} data: {result}")
            else:
                computed[key] = result

        current_window: MetricWindow | None = computed.get("current")
        baseline_window: MetricWindow | None = computed.get("baseline")
        breakdown: DimensionBreakdown | None = computed.get("breakdown")
        churn: ChurnSummary | None = computed.get("churn")

        # ----------------------------------------------------------------
        # Compute derived values
        # ----------------------------------------------------------------
        period_deltas = {}
        anomalies_found = {}
        if current_window and baseline_window:
            for slug in safe_metrics:
                period_deltas[slug] = service.compute_period_delta(
                    current_window, baseline_window, slug
                )

        if current_window:
            for slug in safe_metrics:
                found = service.detect_anomalies(current_window, slug)
                if found:
                    anomalies_found[slug] = [asdict(a) for a in found]

        # ----------------------------------------------------------------
        # Build prompt context for Stage B
        # ----------------------------------------------------------------
        context_parts = [
            f"QUESTION: {question}",
            f"INTENT: {plan.intent}",
            f"INTERPRETATION: {plan.interpretation_note}",
            f"TIME RANGE: {service.format_date_range(start, end)}",
        ]

        if baseline_start and baseline_end:
            context_parts.append(
                f"BASELINE RANGE: {service.format_date_range(baseline_start, baseline_end)}"
            )

        if period_deltas:
            context_parts.append(
                "PERIOD DELTAS (all values in cents or counts):\n"
                + json.dumps(period_deltas, indent=2)
            )

        if current_window:
            context_parts.append(
                "CURRENT PERIOD TOTALS:\n"
                + json.dumps(current_window.totals, indent=2)
            )

        if breakdown:
            context_parts.append(
                "PRODUCT BREAKDOWN (top contributors, values in cents):\n"
                + json.dumps(breakdown.rows[:6], indent=2)
            )

        if churn:
            context_parts.append(
                "CHURN SUMMARY:\n"
                + json.dumps(
                    {
                        "canceled_count": churn.canceled_count,
                        "mrr_lost_cents": churn.mrr_lost_cents,
                        "top_products": churn.top_products,
                    },
                    indent=2,
                )
            )

        if anomalies_found:
            context_parts.append(
                "ANOMALIES DETECTED:\n"
                + json.dumps(anomalies_found, indent=2)
            )

        if warnings:
            context_parts.append("DATA WARNINGS: " + "; ".join(warnings))

        context_parts.append(
            "\nProduce a complete InsightResponse. "
            "Use only the numbers above — do not invent figures. "
            "Currency is in cents; show as dollars in narrative."
        )

        synthesizer_prompt = "\n\n".join(context_parts)

        # ----------------------------------------------------------------
        # Stage B: Synthesize
        # ----------------------------------------------------------------
        synth_result = await asyncio.wait_for(
            _synthesizer_agent.run(synthesizer_prompt), timeout=30
        )
        insight: InsightResponse = synth_result.output

        # Inject computed drivers (deterministic) into the response
        if breakdown and breakdown.rows:
            computed_drivers = [
                InsightDriver(
                    dimension=breakdown.dimension,
                    key=row["key"],
                    current_value=int(row["current"]),
                    baseline_value=int(row["baseline"]),
                    delta=int(row["delta"]),
                    pct_change=row["pct_change"],
                    share_of_total_change=row["share_of_total_change"],
                    evidence_query_id=breakdown.query_id,
                )
                for row in breakdown.rows[:5]
                if abs(row["delta"]) > 0
            ]
            # Use computed drivers (not LLM-invented ones)
            insight = insight.model_copy(update={"drivers": computed_drivers})

        # Inject debug info
        queries_run = list(fetch_tasks.keys())
        if breakdown:
            queries_run.append(breakdown.query_id)
        if churn:
            queries_run.append(churn.query_id)

        debug = InsightDebug(
            queries_executed=queries_run,
            time_range=service.format_date_range(start, end),
            baseline_range=(
                service.format_date_range(baseline_start, baseline_end)
                if baseline_start and baseline_end
                else None
            ),
            warnings=warnings,
            model_used=settings.OPENAI_MODEL,
            plan_intent=plan.intent,
            interpretation_note=plan.interpretation_note,
        )
        insight = insight.model_copy(update={"debug": debug})

        return insight

    except TimeoutError:
        log.warning("intelligence.timeout", question=question[:100])
        return _timeout_response(question)
    except Exception as e:
        log.error("intelligence.error", error=str(e), question=question[:100])
        return _error_response(question, str(e))


def _timeout_response(question: str) -> InsightResponse:
    return InsightResponse(
        answer="The analysis timed out. Please try a more specific question.",
        confidence="low",
        confidence_reasons=["Query timed out before completion"],
        summary_bullets=["Analysis did not complete in time. Try narrowing the date range."],
        drivers=[],
        recommended_actions=[],
        followup_questions=["Can you try a shorter time range?"],
        debug=InsightDebug(
            queries_executed=[],
            time_range="unknown",
            baseline_range=None,
            warnings=["Timed out"],
            model_used=settings.OPENAI_MODEL,
            plan_intent="unknown",
            interpretation_note=f"Question: {question[:200]}",
        ),
    )


def _error_response(question: str, error: str) -> InsightResponse:
    return InsightResponse(
        answer="An error occurred while analyzing your data.",
        confidence="low",
        confidence_reasons=["System error during analysis"],
        summary_bullets=["Could not complete analysis due to a system error."],
        drivers=[],
        recommended_actions=[],
        followup_questions=[],
        debug=InsightDebug(
            queries_executed=[],
            time_range="unknown",
            baseline_range=None,
            warnings=[f"Error: {error}"],
            model_used=settings.OPENAI_MODEL,
            plan_intent="unknown",
            interpretation_note=f"Question: {question[:200]}",
        ),
    )
