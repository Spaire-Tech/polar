'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { toast } from '@/components/Toast/use-toast'
import {
  BillingInterval,
  formatTransactionFee,
  headlinePriceForPlan,
  PaidTierKey,
  TierPlan,
  tierDisplayName,
  useSpairePlans,
} from '@/hooks/queries/spaireTier'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { useCallback, useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Plan + checkout step of the new-signup flow.
 *
 * Sits between OrganizationStep ("name + slug + logo", at /dashboard/create)
 * and ReviewPage ("Create your Space Card", at /onboarding/review).
 *
 * By the time the user reaches this page their org exists and the
 * organization.created hook has attached a 14-day Pro trial. Clicking
 * any tier card hands off to the upgrade-checkout endpoint, which
 * converts the trialing subscription in place (capturing a card on
 * file) and redirects the user through Polar-hosted checkout. The
 * checkout's success_url returns to /onboarding/review, so the next
 * thing the user sees is the existing Space Card editor.
 */
export default function PlanPage() {
  const { organization } = useContext(OrganizationContext)
  const plans = useSpairePlans()
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [pending, setPending] = useState<PaidTierKey | null>(null)

  const ordered = useMemo<TierPlan[]>(() => {
    if (!plans.data?.items) return []
    const map = new Map(plans.data.items.map((p) => [p.tier, p]))
    return (['pro', 'studio', 'scale'] as const)
      .map((t) => map.get(t))
      .filter((p): p is TierPlan => Boolean(p))
  }, [plans.data])

  const startCheckout = useCallback(
    async (tier: PaidTierKey) => {
      if (pending) return
      setPending(tier)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platformApi = api as unknown as any
        const { data, error } = await platformApi.POST(
          '/v1/platform/organizations/{organization_id}/upgrade-checkout',
          {
            params: { path: { organization_id: organization.id } },
            body: {
              tier,
              billing_interval: interval,
              success_url: `${window.location.origin}/dashboard/${organization.slug}/onboarding/review?upgraded=1`,
            },
          },
        )
        if (error || !data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = error as any
          // FastAPI 422 returns { detail: [{loc, msg, type, input}, ...] }
          // Surface the first validation error so we can fix it instead
          // of swallowing it as "Couldn't start checkout for this plan."
          let message = "Couldn't start checkout for this plan."
          if (Array.isArray(e?.detail) && e.detail.length > 0) {
            const first = e.detail[0]
            message = `${first?.msg ?? 'Validation failed'} (loc=${(first?.loc ?? []).join('.')})`
          } else if (typeof e?.detail === 'string') {
            message = e.detail
          }
          // eslint-disable-next-line no-console
          console.error('upgrade-checkout failed', e)
          throw new Error(message)
        }
        const checkout = data as { checkout_url?: string }
        if (!checkout.checkout_url) {
          throw new Error('Checkout URL missing from server response.')
        }
        window.location.href = checkout.checkout_url
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong.'
        toast({ title: 'Checkout failed', description: message })
        setPending(null)
      }
    },
    [interval, organization.id, organization.slug, pending],
  )

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-white px-4 py-12">
      <div className="mb-12 w-full max-w-lg">
        <OnboardingProgressBar currentStep={2} totalSteps={3} />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-y-10">
        <header className="flex flex-col items-center gap-y-3 text-center">
          <h1 className="text-2xl font-medium tracking-tight text-gray-900">
            Choose your plan
          </h1>
          <p className="max-w-2xl text-sm text-gray-500">
            Every plan starts with a 14-day free trial. You won&apos;t be
            charged during the trial — switch or cancel anytime from
            Settings.
          </p>
          <IntervalToggle interval={interval} onChange={setInterval} />
        </header>

        {plans.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[480px] animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ordered.map((plan, idx) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                previousPlanName={idx === 0 ? null : ordered[idx - 1].name}
                interval={interval}
                pending={pending}
                onChoose={startCheckout}
              />
            ))}
          </div>
        )}

        <p className="text-center text-sm text-gray-500">
          Compare all plans and features
        </p>
      </div>
    </div>
  )
}

