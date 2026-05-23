from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course_submission import CourseSubmission


# v0.1 ships image only; the kind column is here so the same table can hold
# video submissions (Mux flow) later without a schema change.
SUBMISSION_MEDIA_KIND_IMAGE = "image"
SUBMISSION_MEDIA_KIND_VIDEO = "video"


class CourseSubmissionMedia(RecordModel):
    """A single image / video uploaded as part of a submission.

    One submission can have multiple media (carousel) — `position` controls
    ordering. Images live on S3 (the `course-submissions/{submission_id}/…`
    prefix); videos go through the existing Mux flow and stash the asset +
    playback ids here so the student player can stream them the same way
    lesson videos do.
    """

    __tablename__ = "course_submission_media"

    submission_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_submissions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    kind: Mapped[str] = mapped_column(
        String(10), nullable=False, default=SUBMISSION_MEDIA_KIND_IMAGE
    )

    # For images: the public S3 URL.
    # For videos: NULL until the Mux asset is ready, then the playback URL.
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True, default=None)

    # Mux fields — populated only for `kind = video`.
    mux_upload_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    mux_asset_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    mux_playback_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    mux_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    @declared_attr
    def submission(cls) -> Mapped["CourseSubmission"]:
        return relationship(
            "CourseSubmission", lazy="raise", back_populates="media"
        )
