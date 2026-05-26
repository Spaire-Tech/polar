"""Community activities service.

Creates and lists activities, accepts submissions, optionally pins the
activity onto the course's Home feed as a synthetic community_post."""

from __future__ import annotations

from uuid import UUID

from polar.kit.utils import utc_now
from polar.models.community_activity import CommunityActivity
from polar.models.community_activity_submission import CommunityActivitySubmission
from polar.models.community_post import CommunityPost
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .activities_repository import (
    CommunityActivityRepository,
    CommunityActivitySubmissionRepository,
)
from .activities_schemas import (
    CommunityActivityCreate,
    CommunityActivitySubmissionCreate,
    CommunityActivityUpdate,
)


class ActivityNotFound(Exception):
    pass


class ActivityHostMismatch(Exception):
    pass


class ActivityClosed(Exception):
    pass


class ActivityChannelInvalid(Exception):
    pass


class ActivitySubmissionInvalid(Exception):
    """Raised when the submission payload doesn't match the activity's
    submission_type (e.g. video submission with no mux_upload_id)."""


class CommunityActivityService:
    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    async def list_for_course(
        self, session: AsyncSession, *, course_id: UUID
    ) -> list[CommunityActivity]:
        repo = CommunityActivityRepository.from_session(session)
        return list(await repo.list_for_course(course_id))

    async def get(
        self, session: AsyncSession, *, activity_id: UUID, course_id: UUID
    ) -> CommunityActivity:
        repo = CommunityActivityRepository.from_session(session)
        activity = await repo.get_by_id_for_course(activity_id, course_id)
        if activity is None:
            raise ActivityNotFound()
        return activity

    # ------------------------------------------------------------------
    # Writes — host
    # ------------------------------------------------------------------

    async def create(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        host_user_id: UUID,
        payload: CommunityActivityCreate,
    ) -> CommunityActivity:
        # Channel must point at exactly one of module_id / lesson_id,
        # matching channel_kind.
        if payload.channel_kind == "module":
            if not payload.module_id or payload.lesson_id:
                raise ActivityChannelInvalid()
        else:
            if not payload.lesson_id or payload.module_id:
                raise ActivityChannelInvalid()

        activity = CommunityActivity(
            course_id=course_id,
            host_user_id=host_user_id,
            channel_kind=payload.channel_kind,
            module_id=payload.module_id,
            lesson_id=payload.lesson_id,
            title=payload.title.strip(),
            description=(payload.description or None),
            cover_url=(payload.cover_url or None),
            submission_type=payload.submission_type,
            status="open",
            pin_to_feed=payload.pin_to_feed,
            notify_on_publish=payload.notify_on_publish,
            submission_count=0,
        )
        repo = CommunityActivityRepository.from_session(session)
        await repo.create(activity, flush=True)

        if payload.pin_to_feed:
            await self._pin_activity(
                session, activity=activity, host_user_id=host_user_id
            )

        if payload.notify_on_publish:
            enqueue_job("community.activity.published", activity_id=activity.id)

        return activity

    async def update(
        self,
        session: AsyncSession,
        *,
        activity_id: UUID,
        course_id: UUID,
        host_user_id: UUID,
        payload: CommunityActivityUpdate,
    ) -> CommunityActivity:
        activity = await self.get(
            session, activity_id=activity_id, course_id=course_id
        )
        if activity.host_user_id != host_user_id:
            raise ActivityHostMismatch()

        data = payload.model_dump(exclude_unset=True)

        # Handle pin toggle + status change side effects before generic
        # column write.
        if "pin_to_feed" in data:
            want_pin = bool(data["pin_to_feed"])
            if want_pin and activity.pinned_post_id is None:
                await self._pin_activity(
                    session, activity=activity, host_user_id=host_user_id
                )
            elif not want_pin and activity.pinned_post_id is not None:
                await self._unpin_activity(session, activity=activity)

        if data.get("status") == "closed" and activity.pinned_post_id is not None:
            # Closing auto-unpins — keeping a closed activity at the top
            # of the feed is just visual noise.
            await self._unpin_activity(session, activity=activity)
            data["pin_to_feed"] = False

        for k, v in data.items():
            setattr(activity, k, v)

        await session.flush()
        return activity

    async def delete(
        self,
        session: AsyncSession,
        *,
        activity_id: UUID,
        course_id: UUID,
        host_user_id: UUID,
    ) -> None:
        activity = await self.get(
            session, activity_id=activity_id, course_id=course_id
        )
        if activity.host_user_id != host_user_id:
            raise ActivityHostMismatch()
        if activity.pinned_post_id is not None:
            await self._unpin_activity(session, activity=activity)
        repo = CommunityActivityRepository.from_session(session)
        await repo.soft_delete(activity)

    # ------------------------------------------------------------------
    # Submissions (customer)
    # ------------------------------------------------------------------

    async def submit(
        self,
        session: AsyncSession,
        *,
        activity_id: UUID,
        course_id: UUID,
        customer_id: UUID,
        payload: CommunityActivitySubmissionCreate,
    ) -> CommunityActivitySubmission:
        activity = await self.get(
            session, activity_id=activity_id, course_id=course_id
        )
        if activity.status == "closed":
            raise ActivityClosed()

        # Type-specific payload validation. We accept the host's chosen
        # submission_type as the authoritative one; the request's
        # submission_type must agree.
        st = payload.submission_type or activity.submission_type
        if st != activity.submission_type:
            raise ActivitySubmissionInvalid()
        if st == "photo" and not payload.file_id:
            raise ActivitySubmissionInvalid()
        if st == "video" and not (payload.mux_upload_id or payload.file_id):
            raise ActivitySubmissionInvalid()
        if st == "link" and not payload.link_url:
            raise ActivitySubmissionInvalid()
        if st == "text" and not (payload.body and payload.body.strip()):
            raise ActivitySubmissionInvalid()

        submission = CommunityActivitySubmission(
            activity_id=activity_id,
            customer_id=customer_id,
            submission_type=st,
            body=(payload.body.strip() if payload.body else None),
            file_id=payload.file_id,
            mux_upload_id=payload.mux_upload_id,
            link_url=payload.link_url,
        )
        sub_repo = CommunityActivitySubmissionRepository.from_session(session)
        await sub_repo.create(submission, flush=True)

        # Update denorm count.
        new_count = await sub_repo.count_for_activity(activity_id)
        activity.submission_count = new_count
        session.add(activity)
        await session.flush()

        # Notify the host that a new submission landed.
        enqueue_job(
            "community.activity.submission_received",
            activity_id=activity.id,
            submission_id=submission.id,
        )

        return submission

    # ------------------------------------------------------------------
    # Pin helpers — synthetic community_posts row
    # ------------------------------------------------------------------

    async def _pin_activity(
        self,
        session: AsyncSession,
        *,
        activity: CommunityActivity,
        host_user_id: UUID,
    ) -> None:
        """Create a community_posts row with pin_type='activity' and
        link it from the activity. The post body carries a short blurb
        + the activity_id in a known location so the feed renderer can
        upgrade it into an activity card."""
        body = (
            f"📝 New activity: **{activity.title}**\n\n"
            f"{activity.description or ''}".strip()
        )
        post = CommunityPost(
            course_id=activity.course_id,
            author_user_id=host_user_id,
            type="text",
            title=activity.title,
            body=body,
            body_format="markdown",
            published_at=utc_now(),
            pinned_at=utc_now(),
            pin_type="activity",
        )
        session.add(post)
        await session.flush()
        activity.pinned_post_id = post.id
        session.add(activity)
        await session.flush()

    async def _unpin_activity(
        self, session: AsyncSession, *, activity: CommunityActivity
    ) -> None:
        if activity.pinned_post_id is None:
            return
        post = await session.get(CommunityPost, activity.pinned_post_id)
        if post is not None:
            post.pinned_at = None
            post.pin_type = None
            session.add(post)
        activity.pinned_post_id = None
        session.add(activity)
        await session.flush()


activities_service = CommunityActivityService()
