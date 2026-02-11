from uuid import UUID

from polar.kit.repository import RepositoryBase
from polar.models.issuing import Cardholder, IssuedCard


class CardholderRepository(RepositoryBase[Cardholder]):
    model = Cardholder

    async def get_by_account_id(
        self, account_id: UUID
    ) -> list[Cardholder]:
        statement = self.get_base_statement().where(
            Cardholder.account_id == account_id,
        )
        return list(await self.get_all(statement))

    async def get_by_stripe_id(
        self, stripe_cardholder_id: str
    ) -> Cardholder | None:
        statement = self.get_base_statement().where(
            Cardholder.stripe_cardholder_id == stripe_cardholder_id,
        )
        return await self.get_one_or_none(statement)


class IssuedCardRepository(RepositoryBase[IssuedCard]):
    model = IssuedCard

    async def get_by_cardholder_id(
        self, cardholder_id: UUID
    ) -> list[IssuedCard]:
        statement = self.get_base_statement().where(
            IssuedCard.cardholder_id == cardholder_id,
        )
        return list(await self.get_all(statement))

    async def get_by_financial_account_id(
        self, financial_account_id: UUID
    ) -> list[IssuedCard]:
        statement = self.get_base_statement().where(
            IssuedCard.financial_account_id == financial_account_id,
        )
        return list(await self.get_all(statement))

    async def get_by_stripe_id(
        self, stripe_card_id: str
    ) -> IssuedCard | None:
        statement = self.get_base_statement().where(
            IssuedCard.stripe_card_id == stripe_card_id,
        )
        return await self.get_one_or_none(statement)

    async def get_active_by_account(
        self, account_id: UUID
    ) -> list[IssuedCard]:
        """Get all active cards for an account (via cardholder join)."""
        from polar.models.issuing import IssuedCardStatus

        statement = (
            self.get_base_statement()
            .join(Cardholder, IssuedCard.cardholder_id == Cardholder.id)
            .where(
                Cardholder.account_id == account_id,
                IssuedCard.status == IssuedCardStatus.active,
            )
        )
        return list(await self.get_all(statement))
