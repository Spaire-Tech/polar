'use client'

import {
  useFinancialAccount,
  useIssuingCards,
  useOnboardingStatus,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { useRouter } from 'next/navigation'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function BalanceCard({
  title,
  amount,
  subtitle,
}: {
  title: string
  amount: number
  subtitle?: string
}) {
  return (
    <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
      <CardContent className="flex flex-col gap-y-1 p-6">
        <p className="dark:text-polar-400 text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-medium dark:text-white text-gray-900">
          {formatCurrency(amount)}
        </p>
        {subtitle && (
          <p className="dark:text-polar-500 text-xs text-gray-400">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function CardPreview({
  card,
}: {
  card: {
    last4: string
    brand: string
    cardholder_name: string
    card_color: string
    status: string
    expiration: string
    total_spent: number
  }
}) {
  return (
    <div
      className="relative h-48 w-80 overflow-hidden rounded-2xl p-6 text-white shadow-lg"
      style={{ backgroundColor: card.card_color }}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium opacity-90">{card.brand}</p>
          <div
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              card.status === 'active'
                ? 'bg-white/20 text-white'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {card.status}
          </div>
        </div>
        <div>
          <p className="mb-1 font-mono text-lg tracking-widest">
            **** **** **** {card.last4}
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase opacity-70">Card Holder</p>
              <p className="text-sm font-medium">{card.cardholder_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase opacity-70">Expires</p>
              <p className="text-sm font-medium">{card.expiration}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OverviewPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()

  const {
    data: onboardingStatus,
    isLoading: onboardingLoading,
  } = useOnboardingStatus(organization.id)

  const { data: financialAccount, isLoading: faLoading } =
    useFinancialAccount(organization.id)

  const { data: cards, isLoading: cardsLoading } = useIssuingCards(
    organization.id,
  )

  const isLoading = onboardingLoading || faLoading || cardsLoading

  // Not onboarded yet — show onboarding prompt
  if (!isLoading && !onboardingStatus?.has_financial_account) {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Business Wallet
          </h2>
        </div>
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardContent className="flex flex-col items-center gap-y-6 py-16 text-center">
            <div className="dark:bg-polar-700 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <svg
                className="dark:text-polar-400 h-8 w-8 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-y-2">
              <h3 className="text-xl font-medium dark:text-white text-gray-900">
                Open a Financial Business Account
              </h3>
              <p className="dark:text-polar-400 max-w-md text-sm text-gray-500">
                Get a dedicated business financial account powered by Stripe
                Treasury. Receive subscription payments directly into your
                account and spend instantly with an issued card — no waiting
                for payouts to hit your bank.
              </p>
            </div>
            <div className="flex flex-col gap-y-3">
              <div className="dark:text-polar-400 flex flex-col gap-y-2 text-left text-sm text-gray-600">
                <div className="flex items-start gap-x-2">
                  <span className="dark:text-polar-300 mt-0.5 text-gray-700">
                    -
                  </span>
                  <span>
                    Funds from subscriptions and sales flow directly to your
                    account
                  </span>
                </div>
                <div className="flex items-start gap-x-2">
                  <span className="dark:text-polar-300 mt-0.5 text-gray-700">
                    -
                  </span>
                  <span>
                    Issue virtual or physical cards to spend your balance
                    instantly
                  </span>
                </div>
                <div className="flex items-start gap-x-2">
                  <span className="dark:text-polar-300 mt-0.5 text-gray-700">
                    -
                  </span>
                  <span>
                    FDIC-insured deposits up to $250,000 through Stripe's
                    partner banks
                  </span>
                </div>
                <div className="flex items-start gap-x-2">
                  <span className="dark:text-polar-300 mt-0.5 text-gray-700">
                    -
                  </span>
                  <span>
                    Send ACH or wire payments directly from your account
                  </span>
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={() =>
                  router.push(
                    `/dashboard/${organization.slug}/business-wallet/onboarding`,
                  )
                }
              >
                Open Financial Business Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Business Wallet
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="dark:bg-polar-700 h-28 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
        <div className="dark:bg-polar-700 h-48 w-80 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    )
  }

  const activeCards =
    cards?.filter((c: any) => c.status !== 'canceled') ?? []

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium dark:text-white text-gray-900">
          Business Wallet
        </h2>
        <div className="flex gap-x-3">
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                `/dashboard/${organization.slug}/business-wallet/transactions`,
              )
            }
          >
            View Transactions
          </Button>
          <Button
            onClick={() =>
              router.push(
                `/dashboard/${organization.slug}/business-wallet/cards`,
              )
            }
          >
            Manage Cards
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <BalanceCard
          title="Available Balance"
          amount={financialAccount?.balance_cash ?? 0}
          subtitle="Spendable via card or ACH transfer"
        />
        <BalanceCard
          title="Pending Inbound"
          amount={financialAccount?.balance_inbound_pending ?? 0}
          subtitle="Arriving from payments and transfers"
        />
        <BalanceCard
          title="Pending Outbound"
          amount={financialAccount?.balance_outbound_pending ?? 0}
          subtitle="In-transit outbound payments"
        />
      </div>

      {/* Account Info */}
      {financialAccount && (
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardHeader className="pb-3">
            <h3 className="text-sm font-medium dark:text-white text-gray-900">
              Account Details
            </h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="dark:text-polar-400 text-gray-500">Status</p>
              <p className="dark:text-white font-medium capitalize text-gray-900">
                {financialAccount.status}
              </p>
            </div>
            <div>
              <p className="dark:text-polar-400 text-gray-500">Currency</p>
              <p className="dark:text-white font-medium uppercase text-gray-900">
                {financialAccount.currency}
              </p>
            </div>
            {financialAccount.aba_routing_number && (
              <div>
                <p className="dark:text-polar-400 text-gray-500">
                  Routing Number
                </p>
                <p className="dark:text-white font-mono text-gray-900">
                  {financialAccount.aba_routing_number}
                </p>
              </div>
            )}
            {financialAccount.aba_account_number && (
              <div>
                <p className="dark:text-polar-400 text-gray-500">
                  Account Number
                </p>
                <p className="dark:text-white font-mono text-gray-900">
                  ****{financialAccount.aba_account_number.slice(-4)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Features */}
      {financialAccount && (
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardHeader className="pb-3">
            <h3 className="text-sm font-medium dark:text-white text-gray-900">
              Enabled Features
            </h3>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {[
              {
                label: 'Card Issuing',
                enabled: financialAccount.features_card_issuing,
              },
              {
                label: 'FDIC Insurance',
                enabled: financialAccount.features_deposit_insurance,
              },
              {
                label: 'ACH Inbound',
                enabled: financialAccount.features_inbound_transfers_ach,
              },
              {
                label: 'ACH Outbound Payments',
                enabled: financialAccount.features_outbound_payments_ach,
              },
              {
                label: 'ACH Outbound Transfers',
                enabled: financialAccount.features_outbound_transfers_ach,
              },
            ].map((feature) => (
              <div
                key={feature.label}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  feature.enabled
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                    : 'dark:bg-polar-700 dark:text-polar-400 bg-gray-100 text-gray-400'
                }`}
              >
                {feature.label}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cards Preview */}
      {activeCards.length > 0 && (
        <div className="flex flex-col gap-y-4">
          <h3 className="text-sm font-medium dark:text-white text-gray-900">
            Your Cards
          </h3>
          <div className="flex flex-wrap gap-6">
            {activeCards.map((card: any) => (
              <CardPreview key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {activeCards.length === 0 && (
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardContent className="flex flex-col items-center gap-y-4 py-12 text-center">
            <p className="dark:text-polar-400 text-sm text-gray-500">
              No cards issued yet. Create a card to start spending your
              balance.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/${organization.slug}/business-wallet/cards`,
                )
              }
            >
              Issue Your First Card
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
