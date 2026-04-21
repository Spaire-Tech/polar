from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from .organization import Organization


class BioBlockType(StrEnum):
    profile_header = "profile_header"
    links = "links"
    product = "product"
    product_grid = "product_grid"
    video = "video"
    gallery = "gallery"
    text = "text"
    divider = "divider"
    newsletter = "newsletter"
    booking = "booking"


class BioBlock(RecordModel):
    __tablename__ = "bio_blocks"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    type: Mapped[BioBlockType] = mapped_column(
        StringEnum(BioBlockType, length=32), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    settings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
