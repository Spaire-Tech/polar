"""HTTP routes for the Community feed.

Two routers in one file so the module's HTTP surface lives in one place:

  creator_router  — mounted at /v1/community/{course_id}/...
                    Auth: CommunityCreatorRead/Write (web + product scopes;
                    Same as the course editor).

  customer_router — mounted at /v1/customer-portal/community/{course_id}/...
                    Auth: CommunityCustomerRead/Write (customer-portal
                    session token or seat-claimed member).

Both routers register on polar.api in Chunk 5's same commit.
"""

from collections.abc import Iterable
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, HTTPException, Query, UploadFile
from fastapi import File as FastAPIFile
from pydantic import UUID4

from polar.auth.models import (
    is_user,
)
from polar.course.repository import CourseRepository
from polar.customer_portal.utils import get_customer_id
from polar.file.s3 import S3_SERVICES
from polar.kit.pagination import ListResourceWithCursorPagination
from polar.models.community_comment import CommunityComment
from polar.models.community_post import CommunityPost
from polar.models.file import FileServiceTypes
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .auth import (
    CommunityCreatorRead,
    CommunityCreatorWrite,
    CommunityCustomerRead,
    CommunityCustomerWrite,
)
from .repository import CommunityTagRepository
from .schemas import (
    CommunityAuthor,
    CommunityAuthorInstructor,
    CommunityAuthorStudent,
    CommunityCommentCreate,
    CommunityCommentRead,
    CommunityCourseSummary,
    CommunityLessonChip,
    CommunityPinPayload,
    CommunityPostCreate,
    CommunityPostImageUploadResult,
    CommunityPostMediaRead,
    CommunityPostRead,
    CommunityReactionSummaryEntry,
    CommunityReactionToggle,
    CommunityReactionToggleResult,
    CommunitySettingsRead,
    CommunitySettingsUpdate,
    CommunityTagCreate,
    CommunityTagRead,
    CommunityTagReorderRequest,
    CommunityTagUpdate,
)
from .service import community as community_service
from .sorting import CommunityPostSortProperty

# ---------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------

creator_router = APIRouter(
    prefix="/community",
    tags=["community"],
)

customer_router = APIRouter(
    prefix="/customer-portal/community",
    tags=["customer_portal_community", APITag.public],
)


# ---------------------------------------------------------------------
# Path params
# ---------------------------------------------------------------------

CourseID = Annotated[UUID4, ...]
PostID = Annotated[UUID4, ...]
CommentID = Annotated[UUID4, ...]


# ---------------------------------------------------------------------
# Helpers — render-context → response schemas
# ---------------------------------------------------------------------


def _author_for_post(
    post: CommunityPost,
    authors: dict[tuple[Literal["enrollment", "user"], UUID], CommunityAuthor],
) -> CommunityAuthor:
    """Look up the resolved author from the bulk-load map. Falls back to
    a synthetic 'unknown' author if the underlying row was deleted
    between page-fetch and now."""
    if post.author_enrollment_id is not None:
        resolved = authors.get(("enrollment", post.author_enrollment_id))
        if resolved is not None:
            return resolved
        return CommunityAuthorStudent(
            enrollment_id=post.author_enrollment_id,
            name=None,
            avatar_url=None,
        )
    # author_user_id is non-null per the CHECK constraint.
    assert post.author_user_id is not None
    resolved = authors.get(("user", post.author_user_id))
    if resolved is not None:
        return resolved
    return CommunityAuthorInstructor(
        user_id=post.author_user_id,
        name=None,
        avatar_url=None,
    )


def _author_for_comment(
    comment: CommunityComment,
    authors: dict[tuple[Literal["enrollment", "user"], UUID], CommunityAuthor],
) -> CommunityAuthor:
    if comment.author_enrollment_id is not None:
        resolved = authors.get(("enrollment", comment.author_enrollment_id))
        if resolved is not None:
            return resolved
        return CommunityAuthorStudent(
            enrollment_id=comment.author_enrollment_id,
            name=None,
            avatar_url=None,
        )
    assert comment.author_user_id is not None
    resolved = authors.get(("user", comment.author_user_id))
    if resolved is not None:
        return resolved
    return CommunityAuthorInstructor(
        user_id=comment.author_user_id,
        name=None,
        avatar_url=None,
    )


