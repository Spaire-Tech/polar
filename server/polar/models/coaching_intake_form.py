from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course


class CoachingIntakeForm(RecordModel):
    """A simple, declarative form attached to a coaching program. The schema
    is stored as a JSON list of fields so adding new field types doesn't
    require a migration. The renderer (creator dashboard + customer portal)
    walks `schema_json["fields"]`.

    Soft-gating: when `required_for_access` is true, the customer portal
    surfaces a banner and gates the *non-essential* tabs (Schedule,
    Community, Notes) until the customer submits. The course_access benefit
    grant always succeeds — blocking access after a successful charge is a
    chargeback risk.
    """

    __tablename__ = "coaching_intake_forms"

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        unique=True,
        index=True,
    )

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # {"fields": [{"id": "uuid", "type": "short_text"|"long_text"|"select"|
    #              "multiselect"|"email", "label": "...", "required": bool,
    #              "options": ["..."]?}]}
    schema_json: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    required_for_access: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")
