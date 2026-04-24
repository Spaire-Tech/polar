'use client'

import { CourseLessonRead, CourseModuleRead, CourseRead } from '@/hooks/queries/courses'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ListOutlined from '@mui/icons-material/ListOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import ThumbDownOutlined from '@mui/icons-material/ThumbDownOutlined'
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined'
import { useMemo, useState } from 'react'
import { ModuleCard } from './ModuleCard'
import { PaywallRow } from './PaywallRow'
import { ModuleStatus } from './StatusDropdown'

export function OutlineTab({
  course,
  showAIBanner,
  onDismissAIBanner,
  selectedLessonId,
  onSelectLesson,
  onAddModule,
  onAddLesson,
  onDeleteLesson,
  onUpdateStatus,
  onRenameModule,
  onDeleteModule,
  onEditPaywall,
}: {
  course: CourseRead
  showAIBanner: boolean
  onDismissAIBanner: () => void
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onAddModule: () => void
  onAddLesson: (module: CourseModuleRead) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onUpdateStatus: (module: CourseModuleRead, next: ModuleStatus) => void
  onRenameModule: (module: CourseModuleRead, title: string) => void
  onDeleteModule: (module: CourseModuleRead) => void
  onEditPaywall?: () => void
}) {
  const [query, setQuery] = useState('')
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(
    () => Object.fromEntries(course.modules.map((m) => [m.id, true])),
  )
  const [allExpanded, setAllExpanded] = useState(true)

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return course.modules
    return course.modules
      .map((m) => {
        const moduleMatch = m.title.toLowerCase().includes(q)
        const matchingLessons = m.lessons.filter((l) =>
          l.title.toLowerCase().includes(q),
        )
        if (moduleMatch) return m
        if (matchingLessons.length > 0)
          return { ...m, lessons: matchingLessons }
        return null
      })
      .filter((m): m is CourseModuleRead => m !== null)
  }, [course.modules, query])

  const toggleAll = () => {
    const next = !allExpanded
    setAllExpanded(next)
    setExpandedModules(
      Object.fromEntries(course.modules.map((m) => [m.id, next])),
    )
  }

  const toggleOne = (id: string) =>
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }))

  const paywallPos = course.paywall_position

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="relative mb-6">
        <SearchOutlined
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          fontSize="small"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find module or lesson..."
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-100"
        />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold text-gray-900">
            {course.modules.length}
          </span>{' '}
          <span className="text-gray-600">
            Module{course.modules.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ListOutlined sx={{ fontSize: 14 }} />
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {showAIBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <AutoAwesomeOutlined
            className="shrink-0 text-indigo-500"
            sx={{ fontSize: 18 }}
          />
          <span className="flex-1 text-sm text-gray-800">
            Your course outline was created successfully! How did we do?
          </span>
          <button className="text-gray-400 hover:text-gray-600">
            <ThumbUpOutlined sx={{ fontSize: 18 }} />
          </button>
          <button className="text-gray-400 hover:text-gray-600">
            <ThumbDownOutlined sx={{ fontSize: 18 }} />
          </button>
          <button
            onClick={onDismissAIBanner}
            className="text-gray-400 hover:text-gray-600"
          >
            <CloseOutlined sx={{ fontSize: 16 }} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filteredModules.map((mod, idx) => {
          const showPaywallAfter =
            paywallPos !== null && paywallPos !== undefined && idx + 1 === paywallPos
          return (
            <div key={mod.id} className="flex flex-col gap-3">
              <ModuleCard
                module={mod}
                expanded={expandedModules[mod.id] ?? false}
                onToggleExpand={() => toggleOne(mod.id)}
                selectedLessonId={selectedLessonId}
                onSelectLesson={onSelectLesson}
                onAddLesson={() => onAddLesson(mod)}
                onDeleteLesson={onDeleteLesson}
                onUpdateStatus={(next) => onUpdateStatus(mod, next)}
                onRenameModule={(title) => onRenameModule(mod, title)}
                onDeleteModule={() => onDeleteModule(mod)}
              />
              {showPaywallAfter && (
                <PaywallRow onEditSettings={onEditPaywall} />
              )}
            </div>
          )
        })}

        {paywallPos !== null &&
          paywallPos !== undefined &&
          paywallPos >= course.modules.length && (
            <PaywallRow onEditSettings={onEditPaywall} />
          )}

        {filteredModules.length === 0 && course.modules.length > 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            No modules or lessons match “{query}”.
          </div>
        )}

        {course.modules.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
            No modules yet. Click “Add Module” to build your curriculum.
          </div>
        )}

        <button
          onClick={onAddModule}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white py-4 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
        >
          <AddOutlined sx={{ fontSize: 18 }} />
          Add Module
        </button>
      </div>
    </div>
  )
}
