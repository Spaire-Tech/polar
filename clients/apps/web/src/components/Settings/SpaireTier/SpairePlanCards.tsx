'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  BillingInterval,
  breakevenGmvDollars,
  CurrentSpaireSubscription,
  formatTransactionFee,
  headlinePriceForPlan,
  PaidTierKey,
  renewalSentence,
  TierPlan,
  tierDisplayName,
  useCancelSpaireSubscription,
  useCreateUpgradeCheckout,
  useSpairePlans,
  useSpaireSubscription,
  useSwitchSpairePlan,
} from '@/hooks/queries/spaireTier'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { useQueryClient } from '@tanstack/react-query'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ConfirmModal } from '../../Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'

interface SpairePlanCardsProps {
  organization: schemas['Organization']
}

/**
 * Plan-selection grid — three cards (Starter / Studio / Scale) styled to
 * match the Framer/Webflow plan-card pattern, with a single global
 * Monthly/Annual toggle.
 *
 * The card the user is currently subscribed to renders the CURRENT
 * badge and a secondary "Cancel" CTA. Other cards show a primary
 * black CTA that maps to the right action ("Upgrade", "Switch to X",
 * or "Add payment & keep your plan" during a trial).
 */
const SpairePlanCards = ({ organization }: SpairePlanCardsProps) => {
  const plans = useSpairePlans()
  const subscription = useSpaireSubscription(organization.id)
  const queryClient = useQueryClient()
  const createCheckout = useCreateUpgradeCheckout(organization.id)
  const switchPlan = useSwitchSpairePlan(organization.id)
  const cancelSub = useCancelSpaireSubscription(organization.id)

  const confirmCancel = useModal()
  const confirmSwitch = useModal()
  const [switchTarget, setSwitchTarget] = useState<PaidTierKey | null>(null)
  const [interval, setInterval] = useState<BillingInterval>(
    subscription.data?.billing_interval ?? 'month',
  )
  const [pending, setPending] = useState<PaidTierKey | null>(null)

  const ordered = useMemo<TierPlan[]>(() => {
    if (!plans.data?.items) return []
    const map = new Map(plans.data.items.map((p) => [p.tier, p]))
    return (['starter', 'studio', 'scale'] as const)
      .map((t) => map.get(t))
      .filter((p): p is TierPlan => Boolean(p))
  }, [plans.data])

  const currentTier = subscription.data?.tier
  const currentInterval = subscription.data?.billing_interval
  const isTrial = subscription.data?.status === 'trialing'
  const sub = subscription.data

  const startCheckout = useCallback(
    async (tier: PaidTierKey) => {
      setPending(tier)
      try {
        const result = await createCheckout.mutateAsync({
          tier,
          billing_interval: interval,
          success_url: `${window.location.origin}/dashboard/${organization.slug}/settings/plan?upgraded=1`,
        })
        queryClient.invalidateQueries({
          queryKey: ['spaire', 'subscription', organization.id],
        })
        window.location.href = result.checkout_url
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detail = (err as any)?.detail ?? 'Failed to start checkout.'
        toast({ title: 'Upgrade failed', description: String(detail) })
        setPending(null)
      }
    },
    [createCheckout, interval, organization.id, organization.slug, queryClient],
  )

  const doSwitch = useCallback(
    async (tier: PaidTierKey) => {
      setPending(tier)
      try {
        await switchPlan.mutateAsync({ tier, billing_interval: interval })
        toast({
          title: 'Plan updated',
          description: `You're now on Spaire ${tierDisplayName(tier)}${interval === 'year' ? ' (annual)' : ''}.`,
        })
        queryClient.invalidateQueries({
          queryKey: ['spaire', 'subscription', organization.id],
        })
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detail = (err as any)?.detail ?? 'Failed to switch plans.'
        toast({ title: 'Switch failed', description: String(detail) })
      } finally {
        setPending(null)
      }
    },
    [switchPlan, interval, organization.id, queryClient],
  )

  const requestSwitch = useCallback(
    (tier: PaidTierKey) => {
      setSwitchTarget(tier)
      confirmSwitch.show()
    },
    [confirmSwitch],
  )

  const onConfirmSwitch = useCallback(async () => {
    if (switchTarget === null) return
    confirmSwitch.hide()
    await doSwitch(switchTarget)
    setSwitchTarget(null)
  }, [switchTarget, confirmSwitch, doSwitch])

  const onCancel = useCallback(async () => {
    try {
      await cancelSub.mutateAsync()
      toast({
        title: isTrial ? 'Trial ended' : 'Subscription canceled',
        description: isTrial
          ? 'Your trial has ended. Your org has no active plan — pick one any time from this page to restore access.'
          : 'Your Spaire subscription will end at the close of the current billing period, after which your org will have no active plan until you pick one.',
      })
      queryClient.invalidateQueries({
        queryKey: ['spaire', 'subscription', organization.id],
      })
      confirmCancel.hide()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.detail ?? 'Failed to cancel.'
      toast({
        title: isTrial ? 'End trial failed' : 'Cancel failed',
        description: String(detail),
      })
    }
  }, [cancelSub, confirmCancel, isTrial, organization.id, queryClient])

  return (
    <div className="flex flex-col gap-6">
      <Header
        sub={sub}
        plansLoading={plans.isLoading}
        subLoading={subscription.isLoading}
        interval={interval}
        onInterval={setInterval}
      />

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
              previousPlan={idx === 0 ? null : ordered[idx - 1]}
              interval={interval}
              currentTier={currentTier}
              currentInterval={currentInterval ?? null}
              isTrial={Boolean(isTrial)}
              status={sub?.status ?? null}
              cancelAtPeriodEnd={Boolean(sub?.cancel_at_period_end)}
              pending={pending}
              onUpgrade={startCheckout}
              onSwitch={requestSwitch}
              onCancel={confirmCancel.show}
            />
          ))}
        </div>
      )}

      <p className="mt-2 text-center text-sm text-gray-500">
        Compare all plans and features
      </p>

      <ConfirmModal
        isShown={confirmCancel.isShown}
        hide={confirmCancel.hide}
        title={isTrial ? 'End your trial?' : 'Cancel your Spaire plan?'}
        description={
          isTrial
            ? 'Your trial will end immediately. You will lose access until you pick a plan — you can choose one again at any time.'
            : sub?.current_period_end
              ? `Your plan stays active through ${new Date(
                  sub.current_period_end,
                ).toLocaleDateString()}. After that your org has no active plan until you pick one.`
              : 'Your plan will be canceled at the end of the current billing period, after which your org has no active plan until you pick one.'
        }
        destructiveText={isTrial ? 'Yes, end trial' : 'Yes, cancel'}
        destructive
        onConfirm={onCancel}
      />

      <ConfirmModal
        isShown={confirmSwitch.isShown}
        hide={() => {
          confirmSwitch.hide()
          setSwitchTarget(null)
        }}
        title={
          switchTarget
            ? `Switch to Spaire ${tierDisplayName(switchTarget)}?`
            : 'Switch plan?'
        }
        description={
          switchTarget
            ? `You'll move to Spaire ${tierDisplayName(switchTarget)}${
                interval === 'year' ? ' (annual)' : ''
              } now. Your card on file is used and a prorated amount for the rest of this billing period is invoiced immediately. Your transaction fee updates to the new plan's rate right away.`
            : ''
        }
        onConfirm={onConfirmSwitch}
      />
    </div>
  )
}

