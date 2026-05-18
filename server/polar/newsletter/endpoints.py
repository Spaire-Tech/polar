import logging
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select

from polar.auth.models import is_organization, is_user
from polar.models import UserOrganization
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .repository import (
    NewsletterPostRepository,
    NewsletterRepository,
)
from .schemas import (
    NewsletterCreate,
    NewsletterPostCreate,
    NewsletterPostRead,
    NewsletterPostUpdate,
    NewsletterRead,
    NewsletterUpdate,
)
from .service import (
    NewsletterPostAlreadyPublished,
    newsletter_service,
)

log = logging.getLogger(__name__)

router = APIRouter(
    prefix="/newsletters",
    tags=["newsletters", APITag.private],
)


def _newsletter_read(newsletter) -> NewsletterRead:
    return NewsletterRead(
        id=newsletter.id,
        organization_id=newsletter.organization_id,
        product_id=newsletter.product_id,
        name=newsletter.name,
        slug=newsletter.slug,
        masthead=newsletter.masthead,
        description=newsletter.description,
        cover_url=newsletter.cover_url,
        default_sender_name=newsletter.default_sender_name,
        default_sender_email=newsletter.default_sender_email,
        default_reply_to_email=newsletter.default_reply_to_email,
        theme=newsletter.theme or {},
        created_at=newsletter.created_at,
        modified_at=newsletter.modified_at,
    )


def _post_read(post) -> NewsletterPostRead:
    return NewsletterPostRead(
        id=post.id,
        newsletter_id=post.newsletter_id,
        organization_id=post.organization_id,
        title=post.title,
        subtitle=post.subtitle,
        slug=post.slug,
        cover_url=post.cover_url,
        cover_visible=post.cover_visible,
        tags=list(post.tags or []),
        content_json=post.content_json,
        content_html=post.content_html,
        theme_overrides=post.theme_overrides,
        channel=post.channel,
        send_mode=post.send_mode,
        scheduled_at=post.scheduled_at,
        audience_tier=post.audience_tier,
        audience_segment_id=post.audience_segment_id,
        audience_filter_rules=post.audience_filter_rules,
        subject_override=post.subject_override,
        preview_text_override=post.preview_text_override,
        show_socials=post.show_socials,
        show_likes_comments=post.show_likes_comments,
        custom_read_online_url=post.custom_read_online_url,
        audio_enabled=post.audio_enabled,
        audio_url=post.audio_url,
        web_thumbnail_url=post.web_thumbnail_url,
        web_thumbnail_on_top=post.web_thumbnail_on_top,
        seo_meta_title=post.seo_meta_title,
        seo_meta_description=post.seo_meta_description,
        status=post.status,
        published_at=post.published_at,
        broadcast_id=post.broadcast_id,
        created_at=post.created_at,
        modified_at=post.modified_at,
    )


async def _user_in_org(
    session: AsyncSession, user_id: UUID, organization_id: UUID
) -> bool:
    stmt = select(UserOrganization).where(
        UserOrganization.user_id == user_id,
        UserOrganization.organization_id == organization_id,
        UserOrganization.deleted_at.is_(None),
    )
    res = await session.execute(stmt)
    return res.first() is not None


# ---- Newsletter routes ---------------------------------------------


