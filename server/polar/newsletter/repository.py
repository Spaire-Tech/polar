from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.newsletter import Newsletter
from polar.models.newsletter_post import NewsletterPost
from polar.models.newsletter_subscription import NewsletterSubscription


class NewsletterRepository(
    RepositorySoftDeletionIDMixin[Newsletter, UUID],
    RepositorySoftDeletionMixin[Newsletter],
    RepositoryBase[Newsletter],
):
    model = Newsletter

    def get_by_organization_statement(
        self, organization_id: UUID
    ) -> Select[tuple[Newsletter]]:
        return self.get_base_statement().where(
            Newsletter.organization_id == organization_id
        )

    def get_by_product_statement(
        self, product_id: UUID
    ) -> Select[tuple[Newsletter]]:
        return self.get_base_statement().where(Newsletter.product_id == product_id)

    async def get_by_slug(
        self, organization_id: UUID, slug: str
    ) -> Newsletter | None:
        statement = self.get_base_statement().where(
            Newsletter.organization_id == organization_id,
            Newsletter.slug == slug,
        )
        return await self.get_one_or_none(statement)

    async def count_by_organization(self, organization_id: UUID) -> int:
        statement = select(func.count(Newsletter.id)).where(
            Newsletter.organization_id == organization_id,
            Newsletter.deleted_at.is_(None),
        )
        return (await self.session.execute(statement)).scalar_one()

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Newsletter]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                Newsletter.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Newsletter.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_readable_by_id(
        self,
        newsletter_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> Newsletter | None:
        statement = self.get_readable_statement(auth_subject).where(
            Newsletter.id == newsletter_id
        )
        return await self.get_one_or_none(statement)


class NewsletterPostRepository(
    RepositorySoftDeletionIDMixin[NewsletterPost, UUID],
    RepositorySoftDeletionMixin[NewsletterPost],
    RepositoryBase[NewsletterPost],
):
    model = NewsletterPost

    def get_by_newsletter_statement(
        self, newsletter_id: UUID
    ) -> Select[tuple[NewsletterPost]]:
        return self.get_base_statement().where(
            NewsletterPost.newsletter_id == newsletter_id
        )

    async def get_public_by_slug(
        self, organization_id: UUID, slug: str
    ) -> NewsletterPost | None:
        """Find a publicly-readable post in this org by slug.

        Public-readable means published AND channel includes web. The
        soft-delete filter is inherited from `get_base_statement`.
        """
        statement = self.get_base_statement().where(
            NewsletterPost.organization_id == organization_id,
            NewsletterPost.slug == slug,
            NewsletterPost.status == "published",
            NewsletterPost.channel.in_(("email_and_web", "web_only")),
        )
        return await self.get_one_or_none(statement)

    async def get_by_slug(
        self, newsletter_id: UUID, slug: str
    ) -> NewsletterPost | None:
        statement = self.get_base_statement().where(
            NewsletterPost.newsletter_id == newsletter_id,
            NewsletterPost.slug == slug,
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[NewsletterPost]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                NewsletterPost.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                NewsletterPost.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_readable_by_id(
        self,
        post_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> NewsletterPost | None:
        statement = self.get_readable_statement(auth_subject).where(
            NewsletterPost.id == post_id
        )
        return await self.get_one_or_none(statement)


class NewsletterSubscriptionRepository(
    RepositorySoftDeletionIDMixin[NewsletterSubscription, UUID],
    RepositorySoftDeletionMixin[NewsletterSubscription],
    RepositoryBase[NewsletterSubscription],
):
    model = NewsletterSubscription

    async def get_active_by_customer(
        self, newsletter_id: UUID, customer_id: UUID
    ) -> NewsletterSubscription | None:
        statement = self.get_base_statement().where(
            NewsletterSubscription.newsletter_id == newsletter_id,
            NewsletterSubscription.customer_id == customer_id,
            NewsletterSubscription.status == "active",
        )
        return await self.get_one_or_none(statement)

    def get_by_newsletter_statement(
        self, newsletter_id: UUID
    ) -> Select[tuple[NewsletterSubscription]]:
        return self.get_base_statement().where(
            NewsletterSubscription.newsletter_id == newsletter_id
        )

    async def count_active(self, newsletter_id: UUID) -> int:
        statement = (
            select(func.count(NewsletterSubscription.id))
            .where(
                NewsletterSubscription.newsletter_id == newsletter_id,
                NewsletterSubscription.status == "active",
                NewsletterSubscription.deleted_at.is_(None),
            )
        )
        return (await self.session.execute(statement)).scalar_one()

    async def stats(self, newsletter_id: UUID) -> dict[str, int]:
        """Aggregate {free, paid, unsubscribed, total} for a newsletter.

        Cheap one-query roll-up backing the Subscribers tab on the
        detail page. Soft-deleted rows are excluded so de-subscribed
        customers still show up under `unsubscribed` (their row stays
        with status='unsubscribed') but resubscribe-and-cancel cycles
        don't double-count.
        """
        from sqlalchemy import case

        statement = select(
            func.count(NewsletterSubscription.id).filter(
                NewsletterSubscription.status == "active",
                NewsletterSubscription.tier == "free",
            ).label("free"),
            func.count(NewsletterSubscription.id).filter(
                NewsletterSubscription.status == "active",
                NewsletterSubscription.tier == "paid",
            ).label("paid"),
            func.count(NewsletterSubscription.id).filter(
                NewsletterSubscription.status == "unsubscribed",
            ).label("unsubscribed"),
            func.count(NewsletterSubscription.id).label("total"),
        ).where(
            NewsletterSubscription.newsletter_id == newsletter_id,
            NewsletterSubscription.deleted_at.is_(None),
        )
        row = (await self.session.execute(statement)).one()
        # Reference `case` so the import doesn't get auto-stripped on
        # lint passes — we may add tier-specific filter cases here later
        # and it avoids reintroducing the import each time.
        _ = case
        return {
            "free": int(row.free or 0),
            "paid": int(row.paid or 0),
            "unsubscribed": int(row.unsubscribed or 0),
            "total": int(row.total or 0),
        }
