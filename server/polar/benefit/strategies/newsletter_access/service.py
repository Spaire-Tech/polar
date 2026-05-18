from typing import Any, cast
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.models import Benefit, Customer, Member, Organization, User

from ..base.service import BenefitServiceProtocol
from .properties import (
    BenefitGrantNewsletterAccessProperties,
    BenefitNewsletterAccessProperties,
)


class BenefitNewsletterAccessService(
    BenefitServiceProtocol[
        BenefitNewsletterAccessProperties,
        BenefitGrantNewsletterAccessProperties,
    ]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantNewsletterAccessProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantNewsletterAccessProperties:
        from polar.newsletter.service import newsletter_service

        properties = self._get_properties(benefit)
        newsletter_id = UUID(properties["newsletter_id"])

        # On newsletter swap (the benefit's newsletter_id changed —
        # requires_update returned True), the existing subscription points
        # at the OLD newsletter. Tear it down before subscribing to the new
        # one so the customer doesn't keep paid access to both.
        existing_subscription_id = grant_properties.get("subscription_id")
        if update and existing_subscription_id:
            existing = await newsletter_service.get_subscription_by_id(
                self.session, UUID(existing_subscription_id)
            )
            if existing is not None and existing.newsletter_id == newsletter_id:
                return grant_properties
            if existing is not None:
                await newsletter_service.revoke_subscription(
                    self.session, existing.id
                )

        subscription = await newsletter_service.subscribe_customer(
            self.session,
            newsletter_id=newsletter_id,
            customer=customer,
            tier="paid",
        )
        return {"subscription_id": str(subscription.id)}

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantNewsletterAccessProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantNewsletterAccessProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantNewsletterAccessProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantNewsletterAccessProperties:
        from polar.newsletter.service import newsletter_service

        subscription_id_str = grant_properties.get("subscription_id")
        if subscription_id_str:
            await newsletter_service.revoke_subscription(
                self.session, UUID(subscription_id_str)
            )
        return {}

    async def requires_update(
        self,
        benefit: Benefit,
        previous_properties: BenefitNewsletterAccessProperties,
    ) -> bool:
        properties = self._get_properties(benefit)
        return properties.get("newsletter_id") != previous_properties.get(
            "newsletter_id"
        )

    async def validate_properties(
        self,
        auth_subject: AuthSubject[User | Organization],
        properties: dict[str, Any],
    ) -> BenefitNewsletterAccessProperties:
        from sqlalchemy import select

        from polar.auth.models import is_organization, is_user
        from polar.exceptions import PolarRequestValidationError
        from polar.models import UserOrganization
        from polar.newsletter.service import newsletter_service

        newsletter_id_raw = properties.get("newsletter_id")
        if not newsletter_id_raw:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "properties", "newsletter_id"),
                        "msg": "Newsletter id is required",
                        "input": newsletter_id_raw,
                    }
                ]
            )
        try:
            newsletter_id = UUID(str(newsletter_id_raw))
        except (TypeError, ValueError) as exc:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "properties", "newsletter_id"),
                        "msg": "Invalid newsletter id",
                        "input": newsletter_id_raw,
                    }
                ]
            ) from exc

        newsletter = await newsletter_service.get_by_id(
            self.session, newsletter_id
        )
        if newsletter is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "properties", "newsletter_id"),
                        "msg": "Newsletter not found",
                        "input": newsletter_id_raw,
                    }
                ]
            )

        # Same-org check, mirrors course_access.
        if is_organization(auth_subject):
            if newsletter.organization_id != auth_subject.subject.id:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "properties", "newsletter_id"),
                            "msg": "Newsletter does not belong to this organization",
                            "input": newsletter_id_raw,
                        }
                    ]
                )
        elif is_user(auth_subject):
            stmt = select(UserOrganization).where(
                UserOrganization.user_id == auth_subject.subject.id,
                UserOrganization.organization_id == newsletter.organization_id,
                UserOrganization.deleted_at.is_(None),
            )
            result = await self.session.execute(stmt)
            if result.first() is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "properties", "newsletter_id"),
                            "msg": "Newsletter does not belong to this organization",
                            "input": newsletter_id_raw,
                        }
                    ]
                )

        return cast(BenefitNewsletterAccessProperties, properties)
