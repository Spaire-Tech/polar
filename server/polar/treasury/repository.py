from uuid import UUID

from polar.kit.repository import RepositoryBase
from polar.models.financial_account import FinancialAccount


class FinancialAccountRepository(
    RepositoryBase[FinancialAccount],
):
    model = FinancialAccount

    async def get_by_account_id(
        self, account_id: UUID
    ) -> FinancialAccount | None:
        statement = self.get_base_statement().where(
            FinancialAccount.account_id == account_id,
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