const IntervalToggle = ({
  interval,
  onChange,
}: {
  interval: BillingInterval
  onChange: (interval: BillingInterval) => void
}) => (
  <div className="inline-flex items-center gap-x-2">
    <div className="relative inline-flex rounded-full border border-gray-200 bg-white p-1">
      {(['month', 'year'] as const).map((option) => {
        const active = interval === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={twMerge(
              'relative z-10 rounded-full px-4 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-black text-white'
                : 'text-gray-500 hover:text-gray-900',
            )}
          >
            {option === 'month' ? 'Monthly' : 'Annual'}
          </button>
        )
      })}
    </div>
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-500">
      Save 20%
    </span>
  </div>
)

interface PlanCardProps {
  plan: TierPlan
  previousPlanName: string | null
  interval: BillingInterval
  pending: PaidTierKey | null
  onChoose: (tier: PaidTierKey) => void
}

const PlanCard = ({
  plan,
  previousPlanName,
  interval,
  pending,
  onChoose,
}: PlanCardProps) => {
  const tier = plan.tier as PaidTierKey
  const annualAvailable = plan.annual_price_cents != null
  const effectiveInterval: BillingInterval =
    interval === 'year' && !annualAvailable ? 'month' : interval
  const headline = headlinePriceForPlan(plan, effectiveInterval)
  const featureLines = featuresForTier(plan)
  const isPending = pending === tier
  const disabled = pending !== null && pending !== tier
  const isRecommended = tier === 'studio'

  return (
    <div
      className={twMerge(
        'flex flex-col rounded-2xl border bg-white p-6 transition-shadow',
        isRecommended ? 'border-blue-500' : 'border-gray-200',
      )}
    >
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-base font-medium text-gray-900">
          {tierDisplayName(plan.tier)}
        </h3>
        {isRecommended && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-500">
            RECOMMENDED
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-col">
        <span className="text-4xl font-medium tracking-tight text-gray-900">
          ${headline.dollars}
        </span>
        <span className="mt-1 text-sm text-gray-500">
          {effectiveInterval === 'year'
            ? 'Per month, billed annually'
            : 'Per month, billed monthly'}
        </span>
        {effectiveInterval === 'year' && annualAvailable && (
          <span className="mt-1 text-xs text-blue-500">
            ${Math.round((plan.annual_price_cents ?? 0) / 100)} billed yearly
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-y-2.5">
        {previousPlanName && (
          <p className="text-sm font-medium text-gray-900">
            Everything from {previousPlanName}, plus:
          </p>
        )}
        {featureLines.map((line, i) => (
          <FeatureRow key={i} label={line} />
        ))}
      </div>

      <div className="mt-6">
        <Button
          onClick={() => onChoose(tier)}
          loading={isPending}
          disabled={disabled || isPending}
          className="w-full bg-black text-white hover:bg-gray-800"
        >
          Start free trial
        </Button>
        <p className="mt-2 text-center text-xs text-gray-400">
          Card required. Won&apos;t be charged during the 14-day trial.
        </p>
      </div>
    </div>
  )
}

const FeatureRow = ({ label }: { label: string }) => (
  <div className="flex flex-row items-start gap-x-2 text-sm text-gray-700">
    <CheckOutlined
      className="mt-0.5 text-gray-400"
      style={{ fontSize: 16 }}
    />
    <span>{label}</span>
  </div>
)

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

const featuresForTier = (plan: TierPlan): string[] => {
  if (plan.tier === 'pro') {
    return [
      'Merchant of Record — Spaire handles tax & VAT',
      `${formatTransactionFee(plan.transaction_fee)} per transaction`,
      `${plan.limits.published_courses} published courses`,
      `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
      `${plan.limits.active_email_sequences} active email sequence`,
      `${plan.limits.video_hours_hosted} hours of hosted video`,
      'Sandbox / test environment',
    ]
  }
  if (plan.tier === 'studio') {
    return [
      `${formatTransactionFee(plan.transaction_fee)} per transaction (saves ~0.2%)`,
      `${plan.limits.published_courses} published courses`,
      `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
      `${plan.limits.active_email_sequences} active email sequences`,
      'Custom email sender domain',
      'White-label course player',
      'Customer wallet',
      `${plan.limits.dashboard_team_seats} team seats`,
    ]
  }
  if (plan.tier === 'scale') {
    return [
      `${formatTransactionFee(plan.transaction_fee)} per transaction (saves ~0.5%)`,
      `${plan.limits.published_courses} published courses`,
      `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
      'Unlimited email sequences',
      `${plan.limits.storage_gb} GB storage`,
      `${plan.limits.dashboard_team_seats} team seats`,
      'Audit logs · dedicated support',
    ]
  }
  return []
}
