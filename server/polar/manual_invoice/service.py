from uuid import UUID

import structlog

from polar.config import settings
from polar.email.sender import enqueue_email
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.currency import format_currency
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

log = structlog.get_logger()


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

    async def generate_payment_link(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
    ) -> ManualInvoice:
        """Generate a Stripe Checkout Session payment link for an issued invoice."""
        if manual_invoice.status != ManualInvoiceStatus.issued:
            raise ManualInvoiceError(
                "Payment links can only be generated for issued invoices."
            )

        if manual_invoice.total_amount <= 0:
            raise ManualInvoiceError(
                "Invoice total must be greater than zero to generate a payment link."
            )

        await session.refresh(manual_invoice, ["customer", "organization"])
        customer: Customer = manual_invoice.customer  # type: ignore[assignment]
        organization: Organization = manual_invoice.organization

        # Build success URL
        success_url = settings.generate_frontend_url(
            f"/checkout/success?manual_invoice_id={manual_invoice.id}"
        )

        description = f"{organization.name} — Invoice {manual_invoice.invoice_number}"

        stripe_checkout = await stripe_service.create_checkout_session(
            amount=manual_invoice.total_amount,
            currency=manual_invoice.currency,
            customer_email=customer.email,
            customer_id=customer.stripe_customer_id,
            success_url=success_url,
            metadata={
                "manual_invoice_id": str(manual_invoice.id),
                "type": "manual_invoice",
            },
            description=description,
        )

        repository = ManualInvoiceRepository.from_session(session)
        manual_invoice = await repository.update(
            manual_invoice,
            update_dict={"checkout_url": stripe_checkout.url},
            flush=True,
        )

        log.info(
            "manual_invoice.payment_link_generated",
            manual_invoice_id=str(manual_invoice.id),
            checkout_url=stripe_checkout.url,
        )

        return manual_invoice

    async def send_invoice_email(
        self,
        session: AsyncSession,
        manual_invoice: ManualInvoice,
    ) -> ManualInvoice:
        """Send the invoice to the customer via email."""
        if manual_invoice.status not in (
            ManualInvoiceStatus.issued,
            ManualInvoiceStatus.paid,
        ):
            raise ManualInvoiceError(
                "Emails can only be sent for issued or paid invoices."
            )

        await session.refresh(manual_invoice, ["customer", "organization"])
        customer: Customer = manual_invoice.customer  # type: ignore[assignment]
        organization: Organization = manual_invoice.organization

        if not customer.email:
            raise ManualInvoiceError("Customer does not have an email address.")

        total_formatted = format_currency(
            manual_invoice.total_amount, manual_invoice.currency
        )
        subject = f"Invoice {manual_invoice.invoice_number} from {organization.name}"

        # Build HTML email
        payment_section = ""
        if (
            manual_invoice.status == ManualInvoiceStatus.issued
            and manual_invoice.checkout_url
        ):
            payment_section = f"""
            <tr>
              <td style="padding: 20px 0;">
                <a href="{manual_invoice.checkout_url}"
                   style="display: inline-block; background-color: #0062FF; color: #fff;
                          padding: 12px 24px; text-decoration: none; border-radius: 6px;
                          font-weight: 600;">
                  Pay Now
                </a>
              </td>
            </tr>
            """
        elif manual_invoice.status == ManualInvoiceStatus.paid:
            payment_section = """
            <tr>
              <td style="padding: 10px 0; color: #16a34a; font-weight: 600;">
                This invoice has been paid. Thank you!
              </td>
            </tr>
            """

        # Build line items table
        items_rows = ""
        for item in manual_invoice.items:
            item_total = format_currency(item.amount, manual_invoice.currency)
            unit_price = format_currency(item.unit_amount, manual_invoice.currency)
            items_rows += f"""
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{item.description}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">{item.quantity}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">{unit_price}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">{item_total}</td>
            </tr>
            """

        notes_section = ""
        if manual_invoice.notes:
            notes_section = f"""
            <tr>
              <td style="padding: 20px 0 10px;">
                <strong>Notes:</strong><br/>
                <span style="color: #6b7280;">{manual_invoice.notes}</span>
              </td>
            </tr>
            """

        html_content = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
          <tr>
            <td style="padding: 32px 0 16px;">
              <h1 style="font-size: 24px; margin: 0;">{organization.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <p style="margin: 0; font-size: 16px;">
                Invoice <strong>{manual_invoice.invoice_number}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Item</th>
                    <th style="padding: 10px 8px; text-align: right; font-weight: 600;">Qty</th>
                    <th style="padding: 10px 8px; text-align: right; font-weight: 600;">Price</th>
                    <th style="padding: 10px 8px; text-align: right; font-weight: 600;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items_rows}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f9fafb;">
                    <td colspan="3" style="padding: 10px 8px; text-align: right; font-weight: 700;">Total</td>
                    <td style="padding: 10px 8px; text-align: right; font-weight: 700;">{total_formatted}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>
          {notes_section}
          {payment_section}
          <tr>
            <td style="padding: 24px 0 8px; color: #9ca3af; font-size: 12px;">
              This invoice was sent by {organization.name}.
            </td>
          </tr>
        </table>
        """

        enqueue_email(
            to_email_addr=customer.email,
            subject=subject,
            html_content=html_content,
        )

        # Update email_sent_at
        now = utc_now()
        repository = ManualInvoiceRepository.from_session(session)
        manual_invoice = await repository.update(
            manual_invoice,
            update_dict={"email_sent_at": now},
            flush=True,
        )

        log.info(
            "manual_invoice.email_sent",
            manual_invoice_id=str(manual_invoice.id),
            to=customer.email,
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