def _media_to_read(post: CommunityPost) -> list[CommunityPostMediaRead]:
    # The CommunityPostMedia.file relationship is selectin so this
    # loop is N+0 across the feed page — the file rows came in with
    # the post's media row in the original SELECT.
    out: list[CommunityPostMediaRead] = []
    for m in post.media:
        public_url: str | None = None
        if m.media_type == "image" and m.file is not None and m.file.is_uploaded:
            public_url = S3_SERVICES[
                FileServiceTypes.community_post_image
            ].get_public_url(m.file.path)
        out.append(
            CommunityPostMediaRead(
                id=m.id,
                media_type=m.media_type,  # type: ignore[arg-type]
                position=m.position,
                file_id=m.file_id,
                public_url=public_url,
                mux_playback_id=m.mux_playback_id,
                mux_status=m.mux_status,
                duration_seconds=m.duration_seconds,
                thumbnail_url=m.thumbnail_url,
            )
        )
    return out


def _post_to_read(
    post: CommunityPost,
    *,
    author: CommunityAuthor,
    lesson_chip: CommunityLessonChip | None,
    reactions: list[CommunityReactionSummaryEntry],
) -> CommunityPostRead:
    return CommunityPostRead(
        id=post.id,
        course_id=post.course_id,
        type=post.type,  # type: ignore[arg-type]
        title=post.title,
        body=post.body,
        body_format=post.body_format,  # type: ignore[arg-type]
        author=author,
        lesson=lesson_chip,
        tag=(
            CommunityTagRead.model_validate(post.tag, from_attributes=True)
            if post.tag is not None
            else None
        ),
        media=_media_to_read(post),
        published_at=post.published_at,
        pinned_at=post.pinned_at,
        pin_type=post.pin_type,  # type: ignore[arg-type]
        pin_expires_at=post.pin_expires_at,
        comments_mode=post.comments_mode,  # type: ignore[arg-type]
        reaction_count=post.reaction_count,
        comment_count=post.comment_count,
        reactions=reactions,
        created_at=post.created_at,
        modified_at=post.modified_at,
    )


async def _render_single_post(
    session: AsyncSession,
    post: CommunityPost,
    *,
    viewer_enrollment_id: UUID | None,
    viewer_user_id: UUID | None,
) -> CommunityPostRead:
    """Single-post variant of the feed's bulk render. Used by create /
    update / pin so the client gets the same shape back."""
    ctx = await community_service.build_render_context(
        session,
        posts=[post],
        viewer_enrollment_id=viewer_enrollment_id,
        viewer_user_id=viewer_user_id,
    )
    return _post_to_read(
        post,
        author=_author_for_post(post, ctx["authors"]),
        lesson_chip=ctx["lessons"].get(post.lesson_id) if post.lesson_id else None,
        reactions=ctx["reactions"].get(post.id, []),
    )


# ---------------------------------------------------------------------
# Creator authorization helpers — endpoint-side course-readability
# guard. The auth dependency confirms scope; this confirms the actor
# can see the course in question (and therefore its community).
# ---------------------------------------------------------------------


async def _require_creator_owns_course(
    session: AsyncSession,
    course_id: UUID,
    auth_subject,
) -> None:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")


# ====================================================================
# CREATOR ROUTES — /v1/community/...
# ====================================================================


@creator_router.get(
    "/{course_id}/settings",
    response_model=CommunitySettingsRead,
    summary="Get Community Settings",
)
async def get_settings_creator(
    course_id: CourseID,
    auth_subject: CommunityCreatorRead,
    session: AsyncSession = Depends(get_db_session),
) -> CommunitySettingsRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    settings = await community_service.get_or_create_settings(session, course_id)
    return CommunitySettingsRead.model_validate(settings, from_attributes=True)


