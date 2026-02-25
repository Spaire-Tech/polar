from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.manual_invoice import ManualInvoice


class ManualInvoiceItem(RecordModel):
    __tablename__ = "manual_invoice_items"

    description: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    manual_invoice_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("manual_invoices.id", ondelete="cascade"), index=True
    )

    @declared_attr
    def manual_invoice(cls) -> Mapped["ManualInvoice"]:
        return relationship(
            "ManualInvoice", lazy="raise_on_sql", back_populates="items"
        )

    @property
    def amount(self) -> int:
        """Total amount for this line item (quantity * unit_amount)."""
        return self.quantity * self.unit_amount