@router.get(
    "/organization/{organization_id}", response_model=list[NewsletterRead]
)
async def list_newsletters_by_organization(
    organization_id: UUID,
    auth_subject: auth.NewslettersRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[NewsletterRead]:
    if is_organization(auth_subject):
        if auth_subject.subject.id != organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await _user_in_org(
            session, auth_subject.subject.id, organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
    newsletters = await newsletter_service.list_by_organization(
        session, organization_id
    )
    return [_newsletter_read(n) for n in newsletters]


@router.get("/{newsletter_id}", response_model=NewsletterRead)
async def get_newsletter(
    newsletter_id: UUID,
    auth_subject: auth.NewslettersRead,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterRead:
    repo = NewsletterRepository.from_session(session)
    newsletter = await repo.get_readable_by_id(newsletter_id, auth_subject)
    if newsletter is None:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    return _newsletter_read(newsletter)


@router.post("/", response_model=NewsletterRead, status_code=201)
async def create_newsletter(
    newsletter_create: NewsletterCreate,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterRead:
    if is_organization(auth_subject):
        if auth_subject.subject.id != newsletter_create.organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await _user_in_org(
            session,
            auth_subject.subject.id,
            newsletter_create.organization_id,
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
    try:
        newsletter = await newsletter_service.create(session, newsletter_create)
        return _newsletter_read(newsletter)
    except Exception:
        log.exception(
            "newsletter.create failed",
            extra={"organization_id": str(newsletter_create.organization_id)},
        )
        raise


@router.patch("/{newsletter_id}", response_model=NewsletterRead)
async def update_newsletter(
    newsletter_id: UUID,
    newsletter_update: NewsletterUpdate,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterRead:
    repo = NewsletterRepository.from_session(session)
    newsletter = await repo.get_readable_by_id(newsletter_id, auth_subject)
    if newsletter is None:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    newsletter = await newsletter_service.update(
        session, newsletter, newsletter_update
    )
    return _newsletter_read(newsletter)


@router.delete("/{newsletter_id}", status_code=204)
async def delete_newsletter(
    newsletter_id: UUID,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repo = NewsletterRepository.from_session(session)
    newsletter = await repo.get_readable_by_id(newsletter_id, auth_subject)
    if newsletter is None:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    await newsletter_service.delete(session, newsletter)


# ---- Post routes -----------------------------------------------------


@router.get(
    "/{newsletter_id}/posts", response_model=list[NewsletterPostRead]
)
async def list_posts(
    newsletter_id: UUID,
    auth_subject: auth.NewslettersRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[NewsletterPostRead]:
    repo = NewsletterRepository.from_session(session)
    newsletter = await repo.get_readable_by_id(newsletter_id, auth_subject)
    if newsletter is None:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    posts = await newsletter_service.list_posts(session, newsletter_id)
    return [_post_read(p) for p in posts]


@router.get("/posts/{post_id}", response_model=NewsletterPostRead)
async def get_post(
    post_id: UUID,
    auth_subject: auth.NewslettersRead,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterPostRead:
    repo = NewsletterPostRepository.from_session(session)
    post = await repo.get_readable_by_id(post_id, auth_subject)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_read(post)


@router.post("/posts", response_model=NewsletterPostRead, status_code=201)
async def create_post(
    post_create: NewsletterPostCreate,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterPostRead:
    newsletter_repo = NewsletterRepository.from_session(session)
    newsletter = await newsletter_repo.get_readable_by_id(
        post_create.newsletter_id, auth_subject
    )
    if newsletter is None:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    post = await newsletter_service.create_post(session, newsletter, post_create)
    return _post_read(post)


@router.patch("/posts/{post_id}", response_model=NewsletterPostRead)
async def update_post(
    post_id: UUID,
    post_update: NewsletterPostUpdate,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterPostRead:
    repo = NewsletterPostRepository.from_session(session)
    post = await repo.get_readable_by_id(post_id, auth_subject)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    post = await newsletter_service.update_post(session, post, post_update)
    return _post_read(post)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(
    post_id: UUID,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repo = NewsletterPostRepository.from_session(session)
    post = await repo.get_readable_by_id(post_id, auth_subject)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    await newsletter_service.delete_post(session, post)


@router.post("/posts/{post_id}/publish", response_model=NewsletterPostRead)
async def publish_post(
    post_id: UUID,
    auth_subject: auth.NewslettersWrite,
    session: AsyncSession = Depends(get_db_session),
) -> NewsletterPostRead:
    repo = NewsletterPostRepository.from_session(session)
    post = await repo.get_readable_by_id(post_id, auth_subject)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    try:
        post = await newsletter_service.publish_post(session, post)
    except NewsletterPostAlreadyPublished as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _post_read(post)
