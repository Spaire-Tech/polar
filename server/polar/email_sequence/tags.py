"""Subscriber tag helpers used by the flow engine.

Wrapped in their own module so the flow engine and the tag-added trigger
(landing later) can share one set of CRUD primitives. All writes are
idempotent: adding an existing tag is a no-op, removing a missing tag
is a no-op.
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models.email_subscriber_tag import EmailSubscriberTag
from polar.postgres import AsyncSession


async def add_tag(
    session: AsyncSession, subscriber_id: UUID, tag: str
) -> None:
    tag = (tag or "").strip()
    if not tag:
        return
    existing = await session.execute(
        select(EmailSubscriberTag).where(
            EmailSubscriberTag.subscriber_id == subscriber_id,
            EmailSubscriberTag.tag == tag,
            EmailSubscriberTag.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        return
    session.add(
        EmailSubscriberTag(
            subscriber_id=subscriber_id,
            tag=tag,
            added_at=utc_now(),
        )
    )
    await session.flush()


async def remove_tag(
    session: AsyncSession, subscriber_id: UUID, tag: str
) -> None:
    tag = (tag or "").strip()
    if not tag:
        return
    statement = select(EmailSubscriberTag).where(
        EmailSubscriberTag.subscriber_id == subscriber_id,
        EmailSubscriberTag.tag == tag,
        EmailSubscriberTag.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    row = result.scalar_one_or_none()
    if row is None:
        return
    row.deleted_at = utc_now()
    await session.flush()


async def has_tag(
    session: AsyncSession, subscriber_id: UUID, tag: str
) -> bool:
    statement = select(EmailSubscriberTag.id).where(
        EmailSubscriberTag.subscriber_id == subscriber_id,
        EmailSubscriberTag.tag == tag,
        EmailSubscriberTag.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    return result.first() is not None


async def list_tags(
    session: AsyncSession, subscriber_id: UUID
) -> list[str]:
    statement = (
        select(EmailSubscriberTag.tag)
        .where(
            EmailSubscriberTag.subscriber_id == subscriber_id,
            EmailSubscriberTag.deleted_at.is_(None),
        )
        .order_by(EmailSubscriberTag.tag.asc())
    )
    result = await session.execute(statement)
    return [row[0] for row in result.all()]


async def has_any_tag(
    session: AsyncSession, subscriber_id: UUID, tags: Sequence[str]
) -> bool:
    if not tags:
        return False
    statement = select(EmailSubscriberTag.id).where(
        EmailSubscriberTag.subscriber_id == subscriber_id,
        EmailSubscriberTag.tag.in_(list(tags)),
        EmailSubscriberTag.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    return result.first() is not None
