"""Read-only quotas service.

Wraps the entitlements service (which gives the tier-defined limit) and
the event aggregation repository (which gives current usage) to answer
two questions:

  1. What's the current usage for quota X on org Y?
  2. Would emitting `requested` more units of quota X exceed the cap?

Producers (file upload, email send, mux webhook, video play) call
`check_quota()` before doing the work and act on `result.allowed`:

    result = await quotas.check(session, org_id, QuotaKey.email_sends_monthly)
    if not result.allowed:
        raise QuotaExceededError(result)

Enforcement policy (block vs. overage-bill) is a downstream decision —
this service only reports facts.
"""

from dataclasses import dataclass
from uuid import UUID

from polar.entitlements.service import entitlements as entitlements_service
from polar.entitlements.tiers import TierEntitlements
from polar.postgres import AsyncReadSession

from .definitions import QuotaKey, get_definition
from .repository import quota_event_repository


@dataclass(frozen=True)
class QuotaUsage:
    """Snapshot of one quota for one organization."""

    quota: QuotaKey
    limit: int | None  # None = unlimited
    used: int
    remaining: int | None  # None = unlimited

    @property
    def is_unlimited(self) -> bool:
        return self.limit is None

    @property
    def is_exceeded(self) -> bool:
        return self.limit is not None and self.used >= self.limit


@dataclass(frozen=True)
class QuotaCheckResult:
    """Decision for a single check-then-emit operation."""

    quota: QuotaKey
    allowed: bool
    limit: int | None
    used: int
    requested: int
    remaining: int | None  # None = unlimited
    reason: str

    @property
    def is_unlimited(self) -> bool:
        return self.limit is None


def _limit_for(
    entitlements: TierEntitlements, quota: QuotaKey
) -> int | None:
    mapping = {
        QuotaKey.video_hours_hosted: entitlements.limits.video_hours_hosted,
        QuotaKey.video_views_monthly: entitlements.limits.video_views_monthly,
        QuotaKey.storage_gb: entitlements.limits.storage_gb,
        QuotaKey.email_sends_monthly: entitlements.limits.email_sends_monthly,
    }
    return mapping[quota]


class QuotasService:
    async def get_usage(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        quota: QuotaKey,
    ) -> QuotaUsage:
        entitlements = await entitlements_service.get_for_organization(
            session, organization_id
        )
        limit = _limit_for(entitlements, quota)

        definition = get_definition(quota)
        repository = quota_event_repository(session)
        used = await repository.get_quota_usage(
            organization_id=organization_id, definition=definition
        )

        remaining: int | None
        if limit is None:
            remaining = None
        else:
            remaining = max(limit - used, 0)

        return QuotaUsage(
            quota=quota,
            limit=limit,
            used=used,
            remaining=remaining,
        )

    async def get_all_usage(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> dict[QuotaKey, QuotaUsage]:
        result: dict[QuotaKey, QuotaUsage] = {}
        for quota in QuotaKey:
            result[quota] = await self.get_usage(session, organization_id, quota)
        return result

    async def check(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        quota: QuotaKey,
        *,
        requested: int = 1,
    ) -> QuotaCheckResult:
        usage = await self.get_usage(session, organization_id, quota)

        if usage.limit is None:
            return QuotaCheckResult(
                quota=quota,
                allowed=True,
                limit=None,
                used=usage.used,
                requested=requested,
                remaining=None,
                reason="unlimited",
            )

        projected = usage.used + requested
        if projected > usage.limit:
            return QuotaCheckResult(
                quota=quota,
                allowed=False,
                limit=usage.limit,
                used=usage.used,
                requested=requested,
                remaining=usage.remaining,
                reason="exceeded",
            )

        return QuotaCheckResult(
            quota=quota,
            allowed=True,
            limit=usage.limit,
            used=usage.used,
            requested=requested,
            remaining=usage.remaining,
            reason="ok",
        )


quotas = QuotasService()
