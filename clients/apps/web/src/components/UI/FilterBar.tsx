'use client'

import { twMerge } from 'tailwind-merge'

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

/**
 * Horizontal filter row for resource list pages.
 * Sits between the section tab nav and the resource table.
 * State is managed by the parent via Nuqs (URL query params).
 *
 * Compose with: SearchInput, FilterSelect, DateRangePicker, ExportButton, etc.
 *
 * Usage:
 *   <FilterBar>
 *     <SearchInput ... />
 *     <FilterSelect label="Status" ... />
 *   </FilterBar>
 */
export const FilterBar = ({ children, className }: FilterBarProps) => {
  return (
    <div
      className={twMerge(
        'dark:border-spaire-800 flex flex-wrap items-center gap-2 border-b border-gray-200 px-6 py-3 md:px-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface ActiveFilterChipProps {
  label: string
  value: string
  onRemove: () => void
}

/**
 * A removable chip showing an active filter.
 * Rendered below the FilterBar when filters are applied.
 */
export const ActiveFilterChip = ({
  label,
  value,
  onRemove,
}: ActiveFilterChipProps) => {
  return (
    <span className="dark:bg-spaire-800 dark:border-spaire-700 dark:text-spaire-300 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
      <span className="dark:text-spaire-500 text-gray-400">{label}:</span>
      {value}
      <button
        onClick={onRemove}
        className="dark:text-spaire-500 dark:hover:text-spaire-200 ml-0.5 text-gray-400 hover:text-gray-700"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </span>
  )
}
