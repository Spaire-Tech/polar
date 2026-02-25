from uuid import UUID

from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import Customer, ManualInvoice, Order, Organization
from polar.models.manual_invoice import ManualInvoiceStatus
from polar.models.manual_invoice_item import ManualInvoiceItem
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.order_item import OrderItem
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.repository import OrderRepository
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.webhook.service import webhook as webhook_service

from .repository import ManualInvoiceRepository


class ManualInvoiceError(PolarError): ...


class ManualInvoiceService:
    async def _send_webhook(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
        event: WebhookEventType,
    ) -> None:
        await session.refresh(manual_invoice, ["organization"])
        organization: Organization = manual_invoice.organization
        await webhook_service.send(session, organization, event, manual_invoice)

    async def create_draft(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        currency: str,
        customer_id: UUID | None = None,
        billing_name: str | None = None,
        notes: str | None = None,
        items: list[dict[str, int | str]] | None = None,
    ) -> ManualInvoice:
        manual_invoice = ManualInvoice(
            status=ManualInvoiceStatus.draft,
            organization_id=organization.id,
            customer_id=customer_id,
            currency=currency,
            billing_name=billing_name,
            notes=notes,
        )

        if items:
            for item_data in items:
                manual_invoice.items.append(
                    ManualInvoiceItem(
                        description=str(item_data["description"]),
                        quantity=int(item_data.get("quantity", 1)),
                        unit_amount=int(item_data["unit_amount"]),
                    )
                )

        repository = ManualInvoiceRepository.from_session(session)
        manual_invoice = await repository.create(manual_invoice, flush=True)

        await self._send_webhook(
            session, manual_invoice, WebhookEventType.manual_invoice_created
        )

        return manual_invoice

    async def update_draft(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
        *,
        customer_id: UUID | None = None,
        billing_name: str | None = None,
        notes: str | None = None,
        currency: str | None = None,
        items: list[dict[str, int | str]] | None = None,
        set_customer_id: bool = False,
    ) -> ManualInvoice:
        if manual_invoice.status != ManualInvoiceStatus.draft:
            raise ManualInvoiceError("Only draft invoices can be edited.")

        repository = ManualInvoiceRepository.from_session(session)

        update_dict: dict[str, object] = {}
        if billing_name is not None:
            update_dict["billing_name"] = billing_name
        if notes is not None:
            update_dict["notes"] = notes
        if currency is not None:
            update_dict["currency"] = currency
        if set_customer_id:
            update_dict["customer_id"] = customer_id

        if update_dict:
            manual_invoice = await repository.update(
                manual_invoice, update_dict=update_dict, flush=True
            )

        if items is not None:
            # Replace all items
            manual_invoice.items.clear()
            for item_data in items:
                manual_invoice.items.append(
                    ManualInvoiceItem(
                        description=str(item_data["description"]),
                        quantity=int(item_data.get("quantity", 1)),
                        unit_amount=int(item_data["unit_amount"]),
                    )
                )
            await session.flush()

        await self._send_webhook(
            session, manual_invoice, WebhookEventType.manual_invoice_updated
        )

        return manual_invoice

    async def issue(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
    ) -> ManualInvoice:
        """Finalize a draft invoice: assign invoice number, create Order, mark as issued."""
        if manual_invoice.status != ManualInvoiceStatus.draft:
            raise ManualInvoiceError("Only draft invoices can be issued.")

        if manual_invoice.customer_id is None:
            raise ManualInvoiceError("A customer must be assigned before issuing.")

        if not manual_invoice.items:
            raise ManualInvoiceError("At least one line item is required to issue.")

        # Load customer and organization for invoice number generation
        await session.refresh(manual_invoice, ["customer", "organization"])
        customer: Customer = manual_invoice.customer  # type: ignore[assignment]
        organization: Organization = manual_invoice.organization

        # Assign invoice number
        invoice_number = await organization_service.get_next_invoice_number(
            session, organization, customer
        )

        # Build OrderItems from ManualInvoiceItems
        order_items: list[OrderItem] = []
        subtotal = 0
        for item in manual_invoice.items:
            amount = item.amount
            subtotal += amount
            order_items.append(
                OrderItem(
                    label=item.description,
                    amount=amount,
                    tax_amount=0,
                    proration=False,
                )
            )

        # Create the Order with status=pending
        order = Order(
            status=OrderStatus.pending,
            subtotal_amount=subtotal,
            discount_amount=0,
            tax_amount=0,
            currency=manual_invoice.currency,
            billing_reason=OrderBillingReasonInternal.purchase,
            billing_name=manual_invoice.billing_name or customer.billing_name,
            billing_address=manual_invoice.billing_address or customer.billing_address,
            tax_id=manual_invoice.tax_id,
            invoice_number=invoice_number,
            customer=customer,
            items=order_items,
            user_metadata=manual_invoice.user_metadata,
        )
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.create(order, flush=True)

        # Update ManualInvoice
        now = utc_now()
        repository = ManualInvoiceRepository.from_session(session)
        manual_invoice = await repository.update(
            manual_invoice,
            update_dict={
                "status": ManualInvoiceStatus.issued,
                "invoice_number": invoice_number,
                "order_id": order.id,
                "issued_at": now,
            },
            flush=True,
        )

        await self._send_webhook(
            session, manual_invoice, WebhookEventType.manual_invoice_issued
        )

        return manual_invoice

    async def mark_paid(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
    ) -> ManualInvoice:
        """Mark an issued invoice as paid and update the linked Order."""
        if manual_invoice.status != ManualInvoiceStatus.issued:
            raise ManualInvoiceError("Only issued invoices can be marked as paid.")

        now = utc_now()
        repository = ManualInvoiceRepository.from_session(session)

        # Update the linked Order to paid
        if manual_invoice.order_id is not None:
            order_repository = OrderRepository.from_session(session)
            order = await order_repository.get_by_id(manual_invoice.order_id)
            if order is not None:
                await order_repository.update(
                    order,
                    update_dict={"status": OrderStatus.paid},
                    flush=True,
                )

        manual_invoice = await repository.update(
            manual_invoice,
            update_dict={
                "status": ManualInvoiceStatus.paid,
                "paid_at": now,
            },
            flush=True,
        )

        await self._send_webhook(
            session, manual_invoice, WebhookEventType.manual_invoice_paid
        )

        return manual_invoice

    async def void(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
    ) -> ManualInvoice:
        """Void an invoice. Draft or issued invoices can be voided."""
        if manual_invoice.status not in (
            ManualInvoiceStatus.draft,
            ManualInvoiceStatus.issued,
        ):
            raise ManualInvoiceError("Only draft or issued invoices can be voided.")

        now = utc_now()
        repository = ManualInvoiceRepository.from_session(session)

        # If issued, also void the linked Order via soft-delete
        if (
            manual_invoice.status == ManualInvoiceStatus.issued
            and manual_invoice.order_id is not None
        ):
            order_repository = OrderRepository.from_session(session)
            order = await order_repository.get_by_id(manual_invoice.order_id)
            if order is not None:
                await order_repository.soft_delete(order, flush=True)

        manual_invoice = await repository.update(
            manual_invoice,
            update_dict={
                "status": ManualInvoiceStatus.voided,
                "voided_at": now,
            },
            flush=True,
        )

        await self._send_webhook(
            session, manual_invoice, WebhookEventType.manual_invoice_voided
        )

        return manual_invoice

    async def delete_draft(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
    ) -> None:
        """Permanently delete a draft invoice."""
        if manual_invoice.status != ManualInvoiceStatus.draft:
            raise ManualInvoiceError("Only draft invoices can be deleted.")

        repository = ManualInvoiceRepository.from_session(session)
        await repository.soft_delete(manual_invoice, flush=True)


manual_invoice_service = ManualInvoiceService()
