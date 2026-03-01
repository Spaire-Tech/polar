import uuid
from datetime import date, timedelta
from typing import Literal

from pydantic import Field, model_validator
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.kit.schemas import Schema

MAX_DATE_RANGE_DAYS = 365


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class IntelligenceQueryRequest(Schema):
    question: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="Natural language question about revenue or business performance.",
    )
    organization_id: uuid.UUID = Field(
        ..., description="The organization to scope the query to."
    )
    start_date: date | None = Field(
        None,
        description="Optional explicit start date. Agent will infer from question if not provided.",
    )
    end_date: date | None = Field(
        None,
        description="Optional explicit end date. Agent will infer from question if not provided.",
    )
    timezone: TimeZoneName = Field(
        default="UTC",
        description="Timezone for timestamp interpretation.",
    )

    @model_validator(mode="after")
    def validate_date_range(self) -> "IntelligenceQueryRequest":
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be after start_date")
            if (self.end_date - self.start_date).days > MAX_DATE_RANGE_DAYS:
                raise ValueError(
                    f"Date range cannot exceed {MAX_DATE_RANGE_DAYS} days"
                )
        return self


# ---------------------------------------------------------------------------
# Internal: Query Plan (Stage A output)
# ---------------------------------------------------------------------------


class QueryPlan(Schema):
    """Structured plan produced by Stage A (Query Planner). Internal use only."""

    intent: Literal[
        "trend_explain", "breakdown", "compare", "churn", "top_items", "forecast"
    ] = Field(..., description="The primary analytical intent of the question.")
    metrics: list[str] = Field(
        ...,
        description=(
            "Metric slugs needed to answer. "
            "Allowed: revenue, net_revenue, orders, new_subscriptions, "
            "active_subscriptions, canceled_subscriptions, churn_rate, mrr, arr, "
            "average_order_value, checkout_conversion_rate."
        ),
    )
    start_date: date = Field(..., description="Start of the primary analysis window.")
    end_date: date = Field(..., description="End of the primary analysis window.")
    baseline_start_date: date | None = Field(
        None, description="Start of the comparison baseline window (prior period)."
    )
    baseline_end_date: date | None = Field(
        None, description="End of the comparison baseline window."
    )
    granularity: Literal["day", "week", "month"] = Field(
        ..., description="Time series granularity."
    )
    interpretation_note: str = Field(
        ...,
        description=(
            "Human-readable statement of how the question was interpreted. "
            "E.g. 'I interpreted last week as Jan 8–14, 2026 UTC.'"
        ),
    )


# ---------------------------------------------------------------------------
# Response: Drivers, Actions, Debug
# ---------------------------------------------------------------------------


class InsightDriver(Schema):
    dimension: str = Field(..., description="The dimension being decomposed, e.g. 'product', 'country'.")
    key: str = Field(..., description="The specific value, e.g. 'Germany', 'Pro Plan'.")
    current_value: int = Field(..., description="Current period value in cents (for revenue) or count.")
    baseline_value: int = Field(..., description="Baseline period value.")
    delta: int = Field(..., description="Absolute change (current - baseline).")
    pct_change: float = Field(..., description="Percentage change, e.g. -12.5 for -12.5%.")
    share_of_total_change: float = Field(
        ...,
        description="Share of the total metric change attributed to this driver, 0–1.",
    )
    evidence_query_id: str = Field(
        ..., description="Opaque identifier describing the query used to compute this driver."
    )


class InsightAction(Schema):
    action: str = Field(..., description="Concise description of the recommended action.")
    why: str = Field(..., description="Why this action addresses the identified issue.")
    estimated_impact: str | None = Field(
        None, description="Qualitative or quantitative estimated impact."
    )
    effort: Literal["low", "medium", "high"] = Field(
        ..., description="Implementation effort level."
    )
    requires_human_approval: bool = Field(
        ..., description="Whether this action requires explicit human confirmation before executing."
    )


class InsightDebug(Schema):
    queries_executed: list[str] = Field(
        default_factory=list,
        description="List of query identifiers / descriptions run to generate this insight.",
    )
    time_range: str = Field(..., description="Primary time range used, e.g. 'Jan 8–14, 2026'.")
    baseline_range: str | None = Field(
        None, description="Comparison baseline range, e.g. 'Jan 1–7, 2026'."
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Data quality or coverage warnings, e.g. 'Sparse data for DE region'.",
    )
    model_used: str = Field(..., description="The AI model that generated this insight.")
    plan_intent: str = Field(..., description="The query intent resolved by Stage A.")
    interpretation_note: str = Field(
        ..., description="How the question was interpreted."
    )


class InsightResponse(Schema):
    answer: str = Field(
        ..., description="One-liner answer with key numbers, e.g. 'Revenue fell 8.4% WoW to $38,640.'"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="Confidence level of the insight."
    )
    confidence_reasons: list[str] = Field(
        default_factory=list,
        description="Reasons for the confidence score, e.g. 'Sufficient data volume', 'Missing geo breakdown'.",
    )
    summary_bullets: list[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="3–5 bullet-point findings, each starting with a key number.",
    )
    drivers: list[InsightDriver] = Field(
        default_factory=list,
        description="Ranked list of top contributors to the observed change.",
    )
    recommended_actions: list[InsightAction] = Field(
        default_factory=list,
        description="Concrete next steps ordered by estimated impact.",
    )
    followup_questions: list[str] = Field(
        default_factory=list,
        max_length=4,
        description="Suggested follow-up questions the user might ask next.",
    )
    debug: InsightDebug
