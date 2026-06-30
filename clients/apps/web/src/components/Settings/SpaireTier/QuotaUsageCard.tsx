'use client'

import { QuotaUsage, useSpaireUsage } from '@/hooks/queries/spaireTier'
import { schemas } from '@spaire/client'
import { useMemo } from 'react'

interface QuotaUsageCardProps {
  organization: schemas['Organization']
}

const QUOTA_LABELS: Record<string, { label: string; unit: string }> = {
  video_hours_hosted: { label: 'Video hours hosted', unit: 'hours' },
  video_views_monthly: { label: 'Video views', unit: 'views' },
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
    <div className="dark:border-polar-700 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:bg-transparent">
      {usage.isLoading ? (
        <div className="flex flex-col gap-y-6 p-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 w-full animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      ) : (
        <div className="dark:divide-polar-700 divide-y divide-gray-100">
          {sorted.map((q) => (
            <QuotaRow key={q.quota} quota={q} />
          ))}
        </div>
      )}
    </div>
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

  return (
    <div className="flex flex-col gap-y-2.5 px-6 py-5">
      {/* Label + headline figure, aligned to the edges so the numbers form a
          clean column down the card. */}
      <div className="flex items-baseline justify-between gap-x-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {meta.label}
        </span>
        <span className="text-sm tabular-nums text-gray-900 dark:text-white">
          {isUnlimited ? (
            'Unlimited'
          ) : (
            <>
              {quota.used.toLocaleString()}
              <span className="text-gray-400">
                {' '}
                / {quota.limit?.toLocaleString()} {meta.unit}
              </span>
            </>
          )}
        </span>
      </div>

      {!isUnlimited && (
        <div className="dark:bg-polar-700 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-900 transition-all dark:bg-white"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {isUnlimited ? 'Unlimited on your current plan' : `${percent}% used`}
        </span>
        <span className="tabular-nums">
          {isUnlimited
            ? `${quota.used.toLocaleString()} ${meta.unit}`
            : quota.is_exceeded
              ? 'Over limit'
              : `${quota.remaining?.toLocaleString() ?? 0} ${meta.unit} left`}
        </span>
      </div>

      {quota.is_exceeded && (
        <a
          href="#plans"
          className="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          Upgrade your plan to raise this limit
        </a>
      )}
    </div>
  )
}

export default QuotaUsageCard
