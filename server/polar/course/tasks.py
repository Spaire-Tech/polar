"""Background tasks for the course module.

Currently only handles Mux asset cleanup when a lesson is soft-deleted —
the lesson row is gone but Mux keeps the asset (and bills for storage)
until we explicitly tell it to delete.
"""

from polar.exceptions import PolarTaskError
from polar.worker import TaskPriority, actor

from . import mux as mux_client


class CourseTaskError(PolarTaskError): ...


@actor(actor_name="course.mux_delete_asset", priority=TaskPriority.LOW)
async def mux_delete_asset(asset_id: str) -> None:
    """Best-effort delete of a Mux asset. Idempotent: a 404 from Mux is
    treated as success (the asset is already gone). Transient failures
    raise so Dramatiq retries with backoff.
    """
    ok = await mux_client.delete_asset(asset_id)
    if not ok:
        raise CourseTaskError(f"Failed to delete Mux asset {asset_id}")
