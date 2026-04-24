'use client'

import { CourseRead } from '@/hooks/queries/courses'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { cn } from '@spaire/ui/lib/utils'

export type TabId =
  | 'outline'
  | 'customize'
  | 'offers'
  | 'customers'
  | 'certificates'
  | 'settings'

const TABS: { id: TabId; label: string }[] = [
  { id: 'outline', label: 'Outline' },
  { id: 'customize', label: 'Customize' },
  { id: 'offers', label: 'Offers' },
  { id: 'customers', label: 'Customers' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'settings', label: 'Settings' },
]

export function CourseHeader({
  course,
  activeTab,
  onTabChange,
  customersCount = 0,
  offersCount = 0,
  onAddContent,
}: {
  course: CourseRead
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  customersCount?: number
  offersCount?: number
  onAddContent?: () => void
}) {
  const counts: Partial<Record<TabId, number>> = {
    offers: offersCount,
    customers: customersCount,
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-start gap-5 px-8 pt-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gray-100">
          <ImageOutlined className="text-gray-300" sx={{ fontSize: 36 }} />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold text-gray-900">
                {course.title ?? 'Untitled Course'}
              </h1>
              <HelpOutlineOutlined
                className="text-gray-300"
                sx={{ fontSize: 18 }}
              />
            </div>
            <div className="flex items-center gap-2">
              <IconBtn>
                <MoreHorizOutlined fontSize="small" />
              </IconBtn>
              <IconBtn>
                <VisibilityOutlined fontSize="small" />
              </IconBtn>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors">
                <AutoAwesomeOutlined fontSize="small" />
              </button>
              <button
                onClick={onAddContent}
                className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
              >
                <AddOutlined sx={{ fontSize: 18 }} />
                Add content
              </button>
            </div>
          </div>

          <div className="-mb-px mt-5 flex items-center gap-6">
            {TABS.map((tab) => {
              const active = tab.id === activeTab
              const count = counts[tab.id]
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'relative pb-3 text-sm transition-colors',
                    active
                      ? 'font-semibold text-gray-900'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {tab.label}
                  {count !== undefined && (
                    <span className="ml-1 text-gray-400">({count})</span>
                  )}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gray-900" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors">
      {children}
    </button>
  )
}
