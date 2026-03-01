"""
Intelligence service: all computation and data orchestration.
All DB access goes through IntelligenceRepository and metrics_service.
LLM calls live in agent.py.
"""

import math
import uuid
from dataclasses import dataclass
from datetime import date
from zoneinfo import ZoneInfo

import structlog

from polar.auth.models import AuthSubject, User, Organization
from polar.kit.time_queries import TimeInterval
from polar.metrics.service import metrics as metrics_service
from polar.postgres import AsyncReadSession

from .repository import IntelligenceRepository

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Data classes returned to the agent
# ---------------------------------------------------------------------------


@dataclass
class MetricWindow:
    start_date: date
    end_date: date
    series: dict[str, list[tuple[str, float]]]
    totals: dict[str, float]


@dataclass
class DimensionBreakdown:
    dimension: str
    query_id: str
    rows: list[dict]


@dataclass
class ChurnSummary:
    query_id: str
    canceled_count: int
    mrr_lost_cents: int
    top_products: list[dict]


@dataclass
class Anomaly:
    metric: str
    date: str
    value: float
    z_score: float
    direction: str  # "spike" | "drop"


# ---------------------------------------------------------------------------
# IntelligenceService
# ---------------------------------------------------------------------------


class IntelligenceService:
    """
    Orchestrates data fetching and all deterministic computations.
    The agent layer calls these methods and uses results to build narrative.
    """

    async def fetch_metric_window(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        granularity: TimeInterval,
        metric_slugs: list[str],
        organization_id: list[uuid.UUID] | None = None,
    ) -> MetricWindow:
        """Fetch a time-series window via the existing metrics service."""
        result = await metrics_service.get_metrics(
            session,
            auth_subject,
            start_date=start_date,
            end_date=end_date,
            timezone=ZoneInfo("UTC"),
            interval=granularity,
            organization_id=organization_id,
            product_id=None,
            billing_type=None,
            customer_id=None,
            metrics=metric_slugs if metric_slugs else None,
        )

        series: dict[str, list[tuple[str, float]]] = {s: [] for s in metric_slugs}
        totals: dict[str, float] = {s: 0.0 for s in metric_slugs}

        for period in result.periods:
            ts = str(period.timestamp.date())
            for slug in metric_slugs:
                val = float(getattr(period, slug, None) or 0)
                series[slug].append((ts, val))
                totals[slug] += val

        return MetricWindow(
            start_date=start_date,
            end_date=end_date,
            series=series,
            totals=totals,
        )

    async def fetch_product_breakdown(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        baseline_start: date | None,
        baseline_end: date | None,
    ) -> DimensionBreakdown:
        """Break down revenue by product vs baseline period."""
        repo = IntelligenceRepository(session)

        current_rows = await repo.get_product_revenue(auth_subject, start_date, end_date)
        baseline_rows: list[dict] = []
        if baseline_start and baseline_end:
            baseline_rows = await repo.get_product_revenue(
                auth_subject, baseline_start, baseline_end
            )

        current_map = {r["product_id"]: r for r in current_rows}
        baseline_map = {r["product_id"]: r for r in baseline_rows}

        total_delta = sum(
            current_map.get(k, {}).get("revenue", 0)
            - baseline_map.get(k, {}).get("revenue", 0)
            for k in set(current_map) | set(baseline_map)
        )

        rows = []
        for pid in set(current_map) | set(baseline_map):
            cur = current_map.get(pid, {})
            base = baseline_map.get(pid, {})
            cur_rev = cur.get("revenue", 0)
            base_rev = base.get("revenue", 0)
            delta = cur_rev - base_rev
            pct = ((delta / base_rev) * 100) if base_rev else 0.0
            share = (delta / total_delta) if total_delta else 0.0
            name = cur.get("name") or base.get("name", pid)
            rows.append({
                "key": name,
                "current": cur_rev,
                "baseline": base_rev,
                "delta": delta,
                "pct_change": round(pct, 2),
                "share_of_total_change": round(share, 4),
                "order_count": cur.get("count", 0),
            })

        rows.sort(key=lambda r: abs(r["delta"]), reverse=True)
        return DimensionBreakdown(
            dimension="product",
            query_id=f"product_breakdown:{start_date}:{end_date}",
            rows=rows[:10],
        )

    async def fetch_churn_summary(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
    ) -> ChurnSummary:
        """Summarise subscription cancellations in the period."""
        repo = IntelligenceRepository(session)
        rows = await repo.get_cancellation_breakdown(auth_subject, start_date, end_date)

        return ChurnSummary(
            query_id=f"churn_summary:{start_date}:{end_date}",
            canceled_count=sum(r["canceled_count"] for r in rows),
            mrr_lost_cents=sum(r["mrr_lost_cents"] for r in rows),
            top_products=rows[:5],
        )

    def detect_anomalies(self, window: MetricWindow, metric_slug: str) -> list[Anomaly]:
        """Z-score anomaly detection (|z| >= 2.0 flagged)."""
        series = window.series.get(metric_slug, [])
        if len(series) < 4:
            return []

        values = [v for _, v in series]
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = math.sqrt(variance) if variance > 0 else 0.0
        if std == 0:
            return []

        return [
            Anomaly(
                metric=metric_slug,
                date=ds,
                value=val,
                z_score=round((val - mean) / std, 2),
                direction="spike" if val > mean else "drop",
            )
            for ds, val in series
            if abs((val - mean) / std) >= 2.0
        ]

    def compute_period_delta(
        self,
        current: MetricWindow,
        baseline: MetricWindow,
        metric_slug: str,
    ) -> dict:
        """Compute period-over-period delta for a metric."""
        cur = current.totals.get(metric_slug, 0.0)
        base = baseline.totals.get(metric_slug, 0.0)
        delta = cur - base
        pct = ((delta / base) * 100) if base else 0.0
        return {
            "metric": metric_slug,
            "current": cur,
            "baseline": base,
            "delta": delta,
            "pct_change": round(pct, 2),
        }

    def format_date_range(self, start: date, end: date) -> str:
        if start.year == end.year and start.month == end.month:
            return f"{start.strftime('%b %-d')}–{end.strftime('%-d, %Y')}"
        if start.year == end.year:
            return f"{start.strftime('%b %-d')} – {end.strftime('%b %-d, %Y')}"
        return f"{start.strftime('%b %-d, %Y')} – {end.strftime('%b %-d, %Y')}"


intelligence_service = IntelligenceService()
