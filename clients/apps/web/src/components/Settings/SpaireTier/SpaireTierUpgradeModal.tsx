'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import {
  formatMonthlyPrice,
  formatTransactionFee,
  PaidTierKey,
  SpaireTierKey,
  TierPlan,
  useCreateUpgradeCheckout,
  useSpairePlans,
  useSpaireSubscription,
} from '@/hooks/queries/spaireTier'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import RadioButtonUncheckedOutlined from '@mui/icons-material/RadioButtonUncheckedOutlined'
import { useQueryClient } from '@tanstack/react-query'
import Button from '@spaire/ui/components/atoms/Button'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface SpaireTierUpgradeModalProps {
  organizationId: string
  hide: () => void
  // When provided, the modal opens with this tier highlighted.
  defaultTier?: PaidTierKey
}

/**
 * Side-by-side comparison of Pro / Studio / Scale plans, laid out as a
 * vertical list of plan rows inside the InlineModal side panel. The
 * panel is 540px wide by default which is too narrow for a 3-column
 * card grid; stacking rows keeps each plan readable. Every paid tier
 * comes with a 14-day free trial so the CTA stays consistent.
 */
const SpaireTierUpgradeModal = ({
  organizationId,
  hide,
  defaultTier = 'pro',
}: SpaireTierUpgradeModalProps) => {
  const queryClient = useQueryClient()
  const plans = useSpairePlans()
  const subscription = useSpaireSubscription(organizationId)
  const createCheckout = useCreateUpgradeCheckout(organizationId)
  const [selected, setSelected] = useState<PaidTierKey>(defaultTier)

  const currentTier: SpaireTierKey | undefined = subscription.data?.tier

  // Order: Pro, Studio, Scale. Drop Legacy from the comparison — it's
  // not a selectable upgrade target.
  const ordered = useMemo(() => {
    if (!plans.data?.items) return []
    const map = new Map(plans.data.items.map((p) => [p.tier, p]))
    return (['pro', 'studio', 'scale'] as const)
      .map((t) => map.get(t))
      .filter((p): p is TierPlan => Boolean(p))
  }, [plans.data])

  const onUpgrade = useCallback(async () => {
    try {
      const result = await createCheckout.mutateAsync({
        tier: selected,
        success_url: `${window.location.origin}/dashboard/${organizationId}/settings/billing?upgraded=1`,
      })
      queryClient.invalidateQueries({
        queryKey: ['spaire', 'subscription', organizationId],
      })
      window.location.href = result.checkout_url
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.detail ?? 'Failed to start checkout.'
      toast({
        title: 'Upgrade failed',
        description: String(detail),
      })
    }
  }, [createCheckout, organizationId, queryClient, selected])

  return (
    <div className="flex h-full flex-col">
      <InlineModalHeader hide={hide}>
        <h2>Upgrade your Spaire plan</h2>
      </InlineModalHeader>

      <div className="flex flex-1 flex-col gap-y-5 overflow-y-auto px-8 pb-6">
        <p className="text-sm text-gray-500">
          Pick the plan that fits how you sell today. You can switch or
          cancel anytime from this page.
        </p>

        {plans.isLoading && (
          <div className="flex flex-col gap-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 w-full animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        )}

        {plans.data && (
          <div className="flex flex-col gap-y-3">
            {ordered.map((plan) => (
              <PlanRow
                key={plan.tier}
                plan={plan}
                isCurrent={plan.tier === currentTier}
                isSelected={plan.tier === selected}
                onSelect={() => {
                  if (plan.tier === 'legacy') return
                  setSelected(plan.tier as PaidTierKey)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-row items-center justify-end gap-x-3 border-t border-gray-100 px-8 py-4">
        <Button variant="ghost" onClick={hide} type="button">
          Cancel
        </Button>
        <Button
          onClick={onUpgrade}
          loading={createCheckout.isPending}
          disabled={
            createCheckout.isPending ||
            !plans.data ||
            currentTier === selected
          }
        >
          {currentTier === selected
            ? `Already on ${tierLabel(selected)}`
            : `Continue to ${tierLabel(selected)} checkout`}
        </Button>
      </div>
    </div>
  )
}

const tierLabel = (tier: PaidTierKey): string => {
  switch (tier) {
    case 'pro':
      return 'Pro'
    case 'studio':
      return 'Studio'
    case 'scale':
      return 'Scale'
  }
}

interface PlanRowProps {
  plan: TierPlan
  isCurrent: boolean
  isSelected: boolean
  onSelect: () => void
}

const PlanRow = ({ plan, isCurrent, isSelected, onSelect }: PlanRowProps) => {
  // Only Legacy is non-selectable (no upgrade target). Pro/Studio/Scale
  // are all paid and clickable.
  const clickable = plan.tier !== 'legacy'

  // Pick the 5 most-differentiating features to keep the row compact.
  const highlights: Array<{ on: boolean; label: string }> = [
    {
      on: plan.limits.published_courses === null,
      label:
        plan.limits.published_courses === null
          ? 'Unlimited courses'
          : `${plan.limits.published_courses} course${plan.limits.published_courses === 1 ? '' : 's'}`,
    },
    {
      on: plan.limits.email_sends_monthly === null,
      label:
        plan.limits.email_sends_monthly === null
          ? 'Unlimited monthly sends'
          : `${formatCount(plan.limits.email_sends_monthly)} email sends / mo`,
    },
    {
      on: plan.features.email_sequences_and_segments,
      label: 'Email sequences & segments',
    },
    {
      on: plan.features.custom_email_sender_domain,
      label: 'Custom sender domain',
    },
    {
      on: plan.features.white_label_course_player,
      label: 'White-label player',
    },
  ]

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onSelect}
      className={twMerge(
        'flex w-full flex-col gap-y-3 rounded-2xl border bg-white p-5 text-left transition-colors',
        'disabled:cursor-default',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500'
          : 'border-gray-200',
        clickable && !isSelected
          ? 'cursor-pointer hover:border-gray-300'
          : '',
      )}
    >
      <div className="flex flex-row items-center justify-between gap-x-4">
        <div className="flex flex-col">
          <div className="flex flex-row items-center gap-x-2">
            <h3 className="text-base font-medium">{plan.name}</h3>
            {isCurrent && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Current
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatTransactionFee(plan.transaction_fee)} per transaction
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xl font-medium">
            {formatMonthlyPrice(plan.monthly_price_cents, plan.currency)}
          </span>
          {plan.trial_days && (
            <span className="text-xs text-blue-500">
              {plan.trial_days}-day free trial
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {highlights.map(({ on, label }) => (
          <div
            key={label}
            className="flex flex-row items-center gap-x-1.5 text-xs"
          >
            {on ? (
              <CheckCircleOutlined
                className="text-blue-500"
                style={{ fontSize: 14 }}
              />
            ) : (
              <RadioButtonUncheckedOutlined
                className="text-gray-300"
                style={{ fontSize: 14 }}
              />
            )}
            <span
              className={on ? 'text-gray-900' : 'text-gray-400 line-through'}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export default SpaireTierUpgradeModal
