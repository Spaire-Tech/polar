from datetime import datetime
from enum import StrEnum
from typing import Literal

from dateutil.relativedelta import relativedelta


class Platforms(StrEnum):
    github = "github"


class PaymentProcessor(StrEnum):
    stripe = "stripe"


class TaxProcessor(StrEnum):
    stripe = "stripe"
    numeral = "numeral"


class AccountType(StrEnum):
    stripe = "stripe"
    manual = "manual"

    def get_display_name(self) -> str:
        return {
            AccountType.stripe: "Stripe Connect Express",
            AccountType.manual: "Manual",
        }[self]


class AccountMode(StrEnum):
    express = "express"
    custom = "custom"

    def get_display_name(self) -> str:
        return {
            AccountMode.express: "Express (Standard Payouts)",
            AccountMode.custom: "Custom (Embedded Finance)",
        }[self]


class IssuingStatus(StrEnum):
    onboarding_required = "onboarding_required"
    onboarding_in_progress = "onboarding_in_progress"
    issuing_active = "issuing_active"
    temporarily_restricted = "temporarily_restricted"

    def get_display_name(self) -> str:
        return {
            IssuingStatus.onboarding_required: "Onboarding Required",
            IssuingStatus.onboarding_in_progress: "Onboarding In Progress",
            IssuingStatus.issuing_active: "Active",
            IssuingStatus.temporarily_restricted: "Temporarily Restricted",
        }[self]


class FundState(StrEnum):
    pending = "pending"
    available = "available"
    reserve = "reserve"
    spendable = "spendable"

    def get_display_name(self) -> str:
        return {
            FundState.pending: "Pending",
            FundState.available: "Available",
            FundState.reserve: "Reserve",
            FundState.spendable: "Spendable",
        }[self]


class SubscriptionRecurringInterval(StrEnum):
    day = "day"
    week = "week"
    month = "month"
    year = "year"

    def as_literal(self) -> Literal["day", "week", "month", "year"]:
        return self.value

    def get_next_period(self, d: datetime, leap: int = 1) -> datetime:
        match self:
            case SubscriptionRecurringInterval.day:
                return d + relativedelta(days=leap)
            case SubscriptionRecurringInterval.week:
                return d + relativedelta(weeks=leap)
            case SubscriptionRecurringInterval.month:
                return d + relativedelta(months=leap)
            case SubscriptionRecurringInterval.year:
                return d + relativedelta(years=leap)


class SubscriptionProrationBehavior(StrEnum):
    invoice = "invoice"  # Invoice immediately
    prorate = "prorate"  # Add prorations to next invoice

    def to_stripe(self) -> Literal["always_invoice", "create_prorations"]:
        if self == SubscriptionProrationBehavior.invoice:
            return "always_invoice"
        if self == SubscriptionProrationBehavior.prorate:
            return "create_prorations"
        raise ValueError(f"Invalid proration behavior: {self}")


class InvoiceNumbering(StrEnum):
    organization = "organization"
    customer = "customer"


class TokenType(StrEnum):
    client_secret = "spaire_client_secret"
    client_registration_token = "spaire_client_registration_token"
    authorization_code = "spaire_authorization_code"
    access_token = "spaire_access_token"
    refresh_token = "spaire_refresh_token"
    personal_access_token = "spaire_personal_access_token"
    organization_access_token = "spaire_organization_access_token"
    customer_session_token = "spaire_customer_session_token"
    user_session_token = "spaire_user_session_token"


class RateLimitGroup(StrEnum):
    web = "web"
    restricted = "restricted"
    default = "default"
    elevated = "elevated"
