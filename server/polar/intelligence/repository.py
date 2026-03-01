"""
All database queries for the intelligence module live here.
Services call into this repository; no SQLAlchemy in service.py.
"""

from datetime import date

from sqlalchemy import func, select

from polar.auth.models import AuthSubject, User, Organization, is_organization, is_user
from polar.models import Order, Product, Subscription, UserOrganization
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncReadSession


class IntelligenceRepository:
    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    async def get_product_revenue(
        self,
        auth_subject: AuthSubject[User | Organization],
        start: date,
        end: date,
    ) -> list[dict]:
        """Sum paid order revenue grouped by product for the given period."""
        stmt = (
            select(
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                func.coalesce(
                    func.sum(Order.subtotal_amount - Order.discount_amount), 0
                ).label("revenue"),
                func.count(Order.id).label("order_count"),
            )
            .join(Product, Product.id == Order.product_id)
            .where(
                Order.status == OrderStatus.paid,
                Order.created_at >= start,
                Order.created_at < end,
                Order.deleted_at.is_(None),
            )
        )
        stmt = self._apply_org_filter(stmt, auth_subject)
        stmt = stmt.group_by(Product.id, Product.name)

        rows = (await self.session.execute(stmt)).all()
        return [
            {
                "product_id": str(r.product_id),
                "name": r.product_name,
                "revenue": r.revenue,
                "count": r.order_count,
            }
            for r in rows
        ]

    async def get_cancellation_breakdown(
        self,
        auth_subject: AuthSubject[User | Organization],
        start: date,
        end: date,
    ) -> list[dict]:
        """Count cancellations and MRR lost, grouped by product."""
        stmt = (
            select(
                Product.name.label("product_name"),
                func.count(Subscription.id).label("canceled_count"),
                func.coalesce(func.sum(Subscription.amount), 0).label("mrr_lost"),
            )
            .join(Product, Product.id == Subscription.product_id)
            .where(
                Subscription.status == SubscriptionStatus.canceled,
                Subscription.ended_at >= start,
                Subscription.ended_at < end,
                Subscription.deleted_at.is_(None),
            )
        )
        stmt = self._apply_org_filter(stmt, auth_subject)
        stmt = stmt.group_by(Product.name).order_by(
            func.sum(Subscription.amount).desc()
        )

        rows = (await self.session.execute(stmt)).all()
        return [
            {
                "name": r.product_name,
                "canceled_count": r.canceled_count,
                "mrr_lost_cents": r.mrr_lost,
            }
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Auth-aware filter (shared by all queries that join through Product)
    # ------------------------------------------------------------------

    def _apply_org_filter(
        self, stmt, auth_subject: AuthSubject[User | Organization]
    ):
        """Scope any statement to the authenticated organization via Product.organization_id."""
        if is_user(auth_subject):
            return stmt.join(
                UserOrganization,
                UserOrganization.organization_id == Product.organization_id,
            ).where(UserOrganization.user_id == auth_subject.subject.id)
        elif is_organization(auth_subject):
            return stmt.where(Product.organization_id == auth_subject.subject.id)
        return stmt
