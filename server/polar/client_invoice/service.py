import uuid
from collections.abc import Sequence
from datetime import date
from typing import Any

import structlog

from polar.auth.models import AuthSubject, Organization, User
from polar.config import settings
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models.client_invoice import (
    ClientInvoice,
    ClientInvoiceLineItem,
    ClientInvoiceStatus,
)
from polar.models.order import Order, OrderBillingReasonInternal, OrderStatus
from polar.models.order_item import OrderItem
from polar.order.repository import OrderRepository
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncReadSession, AsyncSession
from polar.tax.calculation import TaxCalculationError, TaxCode, get_tax_service
from polar.worker import enqueue_job

from .repository import ClientInvoiceLineItemRepository, ClientInvoiceRepository
from .schemas import ClientInvoiceCreate
from .sorting import ClientInvoiceSortProperty

log: Logger = structlog.get_logger()


class ClientInvoiceError(PolarError): ...


class ClientInvoiceNotFound(ClientInvoiceError):
    def __init__(self, invoice_id: uuid.UUID) -> None:
        self.invoice_id = invoice_id
        super().__init__(f"Client invoice {invoice_id} not found.")


class ClientInvoiceNotDraft(ClientInvoiceError):
    def __init__(self, invoice: ClientInvoice) -> None:
        self.invoice = invoice
        super().__init__(
            f"Client invoice {invoice.id} is not a draft (status={invoice.status})."
        )


class ClientInvoiceAlreadyVoided(ClientInvoiceError):
    def __init__(self, invoice: ClientInvoice) -> None:
        self.invoice = invoice
        super().__init__(f"Client invoice {invoice.id} has already been voided.")


