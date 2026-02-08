"""Stripe Treasury + Issuing integration service.

Wraps all Stripe Treasury and Issuing API calls used by the business wallet module.
"""

import stripe as stripe_lib
import structlog

from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()

# Ensure Stripe keys are set (they come from the main stripe service init)
stripe_lib.api_key = settings.STRIPE_SECRET_KEY


class StripeTreasuryService:
    """Handles all Stripe Treasury + Issuing API interactions."""

    # -----------------------------------------------------------------------
    # Connected Account (Custom) — upgraded for Treasury + Issuing
    # -----------------------------------------------------------------------

    async def create_custom_account(
        self,
        *,
        country: str = "US",
        email: str,
        business_name: str,
    ) -> stripe_lib.Account:
        """Create a Custom connected account with Treasury + Issuing capabilities."""
        log.info(
            "stripe.treasury.create_custom_account",
            country=country,
            email=email,
            business_name=business_name,
        )
        return await stripe_lib.Account.create_async(
            country=country,
            type="custom",
            email=email,
            business_type="company",
            business_profile={"name": business_name},
            capabilities={
                "transfers": {"requested": True},
                "treasury": {"requested": True},
                "card_issuing": {"requested": True},
            },
            tos_acceptance={"service_agreement": "full"},
            settings={
                "payouts": {"schedule": {"interval": "manual"}},
            },
        )

    async def create_account_link(
        self,
        stripe_account_id: str,
        *,
        return_url: str,
        refresh_url: str,
    ) -> stripe_lib.AccountLink:
        """Create an Account Link for Custom account onboarding."""
        return await stripe_lib.AccountLink.create_async(
            account=stripe_account_id,
            return_url=return_url,
            refresh_url=refresh_url,
            type="account_onboarding",
        )

    async def retrieve_account(self, stripe_account_id: str) -> stripe_lib.Account:
        """Retrieve a Stripe connected account."""
        return await stripe_lib.Account.retrieve_async(stripe_account_id)

    # -----------------------------------------------------------------------
    # Treasury Financial Accounts
    # -----------------------------------------------------------------------

    async def create_financial_account(
        self,
        *,
        stripe_account_id: str,
        supported_currencies: list[str] | None = None,
    ) -> stripe_lib.treasury.FinancialAccount:
        """Create a Treasury Financial Account for a connected account."""
        log.info(
            "stripe.treasury.create_financial_account",
            stripe_account=stripe_account_id,
        )
        return await stripe_lib.treasury.FinancialAccount.create_async(
            supported_currencies=supported_currencies or ["usd"],
            features={
                "card_issuing": {"requested": True},
                "deposit_insurance": {"requested": True},
                "financial_addresses": {"aba": {"requested": True}},
                "inbound_transfers": {"ach": {"requested": True}},
                "outbound_payments": {
                    "ach": {"requested": True},
                    "us_domestic_wire": {"requested": True},
                },
                "outbound_transfers": {
                    "ach": {"requested": True},
                    "us_domestic_wire": {"requested": True},
                },
            },
            stripe_account=stripe_account_id,
        )

    async def retrieve_financial_account(
        self,
        financial_account_id: str,
        *,
        stripe_account_id: str,
    ) -> stripe_lib.treasury.FinancialAccount:
        """Retrieve a Treasury Financial Account."""
        return await stripe_lib.treasury.FinancialAccount.retrieve_async(
            financial_account_id,
            expand=["financial_addresses"],
            stripe_account=stripe_account_id,
        )

    async def list_financial_account_transactions(
        self,
        financial_account_id: str,
        *,
        stripe_account_id: str,
        limit: int = 20,
        starting_after: str | None = None,
        status: str | None = None,
    ) -> stripe_lib.ListObject[stripe_lib.treasury.Transaction]:
        """List transactions for a Treasury Financial Account."""
        params: dict = {
            "financial_account": financial_account_id,
            "limit": limit,
            "stripe_account": stripe_account_id,
            "expand": ["data.flow_details"],
        }
        if starting_after:
            params["starting_after"] = starting_after
        if status:
            params["status"] = status

        return await stripe_lib.treasury.Transaction.list_async(**params)

    # -----------------------------------------------------------------------
    # Issuing Cardholders
    # -----------------------------------------------------------------------

    async def create_cardholder(
        self,
        *,
        stripe_account_id: str,
        name: str,
        email: str,
        billing_address: dict,
    ) -> stripe_lib.issuing.Cardholder:
        """Create an Issuing Cardholder on the connected account."""
        log.info(
            "stripe.issuing.create_cardholder",
            stripe_account=stripe_account_id,
            name=name,
        )
        return await stripe_lib.issuing.Cardholder.create_async(
            name=name,
            email=email,
            type="company",
            billing={
                "address": billing_address,
            },
            status="active",
            stripe_account=stripe_account_id,
        )

    async def retrieve_cardholder(
        self,
        cardholder_id: str,
        *,
        stripe_account_id: str,
    ) -> stripe_lib.issuing.Cardholder:
        """Retrieve an Issuing Cardholder."""
        return await stripe_lib.issuing.Cardholder.retrieve_async(
            cardholder_id,
            stripe_account=stripe_account_id,
        )

    # -----------------------------------------------------------------------
    # Issuing Cards
    # -----------------------------------------------------------------------

    async def create_card(
        self,
        *,
        stripe_account_id: str,
        cardholder_id: str,
        financial_account_id: str,
        card_type: str = "virtual",
        currency: str = "usd",
        spending_limit_amount: int | None = None,
        spending_limit_interval: str | None = None,
    ) -> stripe_lib.issuing.Card:
        """Create an Issuing Card funded by a Treasury Financial Account."""
        log.info(
            "stripe.issuing.create_card",
            stripe_account=stripe_account_id,
            cardholder_id=cardholder_id,
            card_type=card_type,
        )
        params: dict = {
            "cardholder": cardholder_id,
            "currency": currency,
            "type": card_type,
            "financial_account": financial_account_id,
            "status": "active",
            "stripe_account": stripe_account_id,
        }

        if spending_limit_amount is not None and spending_limit_interval is not None:
            params["spending_controls"] = {
                "spending_limits": [
                    {
                        "amount": spending_limit_amount,
                        "interval": spending_limit_interval,
                    }
                ]
            }

        return await stripe_lib.issuing.Card.create_async(**params)

    async def retrieve_card(
        self,
        card_id: str,
        *,
        stripe_account_id: str,
    ) -> stripe_lib.issuing.Card:
        """Retrieve an Issuing Card."""
        return await stripe_lib.issuing.Card.retrieve_async(
            card_id,
            stripe_account=stripe_account_id,
        )

    async def retrieve_card_details(
        self,
        card_id: str,
        *,
        stripe_account_id: str,
    ) -> stripe_lib.issuing.Card:
        """Retrieve an Issuing Card with full number and CVC."""
        return await stripe_lib.issuing.Card.retrieve_async(
            card_id,
            expand=["number", "cvc"],
            stripe_account=stripe_account_id,
        )

    async def update_card(
        self,
        card_id: str,
        *,
        stripe_account_id: str,
        status: str | None = None,
        spending_limit_amount: int | None = None,
        spending_limit_interval: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.issuing.Card:
        """Update an Issuing Card."""
        log.info(
            "stripe.issuing.update_card",
            card_id=card_id,
            stripe_account=stripe_account_id,
            status=status,
        )
        params: dict = {
            "stripe_account": stripe_account_id,
        }

        if status is not None:
            params["status"] = status

        if spending_limit_amount is not None and spending_limit_interval is not None:
            params["spending_controls"] = {
                "spending_limits": [
                    {
                        "amount": spending_limit_amount,
                        "interval": spending_limit_interval,
                    }
                ]
            }
        elif spending_limit_amount is not None and spending_limit_amount == 0:
            params["spending_controls"] = {"spending_limits": []}

        if metadata is not None:
            params["metadata"] = metadata

        return await stripe_lib.issuing.Card.modify_async(card_id, **params)

    # -----------------------------------------------------------------------
    # Outbound Payments (ACH transfers out of the financial account)
    # -----------------------------------------------------------------------

    async def create_outbound_payment(
        self,
        *,
        stripe_account_id: str,
        financial_account_id: str,
        amount: int,
        currency: str = "usd",
        destination_account_number: str,
        destination_routing_number: str,
        description: str = "",
        counterparty_name: str = "",
    ) -> stripe_lib.treasury.OutboundPayment:
        """Create an OutboundPayment from a Financial Account to an external bank."""
        log.info(
            "stripe.treasury.create_outbound_payment",
            stripe_account=stripe_account_id,
            amount=amount,
        )
        return await stripe_lib.treasury.OutboundPayment.create_async(
            financial_account=financial_account_id,
            amount=amount,
            currency=currency,
            statement_descriptor=description[:10] if description else "SPAIRE",
            destination_payment_method_data={
                "type": "us_bank_account",
                "us_bank_account": {
                    "account_number": destination_account_number,
                    "routing_number": destination_routing_number,
                    "account_holder_type": "company",
                },
                "billing_details": {
                    "name": counterparty_name,
                },
            },
            description=description,
            stripe_account=stripe_account_id,
        )

    # -----------------------------------------------------------------------
    # Payout to Financial Account (from Stripe payments balance)
    # -----------------------------------------------------------------------

    async def create_payout_to_financial_account(
        self,
        *,
        stripe_account_id: str,
        amount: int,
        currency: str = "usd",
        financial_account_id: str,
    ) -> stripe_lib.Payout:
        """Create a payout from Connect payments balance to Financial Account."""
        log.info(
            "stripe.treasury.payout_to_fa",
            stripe_account=stripe_account_id,
            amount=amount,
            financial_account=financial_account_id,
        )
        return await stripe_lib.Payout.create_async(
            amount=amount,
            currency=currency,
            destination=financial_account_id,
            stripe_account=stripe_account_id,
        )


stripe_treasury_service = StripeTreasuryService()
