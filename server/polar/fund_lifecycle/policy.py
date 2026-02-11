from dataclasses import dataclass

from polar.models.fund_state import FundPolicy


# Hardcoded fallback when no policy exists in the database
DEFAULT_PENDING_WINDOW_DAYS = 7
DEFAULT_RESERVE_FLOOR_BASIS_POINTS = 1000  # 10%
DEFAULT_ENABLED = False


@dataclass(frozen=True)
class ResolvedPolicy:
    """A fully-resolved policy with values from account, global, or fallback."""

    enabled: bool
    pending_window_days: int
    reserve_floor_basis_points: int

    def to_dict(self) -> dict[str, object]:
        return {
            "enabled": self.enabled,
            "pending_window_days": self.pending_window_days,
            "reserve_floor_basis_points": self.reserve_floor_basis_points,
        }


def resolve_policy(policy: FundPolicy | None) -> ResolvedPolicy:
    """Resolve a FundPolicy (or None) into concrete parameters.

    Resolution order (handled by repository):
      1. Account-specific policy
      2. Global default (account_id IS NULL)
      3. Hardcoded fallback (this function handles the None case)
    """
    if policy is None:
        return ResolvedPolicy(
            enabled=DEFAULT_ENABLED,
            pending_window_days=DEFAULT_PENDING_WINDOW_DAYS,
            reserve_floor_basis_points=DEFAULT_RESERVE_FLOOR_BASIS_POINTS,
        )

    return ResolvedPolicy(
        enabled=policy.enabled,
        pending_window_days=policy.pending_window_days,
        reserve_floor_basis_points=policy.reserve_floor_basis_points,
    )
