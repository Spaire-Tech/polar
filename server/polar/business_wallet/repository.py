from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import FinancialAccount, IssuingCard
from polar.models.financial_account import FinancialAccountStatus
from polar.models.issuing_card import IssuingCardStatus
from polar.models.treasury_transaction import TreasuryTransaction

from .sorting import TreasuryTransactionSortProperty


class FinancialAccountRepository(RepositoryBase[FinancialAccount]):
    model = FinancialAccount

    async def get_by_organization(
        self, organization_id: UUID
    ) -> FinancialAccount | None:
        statement = self.get_base_statement().where(
            FinancialAccount.organization_id == organization_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_stripe_id(
        self, stripe_financial_account_id: str
    ) -> FinancialAccount | None:
        statement = self.get_base_statement().where(
            FinancialAccount.stripe_financial_account_id
            == stripe_financial_account_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_connected_account(
        self, stripe_connected_account_id: str
    ) -> FinancialAccount | None:
        statement = self.get_base_statement().where(
            FinancialAccount.stripe_connected_account_id
            == stripe_connected_account_id,
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[FinancialAccount]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            from polar.models import Organization

            user = auth_subject.subject
            statement = statement.join(
                Organization,
                FinancialAccount.organization_id == Organization.id,
            ).where(
                Organization.id.in_(
                    # User must be a member of the organization
                    # (simplified: just filter by org access)
                    self._user_organization_ids_subquery(user.id)
                )
            )
        elif is_organization(auth_subject):
            org = auth_subject.subject
            statement = statement.where(
                FinancialAccount.organization_id == org.id
            )
        return statement

    def _user_organization_ids_subquery(self, user_id: UUID):  # type: ignore[no-untyped-def]
        from sqlalchemy import select

        from polar.models.user_organization import UserOrganization

        return select(UserOrganization.organization_id).where(
            UserOrganization.user_id == user_id
        )


class IssuingCardRepository(RepositoryBase[IssuingCard]):
    model = IssuingCard

    async def get_by_financial_account(
        self,
        financial_account_id: UUID,
        *,
        status: IssuingCardStatus | None = None,
    ) -> list[IssuingCard]:
        statement = self.get_base_statement().where(
            IssuingCard.financial_account_id == financial_account_id,
        )
        if status is not None:
            statement = statement.where(IssuingCard.status == status)
        statement = statement.order_by(IssuingCard.created_at.desc())
        return list(await self.get_all(statement))

    async def get_by_stripe_id(self, stripe_card_id: str) -> IssuingCard | None:
        statement = self.get_base_statement().where(
            IssuingCard.stripe_card_id == stripe_card_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_organization(
        self,
        organization_id: UUID,
        *,
        status: IssuingCardStatus | None = None,
    ) -> list[IssuingCard]:
        statement = self.get_base_statement().where(
            IssuingCard.organization_id == organization_id,
        )
        if status is not None:
            statement = statement.where(IssuingCard.status == status)
        statement = statement.order_by(IssuingCard.created_at.desc())
        return list(await self.get_all(statement))


class TreasuryTransactionRepository(
    RepositorySortingMixin[TreasuryTransaction, TreasuryTransactionSortProperty],
    RepositoryBase[TreasuryTransaction],
):
    model = TreasuryTransaction
    sorting_enum = TreasuryTransactionSortProperty

    async def get_by_stripe_id(
        self, stripe_transaction_id: str
    ) -> TreasuryTransaction | None:
        statement = self.get_base_statement().where(
            TreasuryTransaction.stripe_transaction_id == stripe_transaction_id,
        )
        return await self.get_one_or_none(statement)

    async def list_by_financial_account(
        self,
        financial_account_id: UUID,
        *,
        limit: int = 50,
        page: int = 1,
    ) -> tuple[list[TreasuryTransaction], int]:
        statement = (
            self.get_base_statement()
            .where(
                TreasuryTransaction.financial_account_id == financial_account_id,
            )
            .order_by(TreasuryTransaction.created_at.desc())
        )
        count = await self.count(statement)
        results = list(
            await self.get_all(
                statement.limit(limit).offset((page - 1) * limit)
            )
        )
        return results, count

    def get_sorting_clause(
        self, property: TreasuryTransactionSortProperty
    ) -> SortingClause:
        match property:
            case TreasuryTransactionSortProperty.created_at:
                return TreasuryTransaction.created_at
            case TreasuryTransactionSortProperty.amount:
                return TreasuryTransaction.amount
