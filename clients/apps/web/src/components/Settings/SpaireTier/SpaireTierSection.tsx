'use client'

import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import {
  CurrentSpaireSubscription,
  formatMonthlyPrice,
  formatTransactionFee,
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
 * by polar/platform/billing.py. Free / Pro / Scale / Legacy correspond
 * to the tier products seeded by `uv run task seed_platform_products`.
 */
const SpaireTierSection = ({ organization }: SpaireTierSectionProps) => {
  const subscription = useSpaireSubscription(organization.id)
  const upgrade = useModal()
  const confirmCancel = useModal()
  const [pendingTarget, setPendingTarget] = useState<'pro' | 'scale' | null>(
    null,
  )

  const switchPlan = useSwitchSpairePlan(organization.id)
  const cancelSub = useCancelSpaireSubscription(organization.id)
  const customerPortal = useCreateCustomerPortalSession(organization.id)

  const onSwitch = useCallback(
    async (tier: 'pro' | 'scale') => {
      setPendingTarget(tier)
      try {
        await switchPlan.mutateAsync({ tier })
        toast({
          title: 'Plan switched',
          description: `You're now on Spaire ${tier === 'pro' ? 'Pro' : 'Scale'}.`,
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

  const onCancel = useCallback(async () => {
    try {
      await cancelSub.mutateAsync()
      toast({
        title: 'Subscription canceled',
        description:
          'Your Spaire subscription will end at the close of the current billing period. Your org will be re-enrolled on Free automatically.',
      })
      confirmCancel.hide()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.detail ?? 'Failed to cancel.'
      toast({
        title: 'Cancel failed',
        description: String(detail),
      })
    }
  }, [cancelSub, confirmCancel])

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
            defaultTier={
              subscription.data?.tier === 'pro' ? 'scale' : 'pro'
            }
          />
        }
      />

      <ConfirmModal
        isShown={confirmCancel.isShown}
        hide={confirmCancel.hide}
        title="Cancel your Spaire plan?"
        description={
          subscription.data?.current_period_end
            ? `Your plan stays active through ${new Date(
                subscription.data.current_period_end,
              ).toLocaleDateString()}. After that you'll be re-enrolled on the Free plan automatically.`
            : 'Your plan will be canceled at the end of the current billing period and you will be re-enrolled on Free.'
        }
        destructiveText="Yes, cancel"
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

const describeAction = (sub: CurrentSpaireSubscription): string => {
  switch (sub.tier) {
    case 'free':
      return 'Upgrade to Pro or Scale to unlock higher limits and creator features.'
    case 'legacy':
      return "You're on the legacy plan, grandfathered at the pre-tier rate. You can upgrade to Pro or Scale to access the new features."
    case 'pro':
      return 'Switch to Scale for unlimited everything, or manage your payment method and invoices.'
    case 'scale':
      return 'Manage your payment method, view invoices, or contact us for volume pricing.'
  }
}

interface PlanActionsProps {
  sub: CurrentSpaireSubscription
  pendingTarget: 'pro' | 'scale' | null
  isSwitching: boolean
  isPortalLoading: boolean
  onUpgrade: () => void
  onSwitch: (tier: 'pro' | 'scale') => void
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
  const isPaid = sub.tier === 'pro' || sub.tier === 'scale'
  const isFreeish = sub.tier === 'free' || sub.tier === 'legacy'

  return (
    <>
      {isFreeish && (
        <Button onClick={onUpgrade}>Upgrade to Pro</Button>
      )}
      {isFreeish && (
        <Button variant="secondary" onClick={onUpgrade}>
          Compare plans
        </Button>
      )}
      {sub.tier === 'pro' && (
        <Button
          onClick={() => onSwitch('scale')}
          loading={isSwitching && pendingTarget === 'scale'}
          disabled={isSwitching}
        >
          Switch to Scale
        </Button>
      )}
      {sub.tier === 'scale' && (
        <Button
          variant="secondary"
          onClick={() => onSwitch('pro')}
          loading={isSwitching && pendingTarget === 'pro'}
          disabled={isSwitching}
        >
          Switch to Pro
        </Button>
      )}
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
      {isPaid && !sub.cancel_at_period_end && (
        <Button variant="ghost" onClick={onCancel}>
          Cancel plan
        </Button>
      )}
    </>
  )
}

export default SpaireTierSection
