'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { toast } from '@/components/Toast/use-toast'
import { useCreateOrganization } from '@/hooks/queries'
import {
  BillingInterval,
  formatTransactionFee,
  headlinePriceForPlan,
  PaidTierKey,
  TierPlan,
  tierDisplayName,
  useSpairePlans,
} from '@/hooks/queries/spaireTier'
import { api } from '@/utils/client'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface PlanSelectPageProps {
  userDisplayName: string
}

/**
 * The "choose your plan" step of the post-signup onboarding flow.
 * Sits between /welcome and /dashboard/[org]/onboarding/review (the
 * profile-basics step). Auto-creates the org with a derived slug on
 * tier confirmation, then either:
 *
 *   - lands the creator on /onboarding/review for Pro (no card needed
 *     for the 14-day Pro trial — the org-created actor attaches it),
 *   - kicks off Spaire's own upgrade-checkout for Studio/Scale and
 *     redirects to Stripe; success_url returns to /onboarding/review
 *     once the trial subscription is captured.
 *
 * The user can rename the org and fill in profile basics on the next
 * step; we generate a placeholder slug here from their account name to
 * avoid a third form on the way in.
 */
const PlanSelectPage = ({ userDisplayName }: PlanSelectPageProps) => {
  const plans = useSpairePlans()
  const createOrg = useCreateOrganization()

  const [interval, setInterval] = useState<BillingInterval>('month')
  const [pending, setPending] = useState<PaidTierKey | null>(null)

  const ordered = useMemo<TierPlan[]>(() => {
    if (!plans.data?.items) return []
    const map = new Map(plans.data.items.map((p) => [p.tier, p]))
    return (['pro', 'studio', 'scale'] as const)
      .map((t) => map.get(t))
      .filter((p): p is TierPlan => Boolean(p))
  }, [plans.data])

  const startTrial = useCallback(
    async (tier: PaidTierKey) => {
      if (pending) return
      setPending(tier)
      try {
        // 1. Auto-create the org with a derived slug. The user can
        //    rename + flesh out profile basics on the next step
        //    (the existing "Create your Space Card" page).
        const slug = await uniqueSlug(userDisplayName)
        const createResult = await createOrg.mutateAsync({
          name: slug,
          slug,
        })
        if (createResult.error || !createResult.data) {
          throw new Error(
            createResult.error?.detail?.[0]?.msg ??
              "Couldn't create your workspace. Try again.",
          )
        }
        const organization = createResult.data

        // 2. Kick off checkout for the chosen tier — every tier (Pro
        //    included) captures a card up front so the 14-day trial
        //    converts automatically when it ends. The upgrade-checkout
        //    endpoint converts the auto-attached Pro trial in place;
        //    when checkout completes, success_url lands the creator
        //    on /onboarding/review (the existing profile-basics step).
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
          throw new Error(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any)?.detail ?? "Couldn't start checkout for this plan.",
          )
        }
        window.location.href = (data as { checkout_url: string }).checkout_url
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong.'
        toast({ title: 'Plan setup failed', description: message })
        setPending(null)
      }
    },
    [createOrg, interval, pending, userDisplayName],
  )

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-white px-4 py-12">
      <div className="mb-12 w-full max-w-lg">
        <OnboardingProgressBar currentStep={1} totalSteps={2} />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-y-10">
        <header className="flex flex-col items-center gap-y-3 text-center">
          <h1 className="text-2xl font-medium tracking-tight text-gray-900">
            Choose a plan
          </h1>
          <p className="max-w-2xl text-sm text-gray-500">
            Every plan starts with a 14-day free trial. You won&apos;t be charged
            during the trial. Switch or cancel any time from Settings.
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
              <PlanSelectCard
                key={plan.tier}
                plan={plan}
                previousPlanName={idx === 0 ? null : ordered[idx - 1].name}
                interval={interval}
                pending={pending}
                onChoose={startTrial}
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

interface PlanSelectCardProps {
  plan: TierPlan
  previousPlanName: string | null
  interval: BillingInterval
  pending: PaidTierKey | null
  onChoose: (tier: PaidTierKey) => void
}

const PlanSelectCard = ({
  plan,
  previousPlanName,
  interval,
  pending,
  onChoose,
}: PlanSelectCardProps) => {
  const tier = plan.tier as PaidTierKey
  const annualAvailable = plan.annual_price_cents != null
  const effectiveInterval: BillingInterval =
    interval === 'year' && !annualAvailable ? 'month' : interval
  const headline = headlinePriceForPlan(plan, effectiveInterval)
  const featureLines = featuresForTier(plan)
  const isPending = pending === tier
  const disabled = pending !== null && pending !== tier

  // Studio is the middle tier and the value pick — standard SaaS
  // pricing pattern is to nudge new signups toward the mid-priced
  // plan (more revenue than Pro, lower commit than Scale, and the
  // best "you get what you need without overpaying" framing).
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

/**
 * Feature lines per tier. Pro lists the baseline (everything a creator
 * needs to know they're getting); Studio and Scale list only the
 * incremental delta — the "Everything from X, plus:" header above them
 * carries the inheritance, so re-listing transaction fee / subscriber
 * caps that just changed in value would feel redundant.
 */
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

// Slug generation: kebab-case the user's display name + a 5-char
// random suffix so we can always create the org without bouncing
// against unique constraints. The user can rename in the next step.
const NANOID_ALPHABET =
  'abcdefghijklmnopqrstuvwxyz0123456789'

const randomSuffix = (length = 5): string => {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += NANOID_ALPHABET[Math.floor(Math.random() * NANOID_ALPHABET.length)]
  }
  return out
}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'workspace'

const uniqueSlug = async (displayHint: string): Promise<string> =>
  // Email local-part is the most likely available chunk; everything
  // before the @ becomes the slug base.
  `${slugify(displayHint.split('@')[0] ?? 'workspace')}-${randomSuffix()}`

export default PlanSelectPage