class ClientInvoiceService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        pagination: PaginationParams,
        sorting: list[Sorting[ClientInvoiceSortProperty]] = [
            (ClientInvoiceSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[ClientInvoice], int]:
        repository = ClientInvoiceRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)
        statement = repository.apply_sorting(statement, sorting)
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        invoice_id: uuid.UUID,
    ) -> ClientInvoice | None:
        repository = ClientInvoiceRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            ClientInvoice.id == invoice_id
        )
        return await repository.get_one_or_none(statement)

    async def create_draft(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: ClientInvoiceCreate,
    ) -> ClientInvoice:
        from polar.customer.repository import CustomerRepository

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(create_schema.customer_id)
        if customer is None:
            raise ClientInvoiceError(
                f"Customer {create_schema.customer_id} not found."
            )

        # Resolve organization from auth subject or customer
        if isinstance(auth_subject.subject, Organization):
            organization = auth_subject.subject
        else:
            organization = customer.organization

        # Ensure the Stripe customer exists on the platform account
        if customer.stripe_customer_id is None:
            create_params: dict[str, Any] = {"email": customer.email}
            if customer.billing_name is not None:
                create_params["name"] = customer.billing_name
            elif customer.name is not None:
                create_params["name"] = customer.name
            if customer.billing_address is not None:
                create_params["address"] = customer.billing_address.to_dict()

            stripe_customer = await stripe_service.create_customer(**create_params)
            customer = await customer_repository.update(
                customer,
                update_dict={"stripe_customer_id": stripe_customer.id},
                flush=True,
            )

        assert customer.stripe_customer_id is not None

        currency = create_schema.currency.lower()
        subtotal_amount = sum(
            item.unit_amount * item.quantity for item in create_schema.line_items
        )

        # Calculate tax before creating the Stripe invoice draft
        tax_processor = settings.DEFAULT_TAX_PROCESSOR
        tax_calculation_id: str | None = None
        tax_amount = 0

        if subtotal_amount > 0 and customer.billing_address is not None:
            tax_service = get_tax_service(tax_processor)
            try:
                tax_calculation = await tax_service.calculate(
                    uuid.uuid4(),
                    currency,
                    subtotal_amount,
                    TaxCode.general_electronically_supplied_services,
                    customer.billing_address,
                    [customer.tax_id] if customer.tax_id is not None else [],
                    False,
                )
                tax_calculation_id = tax_calculation["processor_id"]
                tax_amount = tax_calculation["amount"]
            except TaxCalculationError:
                log.warning(
                    "client_invoice.create_draft.tax_calculation_failed",
                    customer_id=str(customer.id),
                    organization_id=str(organization.id),
                )

        total_amount = subtotal_amount + tax_amount
        on_behalf_of_label = create_schema.on_behalf_of_label or organization.name

        # Compute days_until_due from explicit due_date
        days_until_due: int | None = None
        if create_schema.due_date is not None:
            delta = create_schema.due_date - date.today()
            days_until_due = max(1, delta.days)

        custom_fields: list[dict[str, str]] = [
            {"name": "On behalf of", "value": on_behalf_of_label}
        ]
        if create_schema.po_number is not None:
            custom_fields.append(
                {"name": "PO Number", "value": create_schema.po_number}
            )

        footer = (
            f"Issued by Spaire Technology as Merchant of Record "
            f"on behalf of {on_behalf_of_label}."
        )

        new_id = uuid.uuid4()

        # Create Stripe draft invoice
        stripe_invoice = await stripe_service.create_invoice(
            customer=customer.stripe_customer_id,
            currency=currency,
            collection_method="send_invoice",
            days_until_due=days_until_due,
            description=create_schema.memo,
            footer=footer,
            custom_fields=custom_fields,
            metadata={
                "client_invoice_id": str(new_id),
                "organization_id": str(organization.id),
                "spaire_mor": "true",
            },
        )

        # Distribute tax proportionally across line items
        remaining_tax = tax_amount
        line_items_with_tax: list[tuple[Any, int]] = []
        num_items = len(create_schema.line_items)
        for i, item in enumerate(create_schema.line_items):
            item_amount = item.unit_amount * item.quantity
            if i == num_items - 1:
                item_tax = remaining_tax
            elif subtotal_amount > 0:
                item_tax = round(tax_amount * item_amount / subtotal_amount)
                remaining_tax -= item_tax
            else:
                item_tax = 0
            line_items_with_tax.append((item, item_tax))

        # Create Stripe invoice items
        stripe_item_ids: list[str] = []
        for item, item_tax in line_items_with_tax:
            item_amount = item.unit_amount * item.quantity
            tax_amounts_param = None
            if item_tax > 0 and customer.billing_address is not None:
                tax_amounts_param = [
                    {
                        "amount": item_tax,
                        "tax_rate_data": {
                            "display_name": "Tax",
                            "percentage": 0,
                            "inclusive": False,
                            "country": customer.billing_address.country,
                        },
                        "taxable_amount": item_amount,
                    }
                ]

            stripe_item = await stripe_service.create_invoice_item(
                customer=customer.stripe_customer_id,
                invoice=stripe_invoice.id,
                amount=item_amount,
                currency=currency,
                description=item.description,
                tax_amounts=tax_amounts_param,
            )
            stripe_item_ids.append(stripe_item.id)

        # Persist
        repository = ClientInvoiceRepository.from_session(session)
        client_invoice = await repository.create(
            ClientInvoice(
                id=new_id,
                organization_id=organization.id,
                customer_id=customer.id,
                stripe_invoice_id=stripe_invoice.id,
                status=ClientInvoiceStatus.draft,
                currency=currency,
                subtotal_amount=subtotal_amount,
                tax_amount=tax_amount,
                total_amount=total_amount,
                tax_calculation_id=tax_calculation_id,
                memo=create_schema.memo,
                po_number=create_schema.po_number,
                due_date=create_schema.due_date,
                on_behalf_of_label=on_behalf_of_label,
            ),
            flush=True,
        )

        line_item_repository = ClientInvoiceLineItemRepository.from_session(session)
        for (item, item_tax), stripe_item_id in zip(
            line_items_with_tax, stripe_item_ids
        ):
            await line_item_repository.create(
                ClientInvoiceLineItem(
                    client_invoice_id=client_invoice.id,
                    stripe_invoice_item_id=stripe_item_id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_amount=item.unit_amount,
                    currency=currency,
                    amount=item.unit_amount * item.quantity,
                    tax_amount=item_tax,
                )
            )

        return client_invoice

    async def send(
        self,
        session: AsyncSession,
        invoice: ClientInvoice,
    ) -> ClientInvoice:
        if invoice.status != ClientInvoiceStatus.draft:
            raise ClientInvoiceNotDraft(invoice)

        assert invoice.stripe_invoice_id is not None

        # finalize locks tax amounts (tax is calculated before send ✓)
        await stripe_service.finalize_invoice(invoice.stripe_invoice_id)
        await stripe_service.send_invoice(invoice.stripe_invoice_id)

        repository = ClientInvoiceRepository.from_session(session)
        return await repository.update(
            invoice, update_dict={"status": ClientInvoiceStatus.open}
        )

    async def void_client_invoice(
        self,
        session: AsyncSession,
        invoice: ClientInvoice,
    ) -> ClientInvoice:
        if invoice.status in {ClientInvoiceStatus.void, ClientInvoiceStatus.paid}:
            raise ClientInvoiceAlreadyVoided(invoice)

        assert invoice.stripe_invoice_id is not None

        await stripe_service.void_invoice(invoice.stripe_invoice_id)

        repository = ClientInvoiceRepository.from_session(session)
        return await repository.update(
            invoice, update_dict={"status": ClientInvoiceStatus.void}
        )

    async def handle_stripe_invoice_paid(
        self,
        session: AsyncSession,
        stripe_invoice_id: str,
    ) -> ClientInvoice | None:
        """Called from the invoice.paid webhook. Creates the Order and records tax."""
        repository = ClientInvoiceRepository.from_session(session)
        invoice = await repository.get_by_stripe_invoice_id(stripe_invoice_id)

        if invoice is None:
            log.info(
                "client_invoice.stripe_paid.not_found",
                stripe_invoice_id=stripe_invoice_id,
            )
            return None

        if invoice.status == ClientInvoiceStatus.paid:
            return invoice

        # Record tax transaction
        tax_transaction_id: str | None = None
        if (
            invoice.tax_calculation_id is not None
            and invoice.tax_transaction_id is None
        ):
            tax_service = get_tax_service(settings.DEFAULT_TAX_PROCESSOR)
            try:
                tax_transaction_id = await tax_service.record(
                    invoice.tax_calculation_id, str(invoice.id)
                )
            except Exception:
                log.warning(
                    "client_invoice.stripe_paid.tax_transaction_failed",
                    invoice_id=str(invoice.id),
                    calculation_id=invoice.tax_calculation_id,
                )

        # Load customer (needed for invoice number generation and order fields)
        from polar.customer.repository import CustomerRepository

        customer_repo = CustomerRepository.from_session(session)
        customer = await customer_repo.get_by_id(invoice.customer_id)
        assert customer is not None

        invoice_number = await organization_service.get_next_invoice_number(
            session, customer.organization, customer
        )

        # Create the paid Order; stripe_invoice_id set → bypasses pending-status check
        order_repository = OrderRepository.from_session(session)
        order = await order_repository.create(
            Order(
                status=OrderStatus.paid,
                subtotal_amount=invoice.subtotal_amount,
                discount_amount=0,
                tax_amount=invoice.tax_amount,
                currency=invoice.currency,
                billing_reason=OrderBillingReasonInternal.client_invoice,
                billing_name=customer.billing_name,
                billing_address=customer.billing_address,
                tax_id=customer.tax_id,
                tax_processor=settings.DEFAULT_TAX_PROCESSOR
                if invoice.tax_calculation_id
                else None,
                tax_calculation_processor_id=invoice.tax_calculation_id,
                tax_transaction_processor_id=tax_transaction_id,
                stripe_invoice_id=stripe_invoice_id,
                invoice_number=invoice_number,
                customer_id=invoice.customer_id,
            ),
            flush=True,
        )

        # Create OrderItems from line items
        for line_item in invoice.line_items:
            session.add(
                OrderItem(
                    order_id=order.id,
                    label=line_item.description,
                    amount=line_item.amount,
                    tax_amount=line_item.tax_amount,
                )
            )

        # Update invoice
        update_dict: dict[str, Any] = {
            "status": ClientInvoiceStatus.paid,
            "order_id": order.id,
        }
        if tax_transaction_id is not None:
            update_dict["tax_transaction_id"] = tax_transaction_id

        invoice = await repository.update(invoice, update_dict=update_dict)

        enqueue_job("order.confirmation_email", order.id)

        log.info(
            "client_invoice.paid",
            invoice_id=str(invoice.id),
            order_id=str(order.id),
        )

        return invoice

    async def handle_stripe_invoice_voided(
        self,
        session: AsyncSession,
        stripe_invoice_id: str,
    ) -> ClientInvoice | None:
        repository = ClientInvoiceRepository.from_session(session)
        invoice = await repository.get_by_stripe_invoice_id(stripe_invoice_id)

        if invoice is None:
            return None

        if invoice.status == ClientInvoiceStatus.void:
            return invoice

        return await repository.update(
            invoice, update_dict={"status": ClientInvoiceStatus.void}
        )


client_invoice = ClientInvoiceService()