interface HeaderProps {
  sub: CurrentSpaireSubscription | undefined
  plansLoading: boolean
  subLoading: boolean
  interval: BillingInterval
  onInterval: (interval: BillingInterval) => void
}

const Header = ({ sub, subLoading, interval, onInterval }: HeaderProps) => {
  const renewal = sub ? renewalSentence(sub) : null

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-medium text-gray-900">Plans</h1>
        {subLoading ? (
          <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
        ) : (
          <p className="text-sm text-gray-500">
            {renewal ?? "Pick a plan to get started. We'll charge you when your trial ends."}
          </p>
        )}
      </div>

      <IntervalToggle interval={interval} onChange={onInterval} />
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
  previousPlan: TierPlan | null
  interval: BillingInterval
  currentTier: CurrentSpaireSubscription['tier'] | undefined
  currentInterval: BillingInterval | null
  isTrial: boolean
  status: string | null
  cancelAtPeriodEnd: boolean
  pending: PaidTierKey | null
  onUpgrade: (tier: PaidTierKey) => void
  onSwitch: (tier: PaidTierKey) => void
  onCancel: () => void
}

const PlanCard = ({
  plan,
  previousPlan,
  interval,
  currentTier,
  currentInterval,
  isTrial,
  status,
  cancelAtPeriodEnd,
  pending,
  onUpgrade,
  onSwitch,
  onCancel,
}: PlanCardProps) => {
  const isCurrentTier = plan.tier === currentTier
  const previousPlanName = previousPlan?.name ?? null
  // Volume at which this tier's lower rate outweighs its higher monthly
  // fee vs the next-cheaper tier — the "upgrade pays for itself here" line.
  const breakeven = previousPlan
    ? breakevenGmvDollars(previousPlan, plan)
    : null
  const annualAvailable = plan.annual_price_cents != null
  const effectiveInterval: BillingInterval =
    interval === 'year' && !annualAvailable ? 'month' : interval

  const headline = headlinePriceForPlan(plan, effectiveInterval)
  const featureLines = buildFeatureLines(plan)
  const cta = resolveCta({
    plan,
    interval: effectiveInterval,
    currentTier,
    currentInterval,
    isTrial,
    status,
    cancelAtPeriodEnd,
  })

  return (
    <div
      className={twMerge(
        'flex flex-col rounded-2xl border bg-white p-6',
        isCurrentTier ? 'border-blue-500' : 'border-gray-200',
      )}
    >
      {/* Header row: plan name + CURRENT badge */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-2">
          <h3 className="text-base font-medium text-gray-900">
            {tierDisplayName(plan.tier)}
          </h3>
          {isCurrentTier && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-500">
              CURRENT
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="mt-6 flex flex-col">
        <span className="text-4xl font-medium tracking-tight text-gray-900">
          ${headline.dollars}
        </span>
        <span className="mt-1 text-sm text-gray-500">
          {effectiveInterval === 'year'
            ? `Per month, billed annually${
                annualAvailable ? '' : ''
              }`
            : 'Per month, billed monthly'}
        </span>
        {effectiveInterval === 'year' && annualAvailable && (
          <span className="mt-1 text-xs text-blue-500">
            ${Math.round((plan.annual_price_cents ?? 0) / 100)} billed yearly
          </span>
        )}
        {plan.trial_days && !isCurrentTier && (
          <span className="mt-1 text-xs text-gray-500">
            {plan.trial_days}-day free trial included
          </span>
        )}
        {breakeven !== null && previousPlanName && (
          <span className="mt-2 text-xs text-gray-500">
            Cheaper than {previousPlanName} above{' '}
            <span className="font-medium text-gray-700">
              ~${breakeven.toLocaleString('en-US')}/mo
            </span>{' '}
            in sales
          </span>
        )}
      </div>

      {/* Features */}
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

      {/* CTA */}
      <div className="mt-6">
        <PlanCardButton
          cta={cta}
          loading={pending === plan.tier}
          disabled={pending !== null && pending !== plan.tier}
          onUpgrade={() => onUpgrade(plan.tier as PaidTierKey)}
          onSwitch={() => onSwitch(plan.tier as PaidTierKey)}
          onCancel={onCancel}
        />
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

// -----------------------------------------------------------------------------
// CTA resolution
// -----------------------------------------------------------------------------

type CtaKind =
  | { kind: 'cancel' } // CURRENT and active — show Cancel
  | { kind: 'end_trial' } // CURRENT and trialing — show End trial
  | { kind: 'convert_trial' } // trialing on this exact tier+interval, prompt to add card
  | { kind: 'switch'; primary: boolean } // paid → paid switch
  | { kind: 'upgrade'; primary: boolean } // no plan or trial → checkout
  | { kind: 'downgrade' } // paid on a higher tier → switch down
  | { kind: 'noop' }

interface ResolveCtaArgs {
  plan: TierPlan
  interval: BillingInterval
  currentTier: CurrentSpaireSubscription['tier'] | undefined
  currentInterval: BillingInterval | null
  isTrial: boolean
  status: string | null
  cancelAtPeriodEnd: boolean
}

const TIER_ORDER: Record<string, number> = {
  // No-plan states rank below every paid tier so any plan reads as an upgrade.
  inactive: 0,
  unmanaged: 0,
  starter: 1,
  studio: 2,
  scale: 3,
}

const resolveCta = (args: ResolveCtaArgs): CtaKind => {
  const { plan, interval, currentTier, currentInterval, isTrial, status } = args
  if (!currentTier) return { kind: 'upgrade', primary: true }

  const planRank = TIER_ORDER[plan.tier]
  const currentRank = TIER_ORDER[currentTier]
  // No active plan (inactive/unmanaged) takes the checkout path, like a trial.
  const isNoPlan = currentTier === 'inactive' || currentTier === 'unmanaged'

  // The card representing the user's exact current (tier, interval).
  const exactlyCurrent = plan.tier === currentTier && interval === currentInterval

  if (exactlyCurrent) {
    if (status === 'canceled' || args.cancelAtPeriodEnd) {
      // Already on the way out; offer a re-up via checkout.
      return { kind: 'upgrade', primary: true }
    }
    if (isTrial) return { kind: 'end_trial' }
    return { kind: 'cancel' }
  }

  // Same tier, different interval (e.g. Starter monthly user looking at
  // Starter annual). Allow the switch via update_product unless trialing.
  if (plan.tier === currentTier && interval !== currentInterval) {
    if (isTrial) {
      return { kind: 'convert_trial' }
    }
    return { kind: 'switch', primary: true }
  }

  // No plan or trial → a paid tier: checkout.
  if (isNoPlan || isTrial) {
    return { kind: 'upgrade', primary: planRank >= currentRank }
  }

  // Paid → higher paid: switch (highlighted primary).
  if (planRank > currentRank) {
    return { kind: 'switch', primary: true }
  }

  // Paid → lower paid: downgrade allowed but not the headline CTA.
  return { kind: 'downgrade' }
}

interface PlanCardButtonProps {
  cta: CtaKind
  loading: boolean
  disabled: boolean
  onUpgrade: () => void
  onSwitch: () => void
  onCancel: () => void
}

const PlanCardButton = ({
  cta,
  loading,
  disabled,
  onUpgrade,
  onSwitch,
  onCancel,
}: PlanCardButtonProps) => {
  switch (cta.kind) {
    case 'cancel':
      return (
        <Button
          variant="outline"
          className="w-full border-blue-500 text-blue-500 hover:bg-blue-50"
          onClick={onCancel}
        >
          Cancel
        </Button>
      )
    case 'end_trial':
      return (
        <Button
          variant="outline"
          className="w-full border-blue-500 text-blue-500 hover:bg-blue-50"
          onClick={onCancel}
        >
          End trial
        </Button>
      )
    case 'convert_trial':
      return (
        <PrimaryBlackButton
          loading={loading}
          disabled={disabled}
          onClick={onUpgrade}
        >
          Add payment & keep plan
        </PrimaryBlackButton>
      )
    case 'upgrade':
      return cta.primary ? (
        <PrimaryBlackButton
          loading={loading}
          disabled={disabled}
          onClick={onUpgrade}
        >
          Upgrade
        </PrimaryBlackButton>
      ) : (
        <Button
          variant="outline"
          className="w-full border-blue-500 text-blue-500 hover:bg-blue-50"
          disabled={disabled}
          loading={loading}
          onClick={onUpgrade}
        >
          Choose plan
        </Button>
      )
    case 'switch':
      return (
        <PrimaryBlackButton
          loading={loading}
          disabled={disabled}
          onClick={onSwitch}
        >
          Switch
        </PrimaryBlackButton>
      )
    case 'downgrade':
      return (
        <Button
          variant="outline"
          className="w-full border-blue-500 text-blue-500 hover:bg-blue-50"
          disabled={disabled}
          loading={loading}
          onClick={onSwitch}
        >
          Downgrade
        </Button>
      )
    case 'noop':
      return <div className="h-10" />
  }
}

const PrimaryBlackButton = ({
  loading,
  disabled,
  onClick,
  children,
}: {
  loading: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <Button
    onClick={onClick}
    loading={loading}
    disabled={disabled || loading}
    className="w-full bg-black text-white hover:bg-gray-800"
  >
    {children}
  </Button>
)

// -----------------------------------------------------------------------------
// Feature copy — picks the lines that best differentiate each tier
// -----------------------------------------------------------------------------

const buildFeatureLines = (plan: TierPlan): string[] => {
  if (plan.tier === 'starter') return starterLines(plan)
  if (plan.tier === 'studio') return studioLines(plan)
  if (plan.tier === 'scale') return scaleLines(plan)
  // Defensive — Legacy isn't in the card grid.
  return []
}

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// Starter lists the full baseline. Studio and Scale list only the
// incremental delta — the "Everything from X, plus:" header above them
// in the card carries the inheritance, so re-listing identical rows
// would just inflate the cards.
const starterLines = (plan: TierPlan): string[] => [
  'Merchant of Record — Spaire handles tax & VAT',
  `${formatTransactionFee(plan.transaction_fee)} per transaction`,
  `${plan.limits.published_courses} published courses`,
  `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
  'Unlimited email sends',
  'Unlimited email sequences',
  `${plan.limits.video_hours_hosted} hours of hosted video`,
  'Sandbox / test environment',
]

const studioLines = (plan: TierPlan): string[] => [
  `${formatTransactionFee(plan.transaction_fee)} per transaction (saves 2% vs Starter)`,
  `${plan.limits.published_courses} published courses`,
  `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
  'Custom email sender domain',
  'White-label course player',
  'Customer wallet',
  `${plan.limits.dashboard_team_seats} team seats`,
]

const scaleLines = (plan: TierPlan): string[] => [
  `${formatTransactionFee(plan.transaction_fee)} per transaction (saves 4% vs Starter)`,
  `${plan.limits.published_courses} published courses`,
  `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
  'Unlimited email sequences',
  `${plan.limits.storage_gb} GB storage`,
  `${plan.limits.dashboard_team_seats} team seats`,
  'Audit logs',
  'Dedicated support · 4-hour SLA',
]

export default SpairePlanCards
