"""Database queries for the customer notification surface."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models.customer_notification import (
    CustomerNotification,
    CustomerNotificationPreferences,
)


class CustomerNotificationRepository(
    RepositorySoftDeletionIDMixin[CustomerNotification, UUID],
    RepositorySoftDeletionMixin[CustomerNotification],
    RepositoryBase[CustomerNotification],
):
    model = CustomerNotification

    async def list_for_customer(
        self, customer_id: UUID, *, limit: int = 50
    ) -> Sequence[CustomerNotification]:
        statement = (
            self.get_base_statement()
            .where(CustomerNotification.customer_id == customer_id)
            .order_by(CustomerNotification.created_at.desc())
            .limit(limit)
        )
        return await self.get_all(statement)

    async def unread_count(self, customer_id: UUID) -> int:
        statement = (
            select(func.count())
            .select_from(CustomerNotification)
            .where(
                CustomerNotification.customer_id == customer_id,
                CustomerNotification.read_at.is_(None),
                CustomerNotification.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return int(result.scalar_one())

    async def mark_read(
        self, customer_id: UUID, notification_id: UUID
    ) -> None:
        now = utc_now()
        statement = (
            update(CustomerNotification)
            .where(
                CustomerNotification.id == notification_id,
                CustomerNotification.customer_id == customer_id,
                CustomerNotification.read_at.is_(None),
            )
            .values(read_at=now)
        )
        await self.session.execute(statement)

    async def mark_all_read(self, customer_id: UUID) -> None:
        now = utc_now()
        statement = (
            update(CustomerNotification)
            .where(
                CustomerNotification.customer_id == customer_id,
                CustomerNotification.read_at.is_(None),
            )
            .values(read_at=now)
        )
        await self.session.execute(statement)


class CustomerNotificationPreferencesRepository(
    RepositorySoftDeletionIDMixin[CustomerNotificationPreferences, UUID],
    RepositorySoftDeletionMixin[CustomerNotificationPreferences],
    RepositoryBase[CustomerNotificationPreferences],
):
    model = CustomerNotificationPreferences

    async def get_for_customer(
        self, customer_id: UUID
    ) -> CustomerNotificationPreferences | None:
        statement = self.get_base_statement().where(
            CustomerNotificationPreferences.customer_id == customer_id
        )
        return await self.get_one_or_none(statement)

    async def email_enabled(self, customer_id: UUID) -> bool:
        prefs = await self.get_for_customer(customer_id)
        return True if prefs is None else prefs.email_enabled

    async def upsert(
        self, customer_id: UUID, *, email_enabled: bool
    ) -> CustomerNotificationPreferences:
        statement = (
            pg_insert(CustomerNotificationPreferences)
            .values(
                customer_id=customer_id,
                email_enabled=email_enabled,
            )
            .on_conflict_do_update(
                index_elements=[CustomerNotificationPreferences.customer_id],
                set_={"email_enabled": email_enabled},
            )
            .returning(CustomerNotificationPreferences)
        )
        result = await self.session.execute(statement)
        row = result.scalar_one()
        return row


# Silence helper for ruff (datetime is referenced in type hints only)
_ = datetime
