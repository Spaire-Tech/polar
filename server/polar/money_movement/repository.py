from uuid import UUID

from polar.kit.repository import RepositoryBase
from polar.models.money_movement import (
    OutboundPaymentRecord,
    OutboundPaymentStatus,
    OutboundTransferRecord,
    OutboundTransferStatus,
    PaymentRecipient,
)


class PaymentRecipientRepository(RepositoryBase[PaymentRecipient]):
    model = PaymentRecipient

    async def get_by_account_id(
        self, account_id: UUID
    ) -> list[PaymentRecipient]:
        statement = self.get_base_statement().where(
            PaymentRecipient.account_id == account_id,
        )
        return list(await self.get_all(statement))

    async def get_by_account_and_id(
        self, account_id: UUID, recipient_id: UUID
    ) -> PaymentRecipient | None:
        statement = self.get_base_statement().where(
            PaymentRecipient.account_id == account_id,
            PaymentRecipient.id == recipient_id,
        )
        return await self.get_one_or_none(statement)


class OutboundPaymentRepository(RepositoryBase[OutboundPaymentRecord]):
    model = OutboundPaymentRecord

    async def get_by_account_id(
        self, account_id: UUID
    ) -> list[OutboundPaymentRecord]:
        statement = (
            self.get_base_statement()
            .where(OutboundPaymentRecord.account_id == account_id)
            .order_by(OutboundPaymentRecord.created_at.desc())
        )
        return list(await self.get_all(statement))

    async def get_by_stripe_id(
        self, stripe_outbound_payment_id: str
    ) -> OutboundPaymentRecord | None:
        statement = self.get_base_statement().where(
            OutboundPaymentRecord.stripe_outbound_payment_id
            == stripe_outbound_payment_id,
        )
        return await self.get_one_or_none(statement)

    async def get_processing_by_account(
        self, account_id: UUID
    ) -> list[OutboundPaymentRecord]:
        statement = self.get_base_statement().where(
            OutboundPaymentRecord.account_id == account_id,
            OutboundPaymentRecord.status == OutboundPaymentStatus.processing,
        )
        return list(await self.get_all(statement))


class OutboundTransferRepository(RepositoryBase[OutboundTransferRecord]):
    model = OutboundTransferRecord

    async def get_by_account_id(
        self, account_id: UUID
    ) -> list[OutboundTransferRecord]:
        statement = (
            self.get_base_statement()
            .where(OutboundTransferRecord.account_id == account_id)
            .order_by(OutboundTransferRecord.created_at.desc())
        )
        return list(await self.get_all(statement))

    async def get_by_stripe_id(
        self, stripe_outbound_transfer_id: str
    ) -> OutboundTransferRecord | None:
        statement = self.get_base_statement().where(
            OutboundTransferRecord.stripe_outbound_transfer_id
            == stripe_outbound_transfer_id,
        )
        return await self.get_one_or_none(statement)
