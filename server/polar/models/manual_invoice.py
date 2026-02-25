from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.tax.tax_id import TaxID, TaxIDType

if TYPE_CHECKING:
    from polar.models import Customer, Order, Organization
    from polar.models.manual_invoice_item import ManualInvoiceItem


class ManualInvoiceStatus(StrEnum):
    draft = "draft"
    issued = "issued"
    paid = "paid"
    voided = "voided"


class ManualInvoice(MetadataMixin, RecordModel):
    __tablename__ = "manual_invoices"

    status: Mapped[ManualInvoiceStatus] = mapped_column(
        String, nullable=False, default=ManualInvoiceStatus.draft, index=True
    )

    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Customer billing info (snapshotted on the invoice)
    billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    billing_address: Mapped[Address | None] = mapped_column(
        AddressType, nullable=True
    )
    tax_id: Mapped[TaxID | None] = mapped_column(
        TaxIDType, nullable=True, default=None
    )

    # Payment terms
    due_date: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # Free-form memo visible on the invoice
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # Invoice number — assigned at issue-time only
    invoice_number: Mapped[str | None] = mapped_column(
        String, nullable=True, unique=True, default=None
    )

    # Lifecycle timestamps
    issued_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    voided_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # --- Foreign Keys ---

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=True, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")

    # Set when the invoice is issued — the corresponding Order
    order_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("orders.id"), nullable=True, index=True
    )

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")

    # --- Relationships ---

    items: Mapped[list["ManualInvoiceItem"]] = relationship(
        "ManualInvoiceItem",
        back_populates="manual_invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # --- Computed amounts ---

    @property
    def subtotal_amount(self) -> int:
        """Sum of all item amounts."""
        return sum(item.amount for item in self.items)

    @property
    def total_amount(self) -> int:
        """Total = subtotal (no tax/discount in MVP)."""
        return self.subtotal_amount
