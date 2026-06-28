'use client'

import { QuotaUsage, useSpaireUsage } from '@/hooks/queries/spaireTier'
import { schemas } from '@spaire/client'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { SettingsGroup, SettingsGroupItem } from '../SettingsGroup'

interface QuotaUsageCardProps {
  organization: schemas['Organization']
}

const QUOTA_LABELS: Record<string, { label: string; unit: string }> = {
  video_hours_hosted: { label: 'Video hours hosted', unit: 'hours' },
  video_views_monthly: { label: 'Video views (this month)', unit: 'views' },
  storage_gb: { label: 'File storage', unit: 'GB' },
}

// Order the rows in a UX-friendly sequence rather than enum order.
const ORDER = ['storage_gb', 'video_hours_hosted', 'video_views_monthly']

const QuotaUsageCard = ({ organization }: QuotaUsageCardProps) => {
  const usage = useSpaireUsage(organization.id)

  const sorted = useMemo(() => {
    if (!usage.data?.items) return []
    const byKey = new Map(usage.data.items.map((q) => [q.quota, q]))
    return ORDER.map((k) => byKey.get(k)).filter(
      (q): q is QuotaUsage => Boolean(q),
    )
  }, [usage.data])

  return (
    <SettingsGroup>
      {usage.isLoading && (
        <SettingsGroupItem title="Loading usage…" vertical>
          <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
        </SettingsGroupItem>
      )}
      {!usage.isLoading &&
        sorted.map((q) => <QuotaRow key={q.quota} quota={q} />)}
    </SettingsGroup>
  )
}

const QuotaRow = ({ quota }: { quota: QuotaUsage }) => {
  const meta = QUOTA_LABELS[quota.quota] ?? {
    label: quota.quota,
    unit: 'units',
  }
  const isUnlimited = quota.is_unlimited
  const percent =
    isUnlimited || quota.limit === 0 || quota.limit === null
      ? 0
      : Math.min(100, Math.round((quota.used / quota.limit) * 100))

  const barColor = quota.is_exceeded
    ? 'bg-red-500'
    : percent >= 80
      ? 'bg-amber-500'
      : 'bg-blue-500'

  return (
    <SettingsGroupItem
      title={meta.label}
      description={
        isUnlimited
          ? 'Unlimited on your current plan'
          : quota.is_exceeded
            ? `You're at or over the cap. Upgrade your plan to keep going.`
            : `${quota.used.toLocaleString()} of ${quota.limit?.toLocaleString()} ${meta.unit} used`
      }
      vertical
    >
      <div className="flex w-full flex-col gap-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          {!isUnlimited && (
            <div
              className={twMerge('h-full transition-all', barColor)}
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
        <div className="flex flex-row items-center justify-between text-xs text-gray-500">
          <span>
            {isUnlimited
              ? '∞'
              : `${percent}%`}
          </span>
          <span>
            {isUnlimited
              ? `${quota.used.toLocaleString()} ${meta.unit}`
              : `${quota.remaining?.toLocaleString() ?? 0} ${meta.unit} remaining`}
          </span>
        </div>
        {quota.is_exceeded && (
          <a
            href="#plans"
            className="text-xs font-medium text-blue-500 hover:text-blue-600"
          >
            Upgrade your plan to raise this limit →
          </a>
        )}
      </div>
    </SettingsGroupItem>
  )
}

export default QuotaUsageCard
