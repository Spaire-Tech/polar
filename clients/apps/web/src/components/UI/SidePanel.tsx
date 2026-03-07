'use client'

import { twMerge } from 'tailwind-merge'

interface SidePanelSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * A labeled section within a SidePanel.
 */
export const SidePanelSection = ({
  title,
  children,
  className,
}: SidePanelSectionProps) => {
  return (
    <div className={twMerge('flex flex-col gap-2 px-5 py-4', className)}>
      {title && (
        <h3 className="dark:text-spaire-400 text-xs font-semibold tracking-wider text-gray-400 uppercase">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

interface SidePanelRowProps {
  label: string
  children: React.ReactNode
}

/**
 * A label + value row inside a SidePanel section.
 */
export const SidePanelRow = ({ label, children }: SidePanelRowProps) => {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="dark:text-spaire-500 shrink-0 text-sm text-gray-500">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm text-gray-900 dark:text-white">
        {children}
      </span>
    </div>
  )
}

interface SidePanelProps {
  children: React.ReactNode
  className?: string
}

/**
 * Sticky right-side context panel for resource detail pages.
 * Used alongside the main scrollable content column.
 *
 * Example usage:
 *   <div className="flex gap-6">
 *     <main className="flex-1">...</main>
 *     <SidePanel>
 *       <SidePanelSection title="Summary">
 *         <SidePanelRow label="Status"><StatusBadge status="active" /></SidePanelRow>
 *         <SidePanelRow label="MRR">$49.00</SidePanelRow>
 *       </SidePanelSection>
 *     </SidePanel>
 *   </div>
 */
export const SidePanel = ({ children, className }: SidePanelProps) => {
  return (
    <aside
      className={twMerge(
        'dark:bg-spaire-900 dark:border-spaire-800 sticky top-0 flex w-80 shrink-0 flex-col divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white dark:divide-spaire-800',
        className,
      )}
    >
      {children}
    </aside>
  )
}