@creator_router.patch(
    "/{course_id}/settings",
    response_model=CommunitySettingsRead,
    summary="Update Community Settings",
)
async def update_settings_creator(
    course_id: CourseID,
    payload: CommunitySettingsUpdate,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunitySettingsRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    settings = await community_service.update_settings(
        session, course_id=course_id, payload=payload
    )
    return CommunitySettingsRead.model_validate(settings, from_attributes=True)


@creator_router.get(
    "/{course_id}/posts",
    response_model=ListResourceWithCursorPagination[CommunityPostRead],
    summary="List Community Posts (Creator / Moderation)",
)
async def list_posts_creator(
    course_id: CourseID,
    auth_subject: CommunityCreatorRead,
    session: AsyncSession = Depends(get_db_session),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
) -> ListResourceWithCursorPagination[CommunityPostRead]:
    await _require_creator_owns_course(session, course_id, auth_subject)
    posts, has_next, ctx = await community_service.list_for_moderation(
        session, course_id=course_id, cursor=cursor, limit=limit
    )
    items = [
        _post_to_read(
            p,
            author=_author_for_post(p, ctx["authors"]),
            lesson_chip=ctx["lessons"].get(p.lesson_id) if p.lesson_id else None,
            reactions=ctx["reactions"].get(p.id, []),
        )
        for p in posts
    ]
    return ListResourceWithCursorPagination.from_results(
        items, has_next_page=has_next
    )


@creator_router.get(
    "/{course_id}/tags",
    response_model=list[CommunityTagRead],
    summary="List Community Tags (Creator)",
)
async def list_tags_creator(
    course_id: CourseID,
    auth_subject: CommunityCreatorRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityTagRead]:
    await _require_creator_owns_course(session, course_id, auth_subject)
    tags = await community_service.list_tags(session, course_id)
    return [CommunityTagRead.model_validate(t, from_attributes=True) for t in tags]


@creator_router.post(
    "/{course_id}/tags",
    response_model=CommunityTagRead,
    status_code=201,
    summary="Create Community Tag",
)
async def create_tag(
    course_id: CourseID,
    payload: CommunityTagCreate,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityTagRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    tag = await community_service.create_tag(
        session,
        course_id=course_id,
        label=payload.label,
        slug=payload.slug,
    )
    return CommunityTagRead.model_validate(tag, from_attributes=True)


@creator_router.patch(
    "/{course_id}/tags/{tag_id}",
    response_model=CommunityTagRead,
    summary="Update Community Tag",
)
async def update_tag(
    course_id: CourseID,
    tag_id: Annotated[UUID4, ...],
    payload: CommunityTagUpdate,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityTagRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    tag_repo = CommunityTagRepository.from_session(session)
    tag = await tag_repo.get_by_id(tag_id)
    if tag is None or tag.course_id != course_id:
        raise HTTPException(status_code=404, detail="Tag not found")
    updated = await community_service.update_tag(
        session, tag=tag, label=payload.label, position=payload.position
    )
    return CommunityTagRead.model_validate(updated, from_attributes=True)


@creator_router.delete(
    "/{course_id}/tags/{tag_id}",
    status_code=204,
    summary="Delete Community Tag",
)
async def delete_tag(
    course_id: CourseID,
    tag_id: Annotated[UUID4, ...],
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await _require_creator_owns_course(session, course_id, auth_subject)
    tag_repo = CommunityTagRepository.from_session(session)
    tag = await tag_repo.get_by_id(tag_id)
    if tag is None or tag.course_id != course_id:
        raise HTTPException(status_code=404, detail="Tag not found")
    await community_service.delete_tag(session, tag=tag)


@creator_router.post(
    "/{course_id}/tags/reorder",
    response_model=list[CommunityTagRead],
    summary="Reorder Community Tags",
)
async def reorder_tags(
    course_id: CourseID,
    payload: CommunityTagReorderRequest,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityTagRead]:
    await _require_creator_owns_course(session, course_id, auth_subject)
    tags = await community_service.reorder_tags(
        session, course_id=course_id, ordered_ids=payload.ordered_ids
    )
    return [CommunityTagRead.model_validate(t, from_attributes=True) for t in tags]


@creator_router.post(
    "/{course_id}/posts/{post_id}/pin",
    response_model=CommunityPostRead,
    summary="Pin Community Post",
)
async def pin_post(
    course_id: CourseID,
    post_id: PostID,
    payload: CommunityPinPayload,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityPostRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")
    updated = await community_service.pin_post(
        session, post=post, payload=payload
    )
    viewer_user_id = (
        auth_subject.subject.id if is_user(auth_subject) else None
    )
    return await _render_single_post(
        session,
        updated,
        viewer_enrollment_id=None,
        viewer_user_id=viewer_user_id,
    )


@creator_router.delete(
    "/{course_id}/posts/{post_id}/pin",
    response_model=CommunityPostRead,
    summary="Unpin Community Post",
)
async def unpin_post(
    course_id: CourseID,
    post_id: PostID,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityPostRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")
    updated = await community_service.unpin_post(session, post)
    viewer_user_id = (
        auth_subject.subject.id if is_user(auth_subject) else None
    )
    return await _render_single_post(
        session,
        updated,
        viewer_enrollment_id=None,
        viewer_user_id=viewer_user_id,
    )


@creator_router.delete(
    "/{course_id}/posts/{post_id}",
    status_code=204,
    summary="Moderator-delete Community Post",
)
async def delete_post_creator(
    course_id: CourseID,
    post_id: PostID,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await _require_creator_owns_course(session, course_id, auth_subject)
    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")
    await community_service.soft_delete_post(session, post)


@creator_router.delete(
    "/{course_id}/comments/{comment_id}",
    status_code=204,
    summary="Moderator-delete Community Comment",
)
async def delete_comment_creator(
    course_id: CourseID,
    comment_id: CommentID,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await _require_creator_owns_course(session, course_id, auth_subject)
    comment = await community_service.get_comment(session, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    # Cross-check: the comment's post is in this course.
    post = await community_service.get_post(session, comment.post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    await community_service.soft_delete_comment(session, comment=comment)


# ====================================================================
# CUSTOMER-PORTAL ROUTES — /v1/customer-portal/community/...
# ====================================================================


@customer_router.get(
    "/courses",
    response_model=list[CommunityCourseSummary],
    summary="List Communities Available to Customer",
)
async def list_customer_communities(
    auth_subject: CommunityCustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityCourseSummary]:
    """Powers the /portal/community picker. Returns one entry per
    enrolled course with `community_enabled` flagged from
    community_settings, so the picker UI can filter to courses whose
    creator has actually turned the feed on."""
    customer_id = get_customer_id(auth_subject)
    rows = await community_service.list_customer_communities(
        session, customer_id=customer_id
    )
    return list(rows)


@customer_router.get(
    "/{course_id}/settings",
    response_model=CommunitySettingsRead,
    summary="Get Community Settings (Customer Portal)",
)
async def get_settings_customer(
    course_id: CourseID,
    auth_subject: CommunityCustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> CommunitySettingsRead:
    customer_id = get_customer_id(auth_subject)
    await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    # Lazy-create the row so a student visiting before the creator
    # ever opened the editor tab sees `enabled=False` and the
    # "disabled" banner — not a 403 the frontend has no path for. The
    # row defaults to `enabled=False`, so this is a no-op from the
    # student's perspective until the creator flips the toggle.
    settings = await community_service.get_or_create_settings(
        session, course_id
    )
    return CommunitySettingsRead.model_validate(settings, from_attributes=True)


@customer_router.get(
    "/{course_id}/tags",
    response_model=list[CommunityTagRead],
    summary="List Community Tags",
)
async def list_tags_customer(
    course_id: CourseID,
    auth_subject: CommunityCustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityTagRead]:
    customer_id = get_customer_id(auth_subject)
    await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)
    tags = await community_service.list_tags(session, course_id)
    return [CommunityTagRead.model_validate(t, from_attributes=True) for t in tags]


@customer_router.get(
    "/{course_id}/feed",
    response_model=ListResourceWithCursorPagination[CommunityPostRead],
    summary="List Community Feed (Customer Portal)",
)
async def list_feed_customer(
    course_id: CourseID,
    auth_subject: CommunityCustomerRead,
    session: AsyncSession = Depends(get_db_session),
    sort: CommunityPostSortProperty = CommunityPostSortProperty.recent,
    module_id: UUID4 | None = Query(default=None),
    lesson_id: UUID4 | None = Query(default=None),
    tag_id: UUID4 | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
) -> ListResourceWithCursorPagination[CommunityPostRead]:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)

    posts, has_next, ctx = await community_service.list_feed(
        session,
        course_id=course_id,
        sort=sort,
        module_id=module_id,
        lesson_id=lesson_id,
        tag_id=tag_id,
        cursor=cursor,
        limit=limit,
        viewer_enrollment_id=enrollment.id,
        viewer_user_id=None,
    )

    items = [
        _post_to_read(
            p,
            author=_author_for_post(p, ctx["authors"]),
            lesson_chip=ctx["lessons"].get(p.lesson_id) if p.lesson_id else None,
            reactions=ctx["reactions"].get(p.id, []),
        )
        for p in posts
    ]
    return ListResourceWithCursorPagination.from_results(
        items, has_next_page=has_next
    )


@customer_router.post(
    "/{course_id}/media/upload",
    response_model=CommunityPostImageUploadResult,
    status_code=201,
    summary="Upload Community Post Image",
)
async def upload_post_image(
    course_id: CourseID,
    auth_subject: CommunityCustomerWrite,
    file: UploadFile = FastAPIFile(...),
    session: AsyncSession = Depends(get_db_session),
) -> CommunityPostImageUploadResult:
    """Server-proxied image upload for the composer. Students don't
    carry an org-write scope and so can't use the standard
    /v1/files/ presigned flow — the bytes go through the server,
    land in the community-post bucket, and a File row is created
    owned by the course's organization. The returned file_id is
    passed back in the POST /posts payload's `media[]`."""
    customer_id = get_customer_id(auth_subject)
    await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)

    content_type = file.content_type or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image.",
        )

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be under 10 MB.",
        )

    return await community_service.upload_post_image(
        session,
        course_id=course_id,
        filename=file.filename or "image",
        data=data,
        mime_type=content_type,
    )


@customer_router.post(
    "/{course_id}/posts",
    response_model=CommunityPostRead,
    status_code=201,
    summary="Create Community Post",
)
async def create_post_customer(
    course_id: CourseID,
    payload: CommunityPostCreate,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityPostRead:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)

    post = await community_service.create_post(
        session,
        course_id=course_id,
        author_enrollment_id=enrollment.id,
        payload=payload,
    )
    return await _render_single_post(
        session,
        post,
        viewer_enrollment_id=enrollment.id,
        viewer_user_id=None,
    )


@customer_router.delete(
    "/{course_id}/posts/{post_id}",
    status_code=204,
    summary="Delete Own Community Post",
)
async def delete_post_customer(
    course_id: CourseID,
    post_id: PostID,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")
    if not community_service.is_post_owner(
        post, enrollment_id=enrollment.id, user_id=None
    ):
        raise HTTPException(status_code=403, detail="Not your post")
    await community_service.soft_delete_post(session, post)


@customer_router.get(
    "/{course_id}/posts/{post_id}/comments",
    response_model=list[CommunityCommentRead],
    summary="List Community Post Comments",
)
async def list_comments_customer(
    course_id: CourseID,
    post_id: PostID,
    auth_subject: CommunityCustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityCommentRead]:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)

    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = await community_service.list_comments(session, post=post)
    return await _serialize_comments(
        session, comments, viewer_enrollment_id=enrollment.id
    )


@customer_router.post(
    "/{course_id}/posts/{post_id}/comments",
    response_model=CommunityCommentRead,
    status_code=201,
    summary="Create Comment on Community Post",
)
async def create_comment_customer(
    course_id: CourseID,
    post_id: PostID,
    payload: CommunityCommentCreate,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityCommentRead:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)

    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = await community_service.create_comment(
        session,
        post=post,
        author_enrollment_id=enrollment.id,
        payload=payload,
    )
    serialized = await _serialize_comments(
        session, [comment], viewer_enrollment_id=enrollment.id
    )
    return serialized[0]


@customer_router.delete(
    "/{course_id}/comments/{comment_id}",
    status_code=204,
    summary="Delete Own Comment",
)
async def delete_comment_customer(
    course_id: CourseID,
    comment_id: CommentID,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    comment = await community_service.get_comment(session, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    post = await community_service.get_post(session, comment.post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if not community_service.is_comment_owner(
        comment, enrollment_id=enrollment.id, user_id=None
    ):
        raise HTTPException(status_code=403, detail="Not your comment")
    await community_service.soft_delete_comment(session, comment=comment)


@customer_router.post(
    "/{course_id}/posts/{post_id}/react",
    response_model=CommunityReactionToggleResult,
    summary="Toggle Reaction on Community Post",
)
async def react_to_post_customer(
    course_id: CourseID,
    post_id: PostID,
    payload: CommunityReactionToggle,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityReactionToggleResult:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    settings = await community_service.assert_community_enabled(session, course_id)
    if not settings.reactions_enabled:
        raise HTTPException(status_code=403, detail="Reactions are disabled")

    post = await community_service.get_post(session, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Post not found")

    active, count = await community_service.toggle_reaction(
        session,
        target_type="post",
        target_id=post.id,
        actor_enrollment_id=enrollment.id,
        emoji=payload.emoji,
    )
    return CommunityReactionToggleResult(
        emoji=payload.emoji, active=active, count=count
    )


@customer_router.post(
    "/{course_id}/comments/{comment_id}/react",
    response_model=CommunityReactionToggleResult,
    summary="Toggle Reaction on Community Comment",
)
async def react_to_comment_customer(
    course_id: CourseID,
    comment_id: CommentID,
    payload: CommunityReactionToggle,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityReactionToggleResult:
    customer_id = get_customer_id(auth_subject)
    enrollment = await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    settings = await community_service.assert_community_enabled(session, course_id)
    if not settings.reactions_enabled:
        raise HTTPException(status_code=403, detail="Reactions are disabled")

    comment = await community_service.get_comment(session, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    post = await community_service.get_post(session, comment.post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    active, count = await community_service.toggle_reaction(
        session,
        target_type="comment",
        target_id=comment.id,
        actor_enrollment_id=enrollment.id,
        emoji=payload.emoji,
    )
    return CommunityReactionToggleResult(
        emoji=payload.emoji, active=active, count=count
    )


# ---------------------------------------------------------------------
# Comment serialization helper (used by list + create)
# ---------------------------------------------------------------------


async def _serialize_comments(
    session: AsyncSession,
    comments: Iterable[CommunityComment],
    *,
    viewer_enrollment_id: UUID | None = None,
    viewer_user_id: UUID | None = None,
) -> list[CommunityCommentRead]:
    comments = list(comments)
    if not comments:
        return []

    enrollment_ids = {
        c.author_enrollment_id for c in comments if c.author_enrollment_id
    }
    user_ids = {c.author_user_id for c in comments if c.author_user_id}
    authors = await community_service.resolve_authors(
        session,
        enrollment_ids=enrollment_ids,
        user_ids=user_ids,
    )

    # Bulk-load reactions for every comment in this batch. Soft-deleted
    # rows still get their reaction row queried — cheap and means the
    # tombstone shows the same surface as the live comment.
    comment_reactions = await community_service.resolve_comment_reactions(
        session,
        comment_ids={c.id for c in comments},
        viewer_enrollment_id=viewer_enrollment_id,
        viewer_user_id=viewer_user_id,
    )

    out: list[CommunityCommentRead] = []
    for c in comments:
        is_deleted = c.deleted_at is not None
        own = False
        if viewer_enrollment_id is not None:
            own = c.author_enrollment_id == viewer_enrollment_id and not is_deleted
        elif viewer_user_id is not None:
            own = c.author_user_id == viewer_user_id and not is_deleted
        out.append(
            CommunityCommentRead(
                id=c.id,
                post_id=c.post_id,
                parent_id=c.parent_id,
                author=_author_for_comment(c, authors),
                # Soft-deleted comments come back as tombstones — strip
                # the body so the deleted message itself isn't surfaced.
                content="" if is_deleted else c.content,
                timestamp_seconds=c.timestamp_seconds,
                deleted=is_deleted,
                is_own=own,
                reactions=comment_reactions.get(c.id, []),
                created_at=c.created_at,
                modified_at=c.modified_at,
            )
        )
    return out
