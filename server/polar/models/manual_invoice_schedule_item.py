from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.manual_invoice_schedule import ManualInvoiceSchedule


class ManualInvoiceScheduleItem(RecordModel):
    __tablename__ = "manual_invoice_schedule_items"

    description: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    schedule_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("manual_invoice_schedules.id", ondelete="cascade"),
        index=True,
    )

    @declared_attr
    def schedule(cls) -> Mapped["ManualInvoiceSchedule"]:
        return relationship(
            "ManualInvoiceSchedule", lazy="raise_on_sql", back_populates="items"
        )

    @property
    def amount(self) -> int:
        return self.quantity * self.unit_amount
