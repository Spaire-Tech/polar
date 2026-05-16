'use client'

import { useEntitlements } from '@/hooks/queries/entitlements'
import { tierDisplayName } from '@/hooks/queries/spaireTier'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Trial-countdown bar mounted at the top of every dashboard page.
 * Renders only while the org is in `trialing`. Urgency ramps up as
 * `days_left` shrinks; the CTA always links to /settings/plan so a
 * payment method can be captured in one click.
 */
export const TrialBanner = () => {
  const { organization } = useContext(OrganizationContext)
  const { status, tier, daysLeftInTrial } = useEntitlements(
    organization?.id,
  )

  if (!organization) return null
  if (status !== 'trialing') return null
  if (daysLeftInTrial === null) return null

  // After day 0 the trial-expiry cron flips the sub to canceled and the
  // banner stops rendering. Until that runs we still want to nudge.
  const days = Math.max(daysLeftInTrial, 0)
  const tierLabel = tier ? tierDisplayName(tier) : 'Spaire'

  // Bucketed urgency: gray banner for the first week, blue from T-7,
  // red on the final day. Background changes; the CTA copy stays the
  // same so the user has one consistent action.
  const tone =
    days <= 1 ? 'urgent' : days <= 7 ? 'warning' : 'info'

  const headline =
    days === 0
      ? `Your ${tierLabel} trial ends today.`
      : days === 1
        ? `Your ${tierLabel} trial ends tomorrow.`
        : `${days} days left on your ${tierLabel} trial.`

  const subcopy =
    days <= 2
      ? 'Add a payment method now to keep your plan.'
      : 'Add a payment method to keep your access when the trial ends.'

  return (
    <div
      className={twMerge(
        'flex w-full flex-row items-center justify-between gap-x-4 border-b px-6 py-2 text-sm',
        tone === 'urgent' &&
          'border-red-200 bg-red-50 text-red-700',
        tone === 'warning' &&
          'border-blue-200 bg-blue-50 text-blue-700',
        tone === 'info' &&
          'border-gray-200 bg-gray-50 text-gray-700',
      )}
    >
      <div className="flex flex-row items-center gap-x-2">
        <ScheduleOutlined style={{ fontSize: 16 }} />
        <span className="font-medium">{headline}</span>
        <span className="hidden text-gray-500 md:inline">{subcopy}</span>
      </div>
      <Link
        href={`/dashboard/${organization.slug}/settings/plan`}
        className={twMerge(
          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
          tone === 'urgent'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-black text-white hover:bg-gray-800',
        )}
      >
        Add payment
      </Link>
    </div>
  )
}
