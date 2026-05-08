from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import asc, desc

from polar.auth.models import AuthSubject, Organization, User
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models.email_subscriber import (
    EmailSubscriber,
    EmailSubscriberSource,
    EmailSubscriberStatus,
)
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import EmailSubscriberRepository
from .sorting import EmailSubscriberSortProperty


class EmailSubscriberService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID | None = None,
        status: str | None = None,
        q: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[EmailSubscriberSortProperty]],
    ) -> tuple[Sequence[EmailSubscriber], int]:
        repository = EmailSubscriberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                EmailSubscriber.organization_id == organization_id
            )

        if status is not None:
            statement = statement.where(EmailSubscriber.status == status)

        if q is not None and q.strip():
            statement = repository.apply_query_filter(statement, q.strip())

        # Apply sorting
        order_clauses = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EmailSubscriberSortProperty.created_at:
                order_clauses.append(clause_function(EmailSubscriber.created_at))
            elif criterion == EmailSubscriberSortProperty.email:
                order_clauses.append(clause_function(EmailSubscriber.email))
            elif criterion == EmailSubscriberSortProperty.status:
                order_clauses.append(clause_function(EmailSubscriber.status))
        if order_clauses:
            statement = statement.order_by(*order_clauses)

        return await repository.paginate(statement, limit=pagination.limit, page=pagination.page)

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        subscriber_id: UUID,
    ) -> EmailSubscriber | None:
        repository = EmailSubscriberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            EmailSubscriber.id == subscriber_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        email: str,
        name: str | None = None,
        source: str = EmailSubscriberSource.manual,
        import_source: str | None = None,
        customer_id: UUID | None = None,
    ) -> EmailSubscriber:
        repository = EmailSubscriberRepository.from_session(session)

        # Audit issue #23: the model carries email_verified_at but the
        # service never populated it. Treat the email as verified when the
        # subscriber arrives through a path that already proved control of
        # the address — checkout completion (customer_id is set), purchase
        # webhooks, or admin-confirmed manual creation. Imports / signup
        # forms stay unverified until a separate confirmation step ships.
        verified_now = (
            utc_now()
            if (
                customer_id is not None
                or source == EmailSubscriberSource.purchase
            )
            else None
        )

        # Check for existing subscriber
        existing = await repository.get_by_email_and_organization(
            email, organization_id
        )
        if existing is not None:
            # Reactivate if previously unsubscribed/archived
            if existing.status in (
                EmailSubscriberStatus.unsubscribed,
                EmailSubscriberStatus.archived,
            ):
                existing.status = EmailSubscriberStatus.active
                existing.unsubscribed_at = None
                if name and not existing.name:
                    existing.name = name
                if customer_id and not existing.customer_id:
                    existing.customer_id = customer_id
                # Promote to verified if this signal beats what we had.
                if verified_now and existing.email_verified_at is None:
                    existing.email_verified_at = verified_now
                await repository.update(existing)
            elif verified_now and existing.email_verified_at is None:
                # Active row, never verified, now we have a signal — record
                # it so the dashboard can distinguish form opt-ins from
                # confirmed addresses.
                existing.email_verified_at = verified_now
                await repository.update(existing)
            return existing

        subscriber = EmailSubscriber(
            organization_id=organization_id,
            email=email.lower().strip(),
            name=name,
            status=EmailSubscriberStatus.active,
            source=source,
            import_source=import_source,
            customer_id=customer_id,
            email_verified_at=verified_now,
        )
        return await repository.create(subscriber, flush=True)

    async def update(
        self,
        session: AsyncSession,
        subscriber: EmailSubscriber,
        *,
        name: str | None = None,
        status: str | None = None,
    ) -> EmailSubscriber:
        repository = EmailSubscriberRepository.from_session(session)

        if name is not None:
            subscriber.name = name
        if status is not None:
            subscriber.status = status
            if status == EmailSubscriberStatus.unsubscribed:
                from polar.kit.utils import utc_now

                subscriber.unsubscribed_at = utc_now()

        return await repository.update(subscriber)

    async def subscribe_from_storefront(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        email: str,
        name: str | None = None,
    ) -> EmailSubscriber:
        subscriber = await self.create(
            session,
            organization_id=organization_id,
            email=email,
            name=name,
            source=EmailSubscriberSource.space_signup,
        )
        await self._trigger_on_subscribe_sequences(session, organization_id, subscriber.id)
        return subscriber

    async def subscribe_from_purchase(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        email: str,
        name: str | None = None,
        customer_id: UUID | None = None,
        product_id: UUID | None = None,
    ) -> EmailSubscriber:
        subscriber = await self.create(
            session,
            organization_id=organization_id,
            email=email,
            name=name,
            source=EmailSubscriberSource.purchase,
            customer_id=customer_id,
        )
        await self._trigger_on_subscribe_sequences(session, organization_id, subscriber.id)
        if product_id is not None:
            from polar.email_sequence.service import email_sequence as sequence_service
            from polar.models.email_sequence import EmailSequenceTriggerType
            await sequence_service.enroll_for_trigger(
                session,
                organization_id,
                EmailSequenceTriggerType.on_purchase,
                subscriber.id,
                trigger_filter={"product_id": str(product_id)},
            )
            # Goal completion: stop any active sequences whose configured
            # goal is "buying this product". Trial→paid sequences use this
            # to halt promo emails the moment the customer converts.
            await sequence_service.complete_for_goal(
                session,
                organization_id,
                subscriber.id,
                goal_type="product_purchase",
                goal_filter={"product_id": str(product_id)},
            )
        return subscriber

    async def _trigger_on_subscribe_sequences(
        self,
        session: AsyncSession,
        organization_id: UUID,
        subscriber_id: UUID,
    ) -> None:
        from polar.email_sequence.service import email_sequence as sequence_service
        from polar.models.email_sequence import EmailSequenceTriggerType
        await sequence_service.enroll_for_trigger(
            session,
            organization_id,
            EmailSequenceTriggerType.on_subscribe,
            subscriber_id,
        )

    async def get_all_for_export(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> list[EmailSubscriber]:
        repository = EmailSubscriberRepository.from_session(session)
        return await repository.get_all_for_export(organization_id)

    async def get_stats(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> dict[str, int | float]:
        repository = EmailSubscriberRepository.from_session(session)
        counts = await repository.count_by_status(organization_id)
        active = counts.get("active", 0)
        unsubscribed = counts.get("unsubscribed", 0)
        archived = counts.get("archived", 0)
        invalid = counts.get("invalid", 0)
        total = sum(counts.values())

        # Last-30-day aggregates for the design's "Avg. daily growth" and "Unsub rate" tiles
        growth_rows = await repository.get_daily_counts(organization_id, days=30)
        unsub_rows = await repository.get_daily_unsubscribes(organization_id, days=30)
        added_30d = sum(r["count"] for r in growth_rows)
        unsubs_30d = sum(r["count"] for r in unsub_rows)
        avg_daily_growth_30d = added_30d / 30 if added_30d else 0.0
        unsub_rate_30d = (unsubs_30d / total * 100) if total else 0.0

        return {
            "total": total,
            "active": active,
            "unsubscribed": unsubscribed,
            "archived": archived,
            "invalid": invalid,
            "added_30d": added_30d,
            "unsubs_30d": unsubs_30d,
            "avg_daily_growth_30d": round(avg_daily_growth_30d, 2),
            "unsub_rate_30d": round(unsub_rate_30d, 2),
        }

    async def bulk_create(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        rows: list[tuple[str, str | None]],
        source: str = EmailSubscriberSource.import_,
        import_source: str | None = None,
    ) -> dict[str, int]:
        """Create many subscribers in one go.

        Returns a count breakdown:
          - created: rows that produced a new EmailSubscriber row
          - updated: rows that hit an existing row that was reactivated
              (status flipped from unsubscribed/archived back to active),
              or had its name backfilled
          - skipped: rows that were malformed (missing email / no '@')
              or duplicates of an already-active subscriber

        Audit issue #44 / fix-list #44: the previous implementation used
        a `modified_at > created_at` heuristic to detect "updated" rows.
        That always returned True for fresh rows because RecordModel sets
        modified_at on every update including the just-after-insert flush,
        making the count meaningless. We now pre-fetch the org's existing
        emails in one round-trip and classify deterministically.
        """
        # Normalize + dedupe rows up front; track skips for malformed input.
        cleaned: list[tuple[str, str | None]] = []
        seen_in_input: set[str] = set()
        skipped = 0
        for email, name in rows:
            email_norm = (email or "").strip().lower()
            if not email_norm or "@" not in email_norm:
                skipped += 1
                continue
            if email_norm in seen_in_input:
                # Duplicate within the same import — count as skipped so the
                # final number matches what actually got processed.
                skipped += 1
                continue
            seen_in_input.add(email_norm)
            cleaned.append((email_norm, name))

        if not cleaned:
            return {"created": 0, "updated": 0, "skipped": skipped}

        repository = EmailSubscriberRepository.from_session(session)
        existing_rows = await repository.list_by_emails_and_organization(
            [e for e, _ in cleaned], organization_id
        )
        existing_by_email = {r.email.lower(): r for r in existing_rows}

        created = 0
        updated = 0
        for email_norm, name in cleaned:
            existing = existing_by_email.get(email_norm)
            if existing is None:
                # New row.
                await self.create(
                    session,
                    organization_id=organization_id,
                    email=email_norm,
                    name=name,
                    source=source,
                    import_source=import_source,
                )
                created += 1
                continue

            # Pre-existing row: classify as updated if reactivation or
            # name-backfill happens, otherwise it's a no-op skip.
            mutated = False
            if existing.status in (
                EmailSubscriberStatus.unsubscribed,
                EmailSubscriberStatus.archived,
            ):
                existing.status = EmailSubscriberStatus.active
                existing.unsubscribed_at = None
                mutated = True
            if name and not existing.name:
                existing.name = name
                mutated = True
            if mutated:
                await repository.update(existing)
                updated += 1
            else:
                skipped += 1
        return {"created": created, "updated": updated, "skipped": skipped}

    async def preview_filter(
        self,
        session: AsyncReadSession,
        *,
        organization_id: UUID,
        filter_rules: dict | None,
        sample_limit: int = 8,
    ) -> tuple[int, list[EmailSubscriber]]:
        """Return (matching_count, sample_subscribers) for an audience filter."""
        repository = EmailSubscriberRepository.from_session(session)
        total = await repository.count_filter_matches(
            organization_id, filter_rules
        )
        sample = await repository.list_filter_matches(
            organization_id, filter_rules, limit=sample_limit
        )
        return total, sample

    async def resolve_filter_subscribers(
        self,
        session: AsyncReadSession,
        *,
        organization_id: UUID,
        filter_rules: dict | None,
    ) -> list[EmailSubscriber]:
        """Materialize the subscriber list for an audience filter."""
        repository = EmailSubscriberRepository.from_session(session)
        return await repository.list_filter_matches(
            organization_id, filter_rules
        )

    async def unsubscribe_by_id(
        self,
        session: AsyncSession,
        subscriber_id: UUID,
    ) -> bool:
        """Public unsubscribe — used by List-Unsubscribe links in emails.

        Returns True if a matching subscriber was found and is now
        unsubscribed (idempotent — already-unsubscribed counts as success).
        """
        from polar.kit.utils import utc_now

        repository = EmailSubscriberRepository.from_session(session)
        statement = repository.get_base_statement().where(
            EmailSubscriber.id == subscriber_id,
            EmailSubscriber.deleted_at.is_(None),
        )
        subscriber = await repository.get_one_or_none(statement)
        if subscriber is None:
            return False
        if subscriber.status != EmailSubscriberStatus.unsubscribed:
            subscriber.status = EmailSubscriberStatus.unsubscribed
            subscriber.unsubscribed_at = utc_now()
            await repository.update(subscriber)
        return True

    async def delete_permanently(
        self,
        session: AsyncSession,
        subscriber: EmailSubscriber,
    ) -> None:
        """Soft-delete the subscriber row (hides from all queries, frees the email/org slot)."""
        from polar.kit.utils import utc_now

        subscriber.deleted_at = utc_now()
        repository = EmailSubscriberRepository.from_session(session)
        await repository.update(subscriber)


    async def get_daily_growth(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 30,
    ) -> list[dict]:
        repository = EmailSubscriberRepository.from_session(session)
        return await repository.get_daily_counts(organization_id, days)

    async def get_daily_unsubscribes(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 30,
    ) -> list[dict]:
        repository = EmailSubscriberRepository.from_session(session)
        return await repository.get_daily_unsubscribes(organization_id, days)


email_subscriber = EmailSubscriberService()
