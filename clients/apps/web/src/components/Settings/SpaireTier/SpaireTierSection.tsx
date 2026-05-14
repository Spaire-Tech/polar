'use client'

import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import {
  CurrentSpaireSubscription,
  formatMonthlyPrice,
  formatTransactionFee,
  PaidTierKey,
  tierDisplayName,
  useCancelSpaireSubscription,
  useCreateCustomerPortalSession,
  useSpaireSubscription,
  useSwitchSpairePlan,
} from '@/hooks/queries/spaireTier'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import { useCallback, useMemo, useState } from 'react'
import { ConfirmModal } from '../../Modal/ConfirmModal'
import {
  SettingsGroup,
  SettingsGroupItem,
} from '../SettingsGroup'
import SpaireTierUpgradeModal from './SpaireTierUpgradeModal'

interface SpaireTierSectionProps {
  organization: schemas['Organization']
}

/**
 * Spaire's own subscription panel — the "what plan am I on with Spaire,
 * and how do I upgrade/cancel" card that lives in Settings → Billing.
 *
 * This is creator-facing UI for the platform-org subscription created
 * by polar/platform/billing.py. Pro / Studio / Scale / Legacy correspond
 * to the tier products seeded by `uv run task seed_platform_products`.
 */
const SpaireTierSection = ({ organization }: SpaireTierSectionProps) => {
  const subscription = useSpaireSubscription(organization.id)
  const upgrade = useModal()
  const confirmCancel = useModal()
  const [pendingTarget, setPendingTarget] = useState<PaidTierKey | null>(null)

  const switchPlan = useSwitchSpairePlan(organization.id)
  const cancelSub = useCancelSpaireSubscription(organization.id)
  const customerPortal = useCreateCustomerPortalSession(organization.id)

  const onSwitch = useCallback(
    async (tier: PaidTierKey) => {
      setPendingTarget(tier)
      try {
        await switchPlan.mutateAsync({ tier })
        toast({
          title: 'Plan switched',
          description: `You're now on Spaire ${tierDisplayName(tier)}.`,
        })
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detail = (err as any)?.detail ?? 'Failed to switch plans.'
        toast({
          title: 'Switch failed',
          description: String(detail),
        })
      } finally {
        setPendingTarget(null)
      }
    },
    [switchPlan],
  )

  const isTrial = subscription.data?.status === 'trialing'

  const onCancel = useCallback(async () => {
    try {
      await cancelSub.mutateAsync()
      toast({
        title: isTrial ? 'Trial ended' : 'Subscription canceled',
        description: isTrial
          ? 'Your Pro trial has ended. Your org has been moved to the Legacy plan; upgrade any time from this page.'
          : 'Your Spaire subscription will end at the close of the current billing period. Your org will be moved to the Legacy plan automatically.',
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
  }, [cancelSub, confirmCancel, isTrial])

  const onOpenPortal = useCallback(async () => {
    try {
      const session = await customerPortal.mutateAsync({
        return_url: window.location.href,
      })
      window.open(session.customer_portal_url, '_blank')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.detail ?? 'Failed to open portal.'
      toast({
        title: 'Portal unavailable',
        description: String(detail),
      })
    }
  }, [customerPortal])

  return (
    <>
      <SettingsGroup>
        <SettingsGroupItem
          title="Current plan"
          description="Your Spaire plan controls transaction fees and feature access."
        >
          {subscription.isLoading ? (
            <div className="h-16 w-48 animate-pulse rounded-xl bg-gray-100" />
          ) : subscription.data ? (
            <PlanSummary sub={subscription.data} />
          ) : (
            <span className="text-sm text-gray-500">—</span>
          )}
        </SettingsGroupItem>

        {subscription.data && (
          <SettingsGroupItem
            title="Manage plan"
            description={describeAction(subscription.data)}
            vertical
          >
            <div className="flex flex-row flex-wrap gap-x-2 gap-y-2">
              <PlanActions
                sub={subscription.data}
                pendingTarget={pendingTarget}
                isSwitching={switchPlan.isPending}
                isPortalLoading={customerPortal.isPending}
                onUpgrade={upgrade.show}
                onSwitch={onSwitch}
                onCancel={confirmCancel.show}
                onOpenPortal={onOpenPortal}
              />
            </div>
          </SettingsGroupItem>
        )}
      </SettingsGroup>

      <InlineModal
        isShown={upgrade.isShown}
        hide={upgrade.hide}
        modalContent={
          <SpaireTierUpgradeModal
            organizationId={organization.id}
            hide={upgrade.hide}
            defaultTier={defaultUpgradeTarget(subscription.data?.tier)}
          />
        }
      />

      <ConfirmModal
        isShown={confirmCancel.isShown}
        hide={confirmCancel.hide}
        title={isTrial ? 'End your Pro trial?' : 'Cancel your Spaire plan?'}
        description={
          isTrial
            ? 'Your Pro trial will end immediately. You will lose Pro features and your org will move to the Legacy plan. You can upgrade again at any time.'
            : subscription.data?.current_period_end
            ? `Your plan stays active through ${new Date(
                subscription.data.current_period_end,
              ).toLocaleDateString()}. After that your org moves to the Legacy plan automatically.`
            : 'Your plan will be canceled at the end of the current billing period and your org will be moved to Legacy.'
        }
        destructiveText={isTrial ? 'Yes, end trial' : 'Yes, cancel'}
        destructive
        onConfirm={onCancel}
      />
    </>
  )
}

const PlanSummary = ({ sub }: { sub: CurrentSpaireSubscription }) => {
  const next = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null
  const trialEnd = sub.trial_end
    ? new Date(sub.trial_end).toLocaleDateString()
    : null

  return (
    <div className="flex flex-col text-right">
      <span className="text-sm font-medium">
        Spaire {tierDisplayName(sub.tier)}
      </span>
      <span className="text-xs text-gray-500">
        {formatMonthlyPrice(sub.monthly_price_cents)} ·{' '}
        {formatTransactionFee(sub.entitlements.transaction_fee)}
      </span>
      {sub.status === 'trialing' && trialEnd && (
        <span className="text-xs text-blue-500">
          Trial ends {trialEnd}
        </span>
      )}
      {sub.cancel_at_period_end && next && (
        <span className="text-xs text-red-500">
          Cancels {next}
        </span>
      )}
      {!sub.cancel_at_period_end && sub.status === 'active' && next && (
        <span className="text-xs text-gray-500">
          Renews {next}
        </span>
      )}
    </div>
  )
}

const PAID_TIERS: PaidTierKey[] = ['pro', 'studio', 'scale']

const isPaidTier = (tier: CurrentSpaireSubscription['tier']): tier is PaidTierKey =>
  (PAID_TIERS as string[]).includes(tier)

const defaultUpgradeTarget = (
  current: CurrentSpaireSubscription['tier'] | undefined,
): PaidTierKey => {
  // Pre-select the next tier up so the modal CTA matches the user's
  // most likely intent. From Pro / Studio that's the next paid step;
  // from Scale or Legacy we fall back to Pro (the entry point).
  switch (current) {
    case 'pro':
      return 'studio'
    case 'studio':
      return 'scale'
    default:
      return 'pro'
  }
}

const describeAction = (sub: CurrentSpaireSubscription): string => {
  if (sub.status === 'trialing') {
    const trialEnd = sub.trial_end
      ? new Date(sub.trial_end).toLocaleDateString()
      : null
    return trialEnd
      ? `You're on a free trial of Spaire ${tierDisplayName(sub.tier)} through ${trialEnd}. Add a payment method to keep your access after the trial.`
      : `You're on a free trial of Spaire ${tierDisplayName(sub.tier)}. Add a payment method to keep your access after the trial.`
  }
  switch (sub.tier) {
    case 'legacy':
      return "You're on the Legacy plan, grandfathered at the pre-tier rate. Upgrade to Pro, Studio, or Scale to unlock the new pricing and feature set."
    case 'pro':
      return 'Switch to Studio or Scale for higher limits, or manage your payment method and invoices.'
    case 'studio':
      return 'Switch to Scale for unlimited everything, downgrade to Pro, or manage your payment method.'
    case 'scale':
      return 'Manage your payment method, view invoices, or contact us for volume pricing.'
  }
}

interface PlanActionsProps {
  sub: CurrentSpaireSubscription
  pendingTarget: PaidTierKey | null
  isSwitching: boolean
  isPortalLoading: boolean
  onUpgrade: () => void
  onSwitch: (tier: PaidTierKey) => void
  onCancel: () => void
  onOpenPortal: () => void
}

const PlanActions = ({
  sub,
  pendingTarget,
  isSwitching,
  isPortalLoading,
  onUpgrade,
  onSwitch,
  onCancel,
  onOpenPortal,
}: PlanActionsProps) => {
  const isPaid = isPaidTier(sub.tier)
  const isLegacy = sub.tier === 'legacy'
  const isTrial = sub.status === 'trialing'

  // Trialing creators need to convert through checkout (capture payment
  // method); legacy creators are starting fresh on the new tier set.
  const showUpgradeCta = isTrial || isLegacy

  // Other-tier switch buttons: only render the two paid tiers the
  // creator isn't currently on.
  const switchTargets: PaidTierKey[] = isPaid
    ? PAID_TIERS.filter((t) => t !== sub.tier)
    : []

  return (
    <>
      {showUpgradeCta && (
        <Button onClick={onUpgrade}>
          {isTrial ? 'Add payment & keep your plan' : 'Upgrade to Pro'}
        </Button>
      )}
      {showUpgradeCta && (
        <Button variant="secondary" onClick={onUpgrade}>
          Compare plans
        </Button>
      )}
      {isPaid &&
        !isTrial &&
        switchTargets.map((target, idx) => (
          <Button
            key={target}
            variant={idx === 0 ? 'default' : 'secondary'}
            onClick={() => onSwitch(target)}
            loading={isSwitching && pendingTarget === target}
            disabled={isSwitching}
          >
            Switch to {tierDisplayName(target)}
          </Button>
        ))}
      {isPaid && (
        <Button
          variant="secondary"
          onClick={onOpenPortal}
          loading={isPortalLoading}
          disabled={isPortalLoading}
        >
          Manage payment <OpenInNewOutlined fontSize="inherit" className="ml-1" />
        </Button>
      )}
      {isPaid && !isTrial && !sub.cancel_at_period_end && (
        <Button variant="ghost" onClick={onCancel}>
          Cancel plan
        </Button>
      )}
      {isTrial && (
        <Button variant="ghost" onClick={onCancel}>
          End trial
        </Button>
      )}
    </>
  )
}

export default SpaireTierSection
