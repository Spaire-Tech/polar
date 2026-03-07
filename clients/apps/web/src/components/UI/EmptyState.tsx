'use client'

import Button from '@spaire/ui/components/atoms/Button'
import { twMerge } from 'tailwind-merge'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

/**
 * Consistent empty state for resource list pages.
 * Centered, icon + title + optional description + optional CTA.
 */
export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={twMerge(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <div className="dark:text-spaire-600 mb-1 text-gray-300">{icon}</div>
      )}
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </p>
      {description && (
        <p className="dark:text-spaire-400 max-w-xs text-sm text-gray-500">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}
