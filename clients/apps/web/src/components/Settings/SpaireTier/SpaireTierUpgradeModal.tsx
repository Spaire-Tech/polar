'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import {
  formatMonthlyPrice,
  formatTransactionFee,
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
  defaultTier?: 'pro' | 'scale'
}

/**
 * Side-by-side comparison of Free / Pro / Scale plans. Selecting Pro
 * or Scale fires upgrade-checkout and redirects the creator to the
 * Polar checkout URL where they enter their card and complete the
 * subscription. Free is shown for reference but isn't clickable from
 * here (downgrading happens through the Cancel flow).
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
  const [selected, setSelected] = useState<'pro' | 'scale'>(defaultTier)

  const currentTier: SpaireTierKey | undefined = subscription.data?.tier

  // Order: Free, Pro, Scale. Drop Legacy from the comparison — it's
  // not a selectable upgrade target.
  const ordered = useMemo(() => {
    if (!plans.data?.items) return []
    const map = new Map(plans.data.items.map((p) => [p.tier, p]))
    return (['free', 'pro', 'scale'] as const)
      .map((t) => map.get(t))
      .filter((p): p is TierPlan => Boolean(p))
  }, [plans.data])

  const onUpgrade = useCallback(async () => {
    try {
      const result = await createCheckout.mutateAsync({
        tier: selected,
        success_url: `${window.location.origin}/dashboard/${organizationId}/settings/billing?upgraded=1`,
      })
      // Refresh subscription state once the user comes back.
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
    <div className="flex flex-col">
      <InlineModalHeader hide={hide} title="Upgrade your Spaire plan" />
      <div className="flex flex-col gap-y-6 p-6">
        <p className="text-sm text-gray-500">
          Pick the plan that fits how you sell today. You can switch or
          cancel anytime from this page.
        </p>

        {plans.isLoading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        )}

        {plans.data && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ordered.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                isCurrent={plan.tier === currentTier}
                isSelected={plan.tier === selected}
                onSelect={() => {
                  if (plan.tier === 'free') return
                  setSelected(plan.tier as 'pro' | 'scale')
                }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-row items-center justify-end gap-x-3">
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
              ? `Already on ${selected}`
              : `Continue to ${selected === 'pro' ? 'Pro' : 'Scale'} checkout`}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PlanCardProps {
  plan: TierPlan
  isCurrent: boolean
  isSelected: boolean
  onSelect: () => void
}

const PlanCard = ({ plan, isCurrent, isSelected, onSelect }: PlanCardProps) => {
  const isFree = plan.tier === 'free'
  const clickable = !isFree

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onSelect}
      className={twMerge(
        'flex flex-col rounded-2xl border bg-white p-5 text-left transition-colors',
        'disabled:cursor-default',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500'
          : 'border-gray-200',
        clickable && !isSelected
          ? 'cursor-pointer hover:border-gray-300'
          : '',
      )}
    >
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-base font-medium">{plan.name}</h3>
        {isCurrent && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            Current plan
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-row items-baseline gap-x-1">
        <span className="text-2xl font-medium">
          {formatMonthlyPrice(plan.monthly_price_cents, plan.currency)}
        </span>
        {plan.trial_days && (
          <span className="text-xs text-gray-500">
            ({plan.trial_days}-day trial)
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Transaction fee: {formatTransactionFee(plan.transaction_fee)}
      </p>

      <ul className="mt-5 flex flex-col gap-y-2">
        <PlanFeature
          on={plan.limits.published_courses === null}
          label={
            plan.limits.published_courses === null
              ? 'Unlimited published courses'
              : `${plan.limits.published_courses} published course${
                  plan.limits.published_courses === 1 ? '' : 's'
                }`
          }
        />
        <PlanFeature
          on={plan.limits.email_sends_monthly === null}
          label={
            plan.limits.email_sends_monthly === null
              ? 'Unlimited monthly email sends'
              : `${plan.limits.email_sends_monthly.toLocaleString()} email sends / month`
          }
        />
        <PlanFeature
          on={plan.limits.video_hours_hosted === null}
          label={
            plan.limits.video_hours_hosted === null
              ? 'Unlimited video hosting'
              : `${plan.limits.video_hours_hosted} hours of video hosting`
          }
        />
        <PlanFeature
          on={plan.features.email_sequences_and_segments}
          label="Email sequences & segments"
        />
        <PlanFeature
          on={plan.features.email_ab_testing}
          label="Email A/B testing"
        />
        <PlanFeature
          on={plan.features.custom_email_sender_domain}
          label="Custom email sender domain"
        />
        <PlanFeature
          on={plan.features.seat_based_product_pricing}
          label="Seat-based B2B pricing"
        />
        <PlanFeature
          on={plan.features.white_label_course_player}
          label="White-label course player"
        />
        <PlanFeature
          on={plan.features.audit_logs}
          label="Audit logs"
        />
      </ul>
    </button>
  )
}

const PlanFeature = ({ on, label }: { on: boolean; label: string }) => (
  <li className="flex flex-row items-center gap-x-2 text-xs">
    {on ? (
      <CheckCircleOutlined
        className="text-blue-500"
        style={{ fontSize: 16 }}
      />
    ) : (
      <RadioButtonUncheckedOutlined
        className="text-gray-300"
        style={{ fontSize: 16 }}
      />
    )}
    <span className={on ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
  </li>
)

export default SpaireTierUpgradeModal
