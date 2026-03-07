'use client'

import { twMerge } from 'tailwind-merge'

export type BadgeStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'failed'
  | 'canceled'
  | 'trialing'
  | 'past_due'
  | 'paid'
  | 'open'
  | 'draft'
  | 'void'
  | 'completed'
  | 'expired'
  | 'abandoned'

const STATUS_DOT_COLORS: Record<BadgeStatus, string> = {
  active: 'bg-green-400',
  trialing: 'bg-blue-400',
  paid: 'bg-green-400',
  completed: 'bg-green-400',
  pending: 'bg-yellow-400',
  open: 'bg-yellow-400',
  draft: 'bg-gray-400 dark:bg-spaire-500',
  inactive: 'bg-gray-400 dark:bg-spaire-500',
  past_due: 'bg-red-400',
  failed: 'bg-red-400',
  void: 'bg-gray-400 dark:bg-spaire-500',
  expired: 'bg-gray-400 dark:bg-spaire-500',
  canceled: 'bg-gray-400 dark:bg-spaire-500',
  abandoned: 'bg-gray-400 dark:bg-spaire-500',
}

const DEFAULT_LABELS: Record<BadgeStatus, string> = {
  active: 'Active',
  trialing: 'Trialing',
  paid: 'Paid',
  completed: 'Completed',
  pending: 'Pending',
  open: 'Open',
  draft: 'Draft',
  inactive: 'Inactive',
  past_due: 'Past due',
  failed: 'Failed',
  void: 'Void',
  expired: 'Expired',
  canceled: 'Canceled',
  abandoned: 'Abandoned',
}

interface StatusBadgeProps {
  status: BadgeStatus
  label?: string
  className?: string
}

/**
 * Stripe-style status indicator: a colored dot + text label.
 * No pill background — keeps the table clean and information-dense.
 */
export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-spaire-300',
        className,
      )}
    >
      <span
        className={twMerge(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          STATUS_DOT_COLORS[status] ?? 'bg-gray-400',
        )}
      />
      {label ?? DEFAULT_LABELS[status] ?? status}
    </span>
  )
}
