"""Community feed business logic.

The service is the only place endpoints reach into for community
operations. It composes the six repositories from
polar.community.repository plus:
  * course_service.get_enrollment_for_customer — for the enrollment
    guard on customer-portal routes
  * CourseRepository / CourseLessonRepository — for cross-reference
    validation (lesson_id belongs to course, tag_id belongs to course)
  * Customer / User repositories — for author-name resolution
  * polar.kit.comments — for the threaded-with-tombstones logic shared
    with lesson_comments

Per server/CLAUDE.md, this file never opens a session or runs raw SQL.
All commits happen at request / task boundaries (we only flush when we
need an id back).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import Literal
from uuid import UUID, uuid4

from polar.auth.models import AuthSubject, Organization, User
from polar.course.repository import (
    CourseLessonRepository,
    CourseModuleRepository,
    CourseRepository,
)
from polar.course.service import course_service
from polar.file.repository import FileRepository
from polar.file.s3 import S3_SERVICES
from polar.kit.comments import find_orphan_parent_ids, merge_with_tombstones
from polar.kit.utils import utc_now
from polar.models.community_comment import CommunityComment
from polar.models.community_post import CommunityPost
from polar.models.community_post_media import CommunityPostMedia
from polar.models.community_settings import CommunitySettings
from polar.models.community_tag import CommunityTag
from polar.models.course_enrollment import CourseEnrollment
from polar.models.file import CommunityPostImageFile, FileServiceTypes
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .exceptions import (
    CommentsHidden,
    CommentsLocked,
    CommunityDisabled,
    CommunityNotEnrolled,
    InvalidLessonReference,
    InvalidMediaReference,
    InvalidParentComment,
    InvalidTagReference,
    UnsupportedPostType,
)
from .repository import (
    CommunityCommentRepository,
    CommunityPostRepository,
    CommunityReactionRepository,
    CommunitySettingsRepository,
    CommunityTagRepository,
    decode_cursor,
    encode_cursor,
)
from .schemas import (
    CommunityAuthor,
    CommunityAuthorInstructor,
    CommunityAuthorStudent,
    CommunityCommentCreate,
    CommunityCourseSummary,
    CommunityLessonChip,
    CommunityPinPayload,
    CommunityPostCreate,
    CommunityPostImageUploadResult,
    CommunityPostMediaCreate,
    CommunityPostUpdate,
    CommunityReactionEmoji,
    CommunityReactionSummaryEntry,
    CommunitySettingsUpdate,
)
from .sorting import CommunityPostSortProperty

# Default pin lifetime when the creator doesn't specify expires_at.
DEFAULT_PIN_DURATION = timedelta(days=7)

# Tags that get seeded on first enable. Keep slugs in sync with
# COMMUNITY_TAG_SLUGS_SEEDED in sorting.py.
_SEED_TAGS: list[tuple[str, str, int]] = [
    ("question", "Question", 0),
    ("win", "Win", 1),
    ("prompt", "Prompt", 2),
    ("milestone", "Milestone", 3),
]


def _resolve_display_name(name: str | None, email: str | None) -> str | None:
    """Same fallback rules as customer_portal/endpoints/courses.py:
    use the explicit name if present, else the local part of the email."""
    if name:
        stripped = name.strip()
        if stripped:
            return stripped
    if email:
        local_part = email.split("@", 1)[0].strip()
        if local_part:
            return local_part
    return None


class CommunityService:
    # ------------------------------------------------------------------
    # Settings — read, create-on-demand, update
    # ------------------------------------------------------------------

    async def get_or_create_settings(
        self,
        session: AsyncSession,
        course_id: UUID,
    ) -> CommunitySettings:
        """Lazy creation. The course-builder Community tab calls this on
        first visit; everywhere else expects the row to already exist."""
        repo = CommunitySettingsRepository.from_session(session)
        existing = await repo.get_by_course_id(course_id)
        if existing is not None:
            return existing

        settings = CommunitySettings(course_id=course_id)
        created = await repo.create(settings, flush=True)

        # Seed the default tag set so the filter chips have something to
        # show even before the creator touches tag config. Service-layer
        # seeding rather than a data migration so courses created before
        # community shipped get the same treatment when they enable it.
        tag_repo = CommunityTagRepository.from_session(session)
        for slug, label, position in _SEED_TAGS:
            existing_tag = await tag_repo.get_by_slug(course_id, slug)
            if existing_tag is None:
                await tag_repo.create(
                    CommunityTag(
                        course_id=course_id,
                        slug=slug,
                        label=label,
                        position=position,
                    )
                )

        return created

    async def get_settings(
        self,
        session: AsyncSession,
        course_id: UUID,
    ) -> CommunitySettings | None:
        repo = CommunitySettingsRepository.from_session(session)
        return await repo.get_by_course_id(course_id)

    async def update_settings(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        payload: CommunitySettingsUpdate,
    ) -> CommunitySettings:
        settings = await self.get_or_create_settings(session, course_id)
        repo = CommunitySettingsRepository.from_session(session)
        update_dict = payload.model_dump(exclude_unset=True, exclude_none=False)
        if not update_dict:
            return settings
        return await repo.update(settings, update_dict=update_dict)

    # ------------------------------------------------------------------
    # Enrollment guard — used by every customer-portal route
    # ------------------------------------------------------------------

    async def list_customer_communities(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
    ) -> Sequence[CommunityCourseSummary]:
        """Customer-portal picker source-of-truth. Lists the customer's
        enrolled courses with the community_enabled flag joined in. The
        picker UI filters this list to `community_enabled=True` rows so
        clicking a card never lands a student on a disabled banner."""
        repo = CommunitySettingsRepository.from_session(session)
        rows = await repo.list_customer_communities(customer_id)
        return [
            CommunityCourseSummary(
                course_id=row[0],
                course_title=row[1],
                course_thumbnail_url=row[2],
                course_thumbnail_object_position=row[3],
                community_enabled=row[4],
            )
            for row in rows
        ]

    async def assert_enrolled(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
        course_id: UUID,
    ) -> CourseEnrollment:
        """Returns the enrollment or raises CommunityNotEnrolled. Used by
        every customer-portal-side write so we never trust the
        path-param alone."""
        enrollment = await course_service.get_enrollment_for_customer(
            session, customer_id, course_id
        )
        if enrollment is None:
            raise CommunityNotEnrolled()
        return enrollment

    async def assert_community_enabled(
        self,
        session: AsyncSession,
        course_id: UUID,
    ) -> CommunitySettings:
        """Settings exist + `enabled` is true. Customer-portal routes
        call this so disabled courses 403 instead of returning empty."""
        settings = await self.get_settings(session, course_id)
        if settings is None or not settings.enabled:
            raise CommunityDisabled()
        return settings

    # ------------------------------------------------------------------
    # Posts
    # ------------------------------------------------------------------

    async def create_post(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        author_enrollment_id: UUID | None = None,
        author_user_id: UUID | None = None,
        payload: CommunityPostCreate,
    ) -> CommunityPost:
        """Phase 1 accepts text posts only. Video lands in Phase 3
        alongside the Mux pipeline."""
        if payload.type != "text":
            raise UnsupportedPostType()
        if (author_enrollment_id is None) == (author_user_id is None):
            # CHECK constraint will reject this at the DB layer too, but
            # raise early to keep the error surface clean.
            raise ValueError(
                "Exactly one of author_enrollment_id / author_user_id required."
            )

        await self._validate_lesson_belongs_to_course(
            session, course_id=course_id, lesson_id=payload.lesson_id
        )
        await self._validate_tag_belongs_to_course(
            session, course_id=course_id, tag_id=payload.tag_id
        )

        # Validate every image attachment up-front — same org as the
        # course, FileServiceTypes.community_post_image, is_uploaded.
        # Any file_id that fails any of these → reject the post before
        # we write a row.
        validated_media = await self._validate_media(
            session, course_id=course_id, media=payload.media
        )

        publish_at = payload.publish_at or utc_now()

        post = CommunityPost(
            course_id=course_id,
            author_enrollment_id=author_enrollment_id,
            author_user_id=author_user_id,
            type=payload.type,
            title=payload.title,
            body=payload.body,
            body_format=payload.body_format,
            lesson_id=payload.lesson_id,
            tag_id=payload.tag_id,
            published_at=publish_at,
        )
        repo = CommunityPostRepository.from_session(session)
        created = await repo.create(post, flush=True)

        # Attach media rows in the same transaction. The cascade on the
        # post's `media` relationship will clean these up if the post is
        # later soft-deleted.
        if validated_media:
            for entry in validated_media:
                media = CommunityPostMedia(
                    post_id=created.id,
                    media_type="image",
                    file_id=entry.file_id,
                    position=entry.position,
                )
                session.add(media)
            await session.flush()

        # Fan-out (SSE + bell). The actor pulls the row fresh so it's
        # safe to enqueue before the request-level commit lands.
        enqueue_job("community.post.created", post_id=created.id)
        # Re-fetch so every selectin relationship is materialized in the
        # current async context. Without this, _post_to_read's
        # `post.tag` / `post.media` access on the freshly-flushed object
        # triggers an implicit lazy-load → MissingGreenlet under asyncpg.
        # Re-fetching (vs `session.refresh(attribute_names=…)`) is
        # future-proof: future selectin relationships hydrate
        # automatically without anyone remembering to update an
        # attribute list.
        return await self._get_post_for_render(session, created.id)

    async def upload_post_image(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        filename: str,
        data: bytes,
        mime_type: str,
    ) -> CommunityPostImageUploadResult:
        """Server-proxied image upload for community-post composers.

        Students don't carry an org-write scope and so can't use the
        standard /v1/files/ presigned-upload flow. This pushes the
        bytes through the server, lands them in the community-post
        S3 bucket, and creates a File row owned by the course's
        organization so the rest of the file lifecycle (the post's
        media row, public URL render, cascade delete) works the same
        as if the creator had uploaded it.
        """
        # Resolve the course's owning organization — file rows are
        # always scoped to an org.
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_by_id(course_id)
        if course is None:
            raise CommunityNotEnrolled()

        # S3 key — keep org + course namespaces so deletion / migration
        # scripts can scope by prefix later.
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if not ext or "/" in ext or len(ext) > 6:
            # Conservative extension fallback by mime type.
            ext = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/gif": "gif",
                "image/webp": "webp",
                "image/svg+xml": "svg",
                "image/heic": "heic",
                "image/heif": "heif",
                "image/avif": "avif",
            }.get(mime_type, "bin")

        path = (
            f"community-posts/{course.organization_id}/{course_id}/"
            f"{uuid4().hex}.{ext}"
        )
        s3 = S3_SERVICES[FileServiceTypes.community_post_image]
        s3.upload(data, path, mime_type)

        # Create the polymorphic File row. is_uploaded=True so the
        # standard validators (FileRepository.get_uploaded_by_ids_in_org)
        # accept it on the post-create request.
        file_row = CommunityPostImageFile(
            organization_id=course.organization_id,
            name=filename,
            path=path,
            mime_type=mime_type,
            size=len(data),
            is_uploaded=True,
            is_enabled=True,
        )
        file_repo = FileRepository.from_session(session)
        created = await file_repo.create(file_row, flush=True)

        return CommunityPostImageUploadResult(
            file_id=created.id,
            public_url=s3.get_public_url(path),
            size=len(data),
            mime_type=mime_type,
        )

    async def _validate_media(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        media: list[CommunityPostMediaCreate],
    ) -> list[CommunityPostMediaCreate]:
        """Verify each image's file_id is uploaded, belongs to this
        course's organization, and is the community_post_image service
        type. Returns the validated list (same order, deduped by
        file_id) or raises InvalidMediaReference if any check fails."""
        if not media:
            return []

        # Resolve the course's organization to scope the file lookup.
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_by_id(course_id)
        if course is None:
            raise CommunityNotEnrolled()  # "course gone" surfaces as 404

        file_ids = {entry.file_id for entry in media}
        file_repo = FileRepository.from_session(session)
        files = await file_repo.get_uploaded_by_ids_in_org(
            course.organization_id,
            file_ids,
            service=FileServiceTypes.community_post_image,
        )
        valid_ids = {f.id for f in files}
        missing = file_ids - valid_ids
        if missing:
            raise InvalidMediaReference()

        # Dedupe by file_id while preserving the client's order.
        seen: set[UUID] = set()
        deduped: list[CommunityPostMediaCreate] = []
        for entry in media:
            if entry.file_id in seen:
                continue
            seen.add(entry.file_id)
            deduped.append(entry)
        return deduped

    async def _get_post_for_render(
        self, session: AsyncSession, post_id: UUID
    ) -> CommunityPost:
        """Return a CommunityPost with all selectin relationships loaded.

        Wraps `repo.get_by_id` with a non-null assertion so callers that
        just inserted or updated the row can rely on the fully-hydrated
        object for serialization."""
        repo = CommunityPostRepository.from_session(session)
        fresh = await repo.get_by_id(post_id)
        if fresh is None:
            raise RuntimeError(
                f"Post {post_id} not found after create/update — "
                "this should be impossible within the same session"
            )
        return fresh

    async def get_post(
        self, session: AsyncSession, post_id: UUID
    ) -> CommunityPost | None:
        repo = CommunityPostRepository.from_session(session)
        return await repo.get_by_id(post_id)

    async def update_post(
        self,
        session: AsyncSession,
        *,
        post: CommunityPost,
        payload: CommunityPostUpdate,
    ) -> CommunityPost:
        repo = CommunityPostRepository.from_session(session)

        if payload.tag_id is not None:
            await self._validate_tag_belongs_to_course(
                session, course_id=post.course_id, tag_id=payload.tag_id
            )

        update_dict = payload.model_dump(exclude_unset=True, exclude_none=False)
        if not update_dict:
            return post
        await repo.update(post, update_dict=update_dict)
        # If tag_id changed, the in-memory `post.tag` cache points at
        # the OLD tag — selectin loaded it on the initial get_by_id.
        # Re-fetch so the renderer sees the new tag.
        return await self._get_post_for_render(session, post.id)

    async def soft_delete_post(
        self, session: AsyncSession, post: CommunityPost
    ) -> None:
        repo = CommunityPostRepository.from_session(session)
        await repo.soft_delete(post)

    async def list_for_moderation(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        cursor: str | None,
        limit: int,
    ) -> tuple[Sequence[CommunityPost], bool, dict]:
        """Creator moderation list — includes drafts. Same render
        context shape as `list_feed` so the editor can use the same
        per-post header / author chip render path."""
        repo = CommunityPostRepository.from_session(session)
        rows, has_next = await repo.list_for_moderation(
            course_id,
            cursor=decode_cursor(cursor) if cursor else None,
            limit=limit,
        )
        ctx = await self.build_render_context(
            session,
            posts=rows,
            viewer_enrollment_id=None,
            viewer_user_id=None,
        )
        return rows, has_next, ctx

    def encode_moderation_cursor(self, *, last: CommunityPost) -> str:
        return encode_cursor(last.created_at, last.id)

    # ---- Feed ----

    async def list_feed(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        sort: CommunityPostSortProperty,
        module_id: UUID | None,
        lesson_id: UUID | None,
        tag_id: UUID | None,
        cursor: str | None,
        limit: int,
        viewer_enrollment_id: UUID | None,
        viewer_user_id: UUID | None,
    ) -> tuple[Sequence[CommunityPost], bool, dict]:
        """Returns (posts, has_next_page, render_context) where
        render_context bundles the per-post lesson/tag/author/reaction
        data the endpoint needs to compose CommunityPostRead.

        Keeping render_context as a dict here keeps the service signature
        Pydantic-free — the endpoint does the final schema assembly so
        the service stays usable from tasks too."""
        post_repo = CommunityPostRepository.from_session(session)

        module_lesson_ids = None
        if module_id is not None:
            lesson_repo = CourseLessonRepository.from_session(session)
            module_lessons = await lesson_repo.get_by_module_statement(
                module_id
            )
            module_lesson_ids = {
                lesson.id
                for lesson in await lesson_repo.get_all(module_lessons)
            }

        rows, has_next = await post_repo.list_feed(
            course_id,
            sort=sort.value,
            module_lesson_ids=module_lesson_ids,
            lesson_id=lesson_id,
            tag_id=tag_id,
            cursor=decode_cursor(cursor) if cursor else None,
            limit=limit,
        )

        ctx = await self.build_render_context(
            session,
            posts=rows,
            viewer_enrollment_id=viewer_enrollment_id,
            viewer_user_id=viewer_user_id,
        )
        return rows, has_next, ctx

    def encode_next_cursor(
        self, *, last: CommunityPost, sort: CommunityPostSortProperty
    ) -> str:
        """The endpoint calls this when has_next_page=True to give the
        client a cursor for the next request."""
        if sort == CommunityPostSortProperty.recent:
            sort_key = last.pinned_at or last.published_at
        else:
            # top_week / unanswered both order by published_at desc.
            sort_key = last.published_at
        # Both fields are non-null on a published post (CHECK on
        # community_posts_pin_consistency); fallback to now() defensively.
        return encode_cursor(sort_key or utc_now(), last.id)

    # ------------------------------------------------------------------
    # Comments
    # ------------------------------------------------------------------

    async def list_comments(
        self,
        session: AsyncSession,
        *,
        post: CommunityPost,
    ) -> Sequence[CommunityComment]:
        """Visible replies plus soft-deleted parents whose replies still
        render, so the frontend can show tombstones — same pattern as
        lesson_comments. Uses the shared kit."""
        repo = CommunityCommentRepository.from_session(session)
        visible = list(await repo.get_by_post(post.id))

        orphan_ids = find_orphan_parent_ids(visible)
        if not orphan_ids:
            return visible
        tombstones = await repo.get_tombstone_parents(post.id, orphan_ids)
        return merge_with_tombstones(visible, tombstones)

    async def get_comment(
        self, session: AsyncSession, comment_id: UUID
    ) -> CommunityComment | None:
        repo = CommunityCommentRepository.from_session(session)
        return await repo.get_by_id(comment_id)

    async def create_comment(
        self,
        session: AsyncSession,
        *,
        post: CommunityPost,
        author_enrollment_id: UUID | None = None,
        author_user_id: UUID | None = None,
        payload: CommunityCommentCreate,
    ) -> CommunityComment:
        # Resolve the effective comments_mode — post-level override
        # wins, else falls back to the course-wide setting.
        mode = await self._resolve_comments_mode(session, post)
        if mode == "hidden":
            raise CommentsHidden()
        if mode == "locked":
            raise CommentsLocked()

        if (author_enrollment_id is None) == (author_user_id is None):
            raise ValueError(
                "Exactly one of author_enrollment_id / author_user_id required."
            )

        comment_repo = CommunityCommentRepository.from_session(session)
        if payload.parent_id is not None:
            parent = await comment_repo.get_by_id(payload.parent_id)
            if parent is None or parent.post_id != post.id:
                raise InvalidParentComment()

        comment = CommunityComment(
            post_id=post.id,
            parent_id=payload.parent_id,
            author_enrollment_id=author_enrollment_id,
            author_user_id=author_user_id,
            content=payload.content,
            # Only set on video posts. For text posts we clamp to None so
            # an over-eager client can't pin replies to a moment that
            # doesn't exist.
            timestamp_seconds=(
                payload.timestamp_seconds if post.type == "video" else None
            ),
        )
        created = await comment_repo.create(comment, flush=True)

        post_repo = CommunityPostRepository.from_session(session)
        await post_repo.increment_comment_count(post.id, by=1)

        # Bell notification to the post author. The task skips self-
        # replies and silently no-ops if the post / comment / target
        # user resolution fails downstream.
        enqueue_job("community.comment.created", comment_id=created.id)
        return created

    async def soft_delete_comment(
        self,
        session: AsyncSession,
        *,
        comment: CommunityComment,
    ) -> None:
        comment_repo = CommunityCommentRepository.from_session(session)
        await comment_repo.soft_delete(comment)
        # Counter stays decremented even though the row is recoverable —
        # the customer-facing count is "visible replies", not "row count".
        post_repo = CommunityPostRepository.from_session(session)
        await post_repo.increment_comment_count(comment.post_id, by=-1)

    # ------------------------------------------------------------------
    # Reactions
    # ------------------------------------------------------------------

    async def toggle_reaction(
        self,
        session: AsyncSession,
        *,
        target_type: Literal["post", "comment"],
        target_id: UUID,
        actor_enrollment_id: UUID | None = None,
        actor_user_id: UUID | None = None,
        emoji: CommunityReactionEmoji,
    ) -> tuple[bool, int]:
        """Returns (is_active_after_toggle, new_count). The endpoint
        wraps this in CommunityReactionToggleResult."""
        if (actor_enrollment_id is None) == (actor_user_id is None):
            raise ValueError(
                "Exactly one of actor_enrollment_id / actor_user_id required."
            )

        reaction_repo = CommunityReactionRepository.from_session(session)
        active = await reaction_repo.toggle(
            target_type=target_type,
            target_id=target_id,
            actor_enrollment_id=actor_enrollment_id,
            actor_user_id=actor_user_id,
            emoji=emoji,
        )

        # New total for this target (across all emojis) — the post's
        # materialized counter follows. Cheap because it's a small,
        # well-indexed table.
        total = await reaction_repo.count_by_target(
            target_type=target_type, target_id=target_id
        )

        if target_type == "post":
            post_repo = CommunityPostRepository.from_session(session)
            await post_repo.set_reaction_count(target_id, total)

        return active, total

    # ------------------------------------------------------------------
    # Pinning
    # ------------------------------------------------------------------

    async def pin_post(
        self,
        session: AsyncSession,
        *,
        post: CommunityPost,
        payload: CommunityPinPayload,
    ) -> CommunityPost:
        repo = CommunityPostRepository.from_session(session)

        # Only one prompt_of_week pin at a time per course; clear any
        # existing one before pinning this post.
        if payload.pin_type == "prompt_of_week":
            await repo.clear_existing_prompt_pin(post.course_id)

        now = utc_now()
        expires = payload.expires_at or (now + DEFAULT_PIN_DURATION)

        updated = await repo.update(
            post,
            update_dict={
                "pinned_at": now,
                "pin_type": payload.pin_type,
                "pin_expires_at": expires,
            },
        )

        # If pinning as prompt_of_week, also point settings at this post
        # so the customer portal can render the prompt card without
        # scanning posts.
        if payload.pin_type == "prompt_of_week":
            settings = await self.get_or_create_settings(session, post.course_id)
            settings_repo = CommunitySettingsRepository.from_session(session)
            await settings_repo.update(
                settings,
                update_dict={"prompt_of_week_post_id": post.id},
            )

        return updated

    async def unpin_post(
        self,
        session: AsyncSession,
        post: CommunityPost,
    ) -> CommunityPost:
        repo = CommunityPostRepository.from_session(session)
        updated = await repo.update(
            post,
            update_dict={
                "pinned_at": None,
                "pin_type": None,
                "pin_expires_at": None,
            },
        )
        if post.pin_type == "prompt_of_week":
            settings = await self.get_settings(session, post.course_id)
            if settings is not None and settings.prompt_of_week_post_id == post.id:
                settings_repo = CommunitySettingsRepository.from_session(session)
                await settings_repo.update(
                    settings, update_dict={"prompt_of_week_post_id": None}
                )
        return updated

    # ------------------------------------------------------------------
    # Tags
    # ------------------------------------------------------------------

    async def list_tags(
        self, session: AsyncSession, course_id: UUID
    ) -> Sequence[CommunityTag]:
        repo = CommunityTagRepository.from_session(session)
        return await repo.get_by_course(course_id)

    async def get_tag_by_slug(
        self, session: AsyncSession, course_id: UUID, slug: str
    ) -> CommunityTag | None:
        repo = CommunityTagRepository.from_session(session)
        return await repo.get_by_slug(course_id, slug)

    # ------------------------------------------------------------------
    # Permission helpers — who can moderate this post / comment?
    # ------------------------------------------------------------------

    def is_creator(self, auth_subject: AuthSubject[User | Organization]) -> bool:
        """Crude check: the auth dependency already ensured the subject
        is a creator-side actor. The course-id check happens at the
        endpoint via course.repository.get_readable_by_id."""
        return True  # Type-narrow on the union; presence here = creator

    def is_post_owner(
        self,
        post: CommunityPost,
        *,
        enrollment_id: UUID | None,
        user_id: UUID | None,
    ) -> bool:
        if enrollment_id is not None and post.author_enrollment_id == enrollment_id:
            return True
        if user_id is not None and post.author_user_id == user_id:
            return True
        return False

    def is_comment_owner(
        self,
        comment: CommunityComment,
        *,
        enrollment_id: UUID | None,
        user_id: UUID | None,
    ) -> bool:
        if (
            enrollment_id is not None
            and comment.author_enrollment_id == enrollment_id
        ):
            return True
        if user_id is not None and comment.author_user_id == user_id:
            return True
        return False

    # ------------------------------------------------------------------
    # Author resolution — used by endpoints to build CommunityPostRead
    # ------------------------------------------------------------------

    async def resolve_comment_reactions(
        self,
        session: AsyncSession,
        *,
        comment_ids: set[UUID],
        viewer_enrollment_id: UUID | None,
        viewer_user_id: UUID | None,
    ) -> dict[UUID, list[CommunityReactionSummaryEntry]]:
        """Per-comment reaction summary — same shape as the per-post
        summary `build_render_context` produces. Returns
        `{comment_id: [CommunityReactionSummaryEntry, ...]}` with
        `mine=True` flagged for the viewer's own reactions.

        Bulk-loaded so a comment thread of N replies costs one query,
        not N."""
        if not comment_ids:
            return {}
        reaction_repo = CommunityReactionRepository.from_session(session)
        raw = await reaction_repo.summary_for_targets(
            target_type="comment",
            target_ids=comment_ids,
            viewer_enrollment_id=viewer_enrollment_id,
            viewer_user_id=viewer_user_id,
        )
        out: dict[UUID, list[CommunityReactionSummaryEntry]] = {}
        for comment_id, by_emoji in raw.items():
            out[comment_id] = [
                CommunityReactionSummaryEntry(
                    emoji=emoji,  # type: ignore[arg-type]
                    count=int(payload["count"]),
                    mine=bool(payload["mine"]),
                )
                for emoji, payload in by_emoji.items()
            ]
        return out

    async def resolve_authors(
        self,
        session: AsyncSession,
        *,
        enrollment_ids: set[UUID],
        user_ids: set[UUID],
    ) -> dict[tuple[Literal["enrollment", "user"], UUID], CommunityAuthor]:
        """One round-trip per author kind. Returns a dict keyed by
        ('enrollment'|'user', id) so endpoints can look up each post's
        author without N+1 queries."""
        out: dict[tuple[Literal["enrollment", "user"], UUID], CommunityAuthor] = {}

        post_repo = CommunityPostRepository.from_session(session)

        # Student authors — Customer has no avatar column today, so
        # student rows surface avatar_url=None and the UI falls back to
        # initials. Schema stays nullable so we can light it up later
        # without a client change.
        for enrollment_id, name, email in await post_repo.list_student_author_rows(
            enrollment_ids
        ):
            out[("enrollment", enrollment_id)] = CommunityAuthorStudent(
                enrollment_id=enrollment_id,
                name=_resolve_display_name(name, email),
                avatar_url=None,
            )

        # Instructor authors — User has no explicit display name distinct
        # from email; the endpoint layer may overlay course.instructor_name
        # on top, but the service surfaces the raw resolution here.
        for user_id, email, avatar_url in await post_repo.list_instructor_author_rows(
            user_ids
        ):
            out[("user", user_id)] = CommunityAuthorInstructor(
                user_id=user_id,
                name=_resolve_display_name(None, email),
                avatar_url=avatar_url,
            )

        return out

    # ------------------------------------------------------------------
    # Lesson-chip resolution — used by endpoints to build CommunityPostRead
    # ------------------------------------------------------------------

    async def resolve_lesson_chips(
        self,
        session: AsyncSession,
        lesson_ids: set[UUID],
    ) -> dict[UUID, CommunityLessonChip]:
        if not lesson_ids:
            return {}
        lesson_repo = CourseLessonRepository.from_session(session)
        lessons = await lesson_repo.get_all(
            lesson_repo.get_base_statement().where(
                lesson_repo.model.id.in_(lesson_ids)
            )
        )
        out: dict[UUID, CommunityLessonChip] = {}
        for lesson in lessons:
            out[lesson.id] = CommunityLessonChip(
                lesson_id=lesson.id,
                lesson_title=lesson.title,
                module_id=lesson.module_id,
                module_title=None,  # Phase 1: lesson title only;
                # module title resolved lazily in Phase 2 if useful.
            )
        return out

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _validate_lesson_belongs_to_course(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        lesson_id: UUID | None,
    ) -> None:
        """Lesson → module → course. Walking via module_id (rather than
        the lesson's org_id) is the only way to distinguish two courses
        owned by the same organization."""
        if lesson_id is None:
            return
        lesson_repo = CourseLessonRepository.from_session(session)
        lesson = await lesson_repo.get_by_id(lesson_id)
        if lesson is None:
            raise InvalidLessonReference()
        module_repo = CourseModuleRepository.from_session(session)
        module = await module_repo.get_by_id(lesson.module_id)
        if module is None or module.course_id != course_id:
            raise InvalidLessonReference()

    async def _validate_tag_belongs_to_course(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        tag_id: UUID | None,
    ) -> None:
        if tag_id is None:
            return
        tag_repo = CommunityTagRepository.from_session(session)
        tag = await tag_repo.get_by_id(tag_id)
        if tag is None or tag.course_id != course_id:
            raise InvalidTagReference()

    async def _resolve_comments_mode(
        self,
        session: AsyncSession,
        post: CommunityPost,
    ) -> Literal["visible", "hidden", "locked"]:
        """Post-level override wins; else fall back to the course's
        community_settings.comments_mode; default visible."""
        if post.comments_mode is not None:
            return post.comments_mode  # type: ignore[return-value]
        settings = await self.get_settings(session, post.course_id)
        if settings is None:
            return "visible"
        return settings.comments_mode  # type: ignore[return-value]

    async def build_render_context(
        self,
        session: AsyncSession,
        *,
        posts: Sequence[CommunityPost],
        viewer_enrollment_id: UUID | None,
        viewer_user_id: UUID | None,
    ) -> dict:
        """Bulk-load everything the endpoint needs to compose
        CommunityPostRead for a feed page in O(1) queries per kind."""
        if not posts:
            return {
                "authors": {},
                "lessons": {},
                "reactions": {},
            }

        enrollment_ids = {
            p.author_enrollment_id for p in posts if p.author_enrollment_id
        }
        user_ids = {p.author_user_id for p in posts if p.author_user_id}
        lesson_ids = {p.lesson_id for p in posts if p.lesson_id}
        post_ids = {p.id for p in posts}

        authors = await self.resolve_authors(
            session, enrollment_ids=enrollment_ids, user_ids=user_ids
        )
        lessons = await self.resolve_lesson_chips(session, lesson_ids)

        reactions_summary = {}
        reaction_repo = CommunityReactionRepository.from_session(session)
        raw = await reaction_repo.summary_for_targets(
            target_type="post",
            target_ids=post_ids,
            viewer_enrollment_id=viewer_enrollment_id,
            viewer_user_id=viewer_user_id,
        )
        for post_id, by_emoji in raw.items():
            entries = []
            for emoji, payload in by_emoji.items():
                entries.append(
                    CommunityReactionSummaryEntry(
                        emoji=emoji,  # type: ignore[arg-type]
                        count=int(payload["count"]),
                        mine=bool(payload["mine"]),
                    )
                )
            reactions_summary[post_id] = entries

        return {
            "authors": authors,
            "lessons": lessons,
            "reactions": reactions_summary,
        }


community = CommunityService()
