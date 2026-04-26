'use client'

import { CourseRead } from '@/hooks/queries/courses'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { cn } from '@spaire/ui/lib/utils'

export type TabId = 'outline' | 'customize' | 'pricing' | 'customers'

const TABS: { id: TabId; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'customize', label: 'Customize' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'customers', label: 'Customers' },
]

export function CourseHeader({
  course,
  activeTab,
  onTabChange,
  customersCount = 0,
  onAddContent,
  onBack,
  onClose,
}: {
  course: CourseRead
  organizationSlug: string
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  customersCount?: number
  offersCount?: number
  onAddContent?: () => void
  onBack?: () => void
  onClose?: () => void
}) {
  const counts: Partial<Record<TabId, number>> = {
    customers: customersCount,
  }

  const moduleCount = course.modules.length
  const lessonCount = course.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0,
  )

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Top bar — back + title + close */}
      <div className="flex items-center justify-between px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <ArrowBackOutlined sx={{ fontSize: 16 }} />
          Back
        </button>
        <h1 className="truncate text-sm font-semibold text-gray-900">
          {course.title ?? 'Untitled Course'}
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <CloseOutlined fontSize="small" />
        </button>
      </div>

      {/* Tabs row */}
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-8">
        <div className="-mb-px flex items-center gap-8">
          {TABS.map((tab) => {
            const active = tab.id === activeTab
            const count = counts[tab.id]
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'relative pt-2 pb-3 text-sm transition-colors',
                  active
                    ? 'text-primary font-semibold'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1 text-gray-400">({count})</span>
                )}
                {active && (
                  <span className="bg-primary absolute inset-x-0 bottom-0 h-0.5 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'outline' && (
          <div className="flex items-center gap-3 pb-2">
            <span className="text-xs text-gray-500">
              {moduleCount} module{moduleCount === 1 ? '' : 's'} · {lessonCount}{' '}
              lesson{lessonCount === 1 ? '' : 's'}
            </span>
            <button
              onClick={onAddContent}
              className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
            >
              <AddOutlined sx={{ fontSize: 14 }} />
              Add section
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
