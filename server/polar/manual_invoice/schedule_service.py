from datetime import datetime
from uuid import UUID

import structlog

from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import ManualInvoice, Organization
from polar.models.manual_invoice import ManualInvoiceStatus
from polar.models.manual_invoice_item import ManualInvoiceItem
from polar.models.manual_invoice_schedule import (
    ManualInvoiceSchedule,
    ManualInvoiceScheduleStatus,
)
from polar.models.manual_invoice_schedule_item import ManualInvoiceScheduleItem
from polar.postgres import AsyncSession

from .repository import ManualInvoiceRepository
from .schedule_repository import ManualInvoiceScheduleRepository
from .service import ManualInvoiceError, manual_invoice_service

log = structlog.get_logger()


class ManualInvoiceScheduleError(PolarError): ...


class ManualInvoiceScheduleService:
    async def create(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        customer_id: UUID,
        currency: str,
        recurring_interval: SubscriptionRecurringInterval,
        recurring_interval_count: int = 1,
        next_issue_date: datetime,
        billing_name: str | None = None,
        notes: str | None = None,
        auto_issue: bool = False,
        auto_send_email: bool = False,
        items: list[dict[str, int | str]] | None = None,
    ) -> ManualInvoiceSchedule:
        schedule = ManualInvoiceSchedule(
            status=ManualInvoiceScheduleStatus.active,
            organization_id=organization.id,
            customer_id=customer_id,
            currency=currency,
            recurring_interval=recurring_interval,
            recurring_interval_count=recurring_interval_count,
            next_issue_date=next_issue_date,
            billing_name=billing_name,
            notes=notes,
            auto_issue=auto_issue,
            auto_send_email=auto_send_email,
        )

        if items:
            for item_data in items:
                schedule.items.append(
                    ManualInvoiceScheduleItem(
                        description=str(item_data["description"]),
                        quantity=int(item_data.get("quantity", 1)),
                        unit_amount=int(item_data["unit_amount"]),
                    )
                )

        repository = ManualInvoiceScheduleRepository.from_session(session)
        schedule = await repository.create(schedule, flush=True)

        log.info(
            "manual_invoice_schedule.created",
            schedule_id=str(schedule.id),
            interval=recurring_interval,
            interval_count=recurring_interval_count,
        )

        return schedule

    async def update(
        self,
        session: AsyncSession,
        schedule: ManualInvoiceSchedule,
        *,
        customer_id: UUID | None = None,
        billing_name: str | None = None,
        notes: str | None = None,
        currency: str | None = None,
        recurring_interval: SubscriptionRecurringInterval | None = None,
        recurring_interval_count: int | None = None,
        next_issue_date: datetime | None = None,
        auto_issue: bool | None = None,
        auto_send_email: bool | None = None,
        items: list[dict[str, int | str]] | None = None,
        set_customer_id: bool = False,
    ) -> ManualInvoiceSchedule:
        if schedule.status == ManualInvoiceScheduleStatus.canceled:
            raise ManualInvoiceScheduleError(
                "Canceled schedules cannot be updated."
            )

        repository = ManualInvoiceScheduleRepository.from_session(session)

        update_dict: dict[str, object] = {}
        if set_customer_id and customer_id is not None:
            update_dict["customer_id"] = customer_id
        if billing_name is not None:
            update_dict["billing_name"] = billing_name
        if notes is not None:
            update_dict["notes"] = notes
        if currency is not None:
            update_dict["currency"] = currency
        if recurring_interval is not None:
            update_dict["recurring_interval"] = recurring_interval
        if recurring_interval_count is not None:
            update_dict["recurring_interval_count"] = recurring_interval_count
        if next_issue_date is not None:
            update_dict["next_issue_date"] = next_issue_date
        if auto_issue is not None:
            update_dict["auto_issue"] = auto_issue
        if auto_send_email is not None:
            update_dict["auto_send_email"] = auto_send_email

        if update_dict:
            schedule = await repository.update(
                schedule, update_dict=update_dict, flush=True
            )

        if items is not None:
            schedule.items.clear()
            for item_data in items:
                schedule.items.append(
                    ManualInvoiceScheduleItem(
                        description=str(item_data["description"]),
                        quantity=int(item_data.get("quantity", 1)),
                        unit_amount=int(item_data["unit_amount"]),
                    )
                )
            await session.flush()

        return schedule

    async def pause(
        self,
        session: AsyncSession,
        schedule: ManualInvoiceSchedule,
    ) -> ManualInvoiceSchedule:
        if schedule.status != ManualInvoiceScheduleStatus.active:
            raise ManualInvoiceScheduleError("Only active schedules can be paused.")

        repository = ManualInvoiceScheduleRepository.from_session(session)
        return await repository.update(
            schedule,
            update_dict={"status": ManualInvoiceScheduleStatus.paused},
            flush=True,
        )

    async def resume(
        self,
        session: AsyncSession,
        schedule: ManualInvoiceSchedule,
    ) -> ManualInvoiceSchedule:
        if schedule.status != ManualInvoiceScheduleStatus.paused:
            raise ManualInvoiceScheduleError("Only paused schedules can be resumed.")

        repository = ManualInvoiceScheduleRepository.from_session(session)
        return await repository.update(
            schedule,
            update_dict={"status": ManualInvoiceScheduleStatus.active},
            flush=True,
        )

    async def cancel(
        self,
        session: AsyncSession,
        schedule: ManualInvoiceSchedule,
    ) -> ManualInvoiceSchedule:
        if schedule.status == ManualInvoiceScheduleStatus.canceled:
            raise ManualInvoiceScheduleError("Schedule is already canceled.")

        repository = ManualInvoiceScheduleRepository.from_session(session)
        return await repository.update(
            schedule,
            update_dict={"status": ManualInvoiceScheduleStatus.canceled},
            flush=True,
        )

    async def generate_invoice_from_schedule(
        self,
        session: AsyncSession,
        schedule: ManualInvoiceSchedule,
    ) -> ManualInvoice:
        """Generate a new ManualInvoice from a schedule template."""
        if schedule.status != ManualInvoiceScheduleStatus.active:
            raise ManualInvoiceScheduleError(
                "Invoices can only be generated from active schedules."
            )

        await session.refresh(schedule, ["organization", "customer"])

        # Create draft invoice from the schedule template
        invoice = ManualInvoice(
            status=ManualInvoiceStatus.draft,
            organization_id=schedule.organization_id,
            customer_id=schedule.customer_id,
            currency=schedule.currency,
            billing_name=schedule.billing_name,
            notes=schedule.notes,
            schedule_id=schedule.id,
        )

        # Copy line items
        for schedule_item in schedule.items:
            invoice.items.append(
                ManualInvoiceItem(
                    description=schedule_item.description,
                    quantity=schedule_item.quantity,
                    unit_amount=schedule_item.unit_amount,
                )
            )

        invoice_repository = ManualInvoiceRepository.from_session(session)
        invoice = await invoice_repository.create(invoice, flush=True)

        # Auto-issue if configured
        if schedule.auto_issue:
            try:
                invoice = await manual_invoice_service.issue(session, invoice)

                # Auto-send email if configured (requires issued status)
                if schedule.auto_send_email:
                    try:
                        invoice = await manual_invoice_service.send_invoice_email(
                            session, invoice
                        )
                    except ManualInvoiceError:
                        log.warning(
                            "manual_invoice_schedule.auto_send_email_failed",
                            schedule_id=str(schedule.id),
                            invoice_id=str(invoice.id),
                        )
            except ManualInvoiceError:
                log.warning(
                    "manual_invoice_schedule.auto_issue_failed",
                    schedule_id=str(schedule.id),
                    invoice_id=str(invoice.id),
                )

        # Advance the schedule to the next issue date
        now = utc_now()
        interval = SubscriptionRecurringInterval(schedule.recurring_interval)
        next_date = interval.get_next_period(
            schedule.next_issue_date, schedule.recurring_interval_count
        )

        schedule_repository = ManualInvoiceScheduleRepository.from_session(session)
        await schedule_repository.update(
            schedule,
            update_dict={
                "next_issue_date": next_date,
                "last_issued_at": now,
            },
            flush=True,
        )

        log.info(
            "manual_invoice_schedule.invoice_generated",
            schedule_id=str(schedule.id),
            invoice_id=str(invoice.id),
            next_issue_date=str(next_date),
        )

        return invoice

    async def process_due_schedules(self, session: AsyncSession) -> int:
        """Find all due schedules and generate invoices. Returns count of generated invoices."""
        now = utc_now()
        repository = ManualInvoiceScheduleRepository.from_session(session)
        statement = repository.get_due_schedules_statement(now)
        due_schedules = await repository.get_all(statement)

        count = 0
        for schedule in due_schedules:
            try:
                await self.generate_invoice_from_schedule(session, schedule)
                count += 1
            except ManualInvoiceScheduleError as e:
                log.warning(
                    "manual_invoice_schedule.process_failed",
                    schedule_id=str(schedule.id),
                    error=str(e),
                )

        if count > 0:
            log.info(
                "manual_invoice_schedule.process_due_completed",
                generated_count=count,
            )

        return count


manual_invoice_schedule_service = ManualInvoiceScheduleService()
