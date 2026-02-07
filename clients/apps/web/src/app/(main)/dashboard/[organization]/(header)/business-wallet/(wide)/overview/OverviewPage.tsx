'use client'

import {
  useFinancialAccount,
  useIssuingCards,
  useOnboardingStatus,
} from '@/hooks/queries'
import type { IssuingCardData } from '@/hooks/queries/businessWallet'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useRouter } from 'next/navigation'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

function MiniCard({ card }: { card: IssuingCardData }) {
  return (
    <div
      className="relative flex h-[130px] w-[206px] flex-col justify-between overflow-hidden rounded-xl p-4 text-white shadow-md"
      style={{
        background: `linear-gradient(135deg, ${card.card_color} 0%, ${card.card_color}dd 100%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
          {card.brand}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
            card.status === 'active'
              ? 'bg-white/20'
              : 'bg-white/10 opacity-60'
          }`}
        >
          {card.status}
        </span>
      </div>
      <div>
        <p className="mb-1 font-mono text-xs tracking-[0.15em] opacity-90">
          •••• {card.last4}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wider opacity-60">
          {card.cardholder_name}
        </p>
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

  const { data: onboardingStatus, isLoading: onboardingLoading } =
    useOnboardingStatus(organization.id)

  const { data: financialAccount, isLoading: faLoading } =
    useFinancialAccount(organization.id)

  const { data: cards, isLoading: cardsLoading } = useIssuingCards(
    organization.id,
  )

  const isLoading = onboardingLoading || faLoading || cardsLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="dark:bg-polar-700 h-24 w-64 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="dark:bg-polar-700 h-20 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!onboardingStatus?.has_financial_account) {
    return (
      <div className="flex flex-col items-center gap-y-6 py-24 text-center">
        <div className="dark:bg-polar-700 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <svg
            className="dark:text-polar-400 h-6 w-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-y-2">
          <h3 className="text-lg font-medium dark:text-white text-gray-900">
            Open a Business Account
          </h3>
          <p className="dark:text-polar-400 max-w-sm text-sm text-gray-500">
            Get a dedicated business account to receive payments directly and
            spend with issued cards.
          </p>
        </div>
        <Button
          onClick={() =>
            router.push(
              `/dashboard/${organization.slug}/business-wallet/onboarding`,
            )
          }
        >
          Get Started
        </Button>
      </div>
    )
  }

  const activeCards =
    cards?.filter((c: IssuingCardData) => c.status !== 'canceled') ?? []

  return (
    <div className="flex flex-col gap-y-10">
      {/* Balance */}
      <div className="flex flex-col gap-y-1">
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Available Balance
        </p>
        <p className="text-4xl font-light dark:text-white text-gray-900">
          {formatCurrency(financialAccount?.balance_cash ?? 0)}
        </p>
      </div>

      {/* Pending */}
      <div className="flex gap-x-8">
        <div className="flex flex-col gap-y-0.5">
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Pending Inbound
          </p>
          <p className="text-sm font-medium dark:text-white text-gray-900">
            {formatCurrency(financialAccount?.balance_inbound_pending ?? 0)}
          </p>
        </div>
        <div className="flex flex-col gap-y-0.5">
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Pending Outbound
          </p>
          <p className="text-sm font-medium dark:text-white text-gray-900">
            {formatCurrency(financialAccount?.balance_outbound_pending ?? 0)}
          </p>
        </div>
        {financialAccount?.aba_routing_number && (
          <div className="flex flex-col gap-y-0.5">
            <p className="dark:text-polar-500 text-xs text-gray-400">
              Routing
            </p>
            <p className="text-sm font-mono dark:text-white text-gray-900">
              {financialAccount.aba_routing_number}
            </p>
          </div>
        )}
        {financialAccount?.aba_account_number && (
          <div className="flex flex-col gap-y-0.5">
            <p className="dark:text-polar-500 text-xs text-gray-400">
              Account
            </p>
            <p className="text-sm font-mono dark:text-white text-gray-900">
              ••••{financialAccount.aba_account_number.slice(-4)}
            </p>
          </div>
        )}
      </div>

      {/* Cards */}
      {activeCards.length > 0 ? (
        <div className="flex flex-col gap-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium dark:text-white text-gray-900">
              Cards
            </p>
            <button
              onClick={() =>
                router.push(
                  `/dashboard/${organization.slug}/business-wallet/cards`,
                )
              }
              className="dark:text-polar-400 dark:hover:text-polar-300 text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Manage
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            {activeCards.map((card: IssuingCardData) => (
              <MiniCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      ) : (
        <div className="dark:border-polar-700 dark:bg-polar-800 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-6">
          <p className="dark:text-polar-400 text-sm text-gray-500">
            No cards issued yet
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(
                `/dashboard/${organization.slug}/business-wallet/cards`,
              )
            }
          >
            Issue Card
          </Button>
        </div>
      )}

      {/* Features */}
      {financialAccount && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Card Issuing', on: financialAccount.features_card_issuing },
            { label: 'FDIC Insured', on: financialAccount.features_deposit_insurance },
            { label: 'ACH Inbound', on: financialAccount.features_inbound_transfers_ach },
            { label: 'ACH Payments', on: financialAccount.features_outbound_payments_ach },
            { label: 'ACH Transfers', on: financialAccount.features_outbound_transfers_ach },
          ]
            .filter((f) => f.on)
            .map((f) => (
              <span
                key={f.label}
                className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400"
              >
                {f.label}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
