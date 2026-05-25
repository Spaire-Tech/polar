from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.community_activity import CommunityActivity
    from polar.models.customer import Customer
    from polar.models.file import File


class CommunityActivitySubmission(RecordModel):
    """One submission to a CommunityActivity.

    No (activity_id, customer_id) UNIQUE — students can submit multiple
    times (re-do the bake, etc.). The card progress bar counts distinct
    contributing customers, not raw submission rows.

    Media reuses the existing community pipeline:
      - photo: `file_id` -> a File row in `community_post_image` service
      - video: `mux_playback_id` / `mux_upload_id` (same Mux flow as
        community_post_media)
      - link:  `link_url`
      - text:  body only
    """

    __tablename__ = "community_activity_submissions"
    __table_args__ = (
        CheckConstraint(
            "submission_type IN ('photo', 'video', 'text', 'link')",
            name="community_activity_submissions_submission_type_check",
        ),
    )

    activity_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("community_activities.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    submission_type: Mapped[str] = mapped_column(String(20), nullable=False)

    body: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    file_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("files.id", ondelete="set null"),
        nullable=True,
        default=None,
    )

    mux_playback_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None
    )
    mux_upload_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None
    )

    link_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @declared_attr
    def activity(cls) -> Mapped["CommunityActivity"]:
        return relationship("CommunityActivity", lazy="raise")

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    @declared_attr
    def file(cls) -> Mapped["File | None"]:
        return relationship("File", lazy="raise")


_ = "CommunityPostMedia"
