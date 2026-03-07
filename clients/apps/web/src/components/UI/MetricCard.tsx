'use client'

import { twMerge } from 'tailwind-merge'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
  prefix?: string
  suffix?: string
  loading?: boolean
  className?: string
}

/**
 * Compact KPI metric card.
 * Used in 4-column grids above analytics charts and on the overview page.
 * No chart inside — keeps the card lean and scannable (Stripe pattern).
 */
export const MetricCard = ({
  label,
  value,
  delta,
  prefix,
  suffix,
  loading = false,
  className,
}: MetricCardProps) => {
  if (loading) {
    return (
      <div
        className={twMerge(
          'dark:bg-spaire-900 dark:border-spaire-800 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4',
          className,
        )}
      >
        <div className="dark:bg-spaire-700 h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="dark:bg-spaire-700 h-7 w-32 animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'dark:bg-spaire-900 dark:border-spaire-800 flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4',
        className,
      )}
    >
      <span className="dark:text-spaire-400 text-xs font-medium tracking-wide text-gray-500 uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className="text-sm font-medium text-gray-500 dark:text-spaire-400">
            {prefix}
          </span>
        )}
        <span className="text-2xl font-semibold text-gray-900 dark:text-white">
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-gray-500 dark:text-spaire-400">
            {suffix}
          </span>
        )}
      </div>
      {delta && (
        <span
          className={twMerge(
            'text-xs font-medium',
            delta.direction === 'up' && 'text-green-500',
            delta.direction === 'down' && 'text-red-500',
            delta.direction === 'neutral' && 'text-gray-400 dark:text-spaire-500',
          )}
        >
          {delta.value}
        </span>
      )}
    </div>
  )
}
