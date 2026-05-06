'use client'

import {
  CourseLessonRead,
  CourseModuleRead,
  CourseRead,
} from '@/hooks/queries/courses'
import LockOutlined from '@mui/icons-material/LockOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { useMemo, useState } from 'react'
import { LessonContentType } from './ModuleCard'
import { PaywallRow } from './PaywallRow'

const THUMB_GRADIENTS: [string, string][] = [
  ['#1c1c2e', '#2d1b69'],
  ['#0f2027', '#2c5364'],
  ['#1a1a1a', '#3d3d3d'],
  ['#16213e', '#533483'],
  ['#0d0d0d', '#1a1a2e'],
  ['#1e3a2f', '#2d5a40'],
  ['#2c1810', '#8b3a1a'],
]

function ThumbArt({
  thumbnailUrl,
  position,
}: {
  thumbnailUrl: string | null
  position: number
}) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }
  const [c1, c2] = THUMB_GRADIENTS[(position - 1) % THUMB_GRADIENTS.length]
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id={`g${position}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill={`url(#g${position})`} />
      <line
        x1="0"
        y1="90"
        x2="160"
        y2="0"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="40"
      />
      <circle cx="138" cy="20" r="40" fill="rgba(255,255,255,0.03)" />
    </svg>
  )
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.round(seconds / 60)
  return `${m}m`
}

function LessonCard({
  lesson,
  position,
  locked,
  isSelected,
  onSelect,
  onDelete,
}: {
  lesson: CourseLessonRead
  position: number
  locked: boolean
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div onClick={onSelect} className={cardWrapperClass(isSelected)}>
      <div className="relative aspect-video w-full overflow-hidden">
        <ThumbArt
          thumbnailUrl={lesson.thumbnail_url ?? null}
          position={position}
        />
        <div className="absolute top-[7px] left-2 text-[9px] font-semibold uppercase tracking-[0.07em] text-white/75 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
          Ep {position}
        </div>
        {locked && (
          <div className="absolute top-[7px] right-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <LockOutlined sx={{ fontSize: 10 }} className="text-white" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-transparent transition-colors group-hover:bg-black/15">
          <div className="flex h-8 w-8 scale-75 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-md transition-all group-hover:scale-100 group-hover:opacity-100">
            <PlayArrowRounded sx={{ fontSize: 16 }} className="text-gray-900" />
          </div>
        </div>
      </div>
      <div className="px-[11px] pt-[9px] pb-[11px]">
        <div className="mb-[5px] line-clamp-2 text-[11.5px] font-semibold leading-[1.35] tracking-tight text-gray-900">
          {lesson.title}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[3px] text-[10.5px] text-gray-400">
            <ScheduleOutlined sx={{ fontSize: 10 }} />
            {formatDuration(lesson.duration_seconds)}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="flex items-center rounded-md p-[2px_3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Lesson actions"
          >
            <MoreHorizOutlined sx={{ fontSize: 14 }} />
          </button>
        </div>
      </div>
    </div>
  )
}

function cardWrapperClass(selected: boolean): string {
  return [
    'group relative cursor-pointer overflow-hidden rounded-2xl border bg-white transition-all',
    'shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.03)]',
    'hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]',
    selected ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300',
  ].join(' ')
}

type LessonWithGlobalIndex = {
  lesson: CourseLessonRead
  module: CourseModuleRead
  globalIndex: number
}

type ModuleGroup = {
  module: CourseModuleRead
  items: LessonWithGlobalIndex[]
}

function groupByModule(items: LessonWithGlobalIndex[]): ModuleGroup[] {
  const groups: ModuleGroup[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (!last || last.module.id !== item.module.id) {
      groups.push({ module: item.module, items: [item] })
    } else {
      last.items.push(item)
    }
  }
  return groups
}

export function OutlineTab({
  course,
  selectedLessonId,
  onSelectLesson,
  onDeleteLesson,
  onEditPaywall,
}: {
  course: CourseRead
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onAddLesson: (module: any, contentType: LessonContentType) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void
  onEditPaywall?: () => void
}) {
  const [query, setQuery] = useState('')

  const allLessons = useMemo<LessonWithGlobalIndex[]>(() => {
    const out: LessonWithGlobalIndex[] = []
    let i = 1
    for (const m of course.modules) {
      for (const l of m.lessons) {
        out.push({ lesson: l, module: m, globalIndex: i })
        i += 1
      }
    }
    return out
  }, [course.modules])

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? allLessons.filter((x) => x.lesson.title.toLowerCase().includes(trimmed))
    : allLessons

  const showPaywall =
    !trimmed &&
    course.paywall_position !== null &&
    course.paywall_position !== undefined &&
    course.paywall_position >= 0

  const paywallAt = showPaywall
    ? Math.min(course.paywall_position!, filtered.length)
    : 0
  const freeItems = showPaywall ? filtered.slice(0, paywallAt) : filtered
  const paidItems = showPaywall ? filtered.slice(paywallAt) : []

  const freeGroups = useMemo(() => groupByModule(freeItems), [freeItems])
  const paidGroups = useMemo(() => groupByModule(paidItems), [paidItems])

  return (
    <div className="mx-auto w-full max-w-[880px] px-8 pt-7 pb-20">
      {/* Search */}
      <div className="pb-5">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-[9px] shadow-sm">
          <SearchOutlined sx={{ fontSize: 14 }} className="text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find lesson…"
            className="flex-1 border-0 bg-transparent text-[13px] tracking-tight text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Section: Free preview (or All when searching) */}
      <SectionPill
        text={showPaywall ? 'Free Preview' : 'Lessons'}
        count={freeItems.length}
      />
      <ModuleGroups
        groups={freeGroups}
        locked={false}
        selectedLessonId={selectedLessonId}
        onSelectLesson={onSelectLesson}
        onDeleteLesson={onDeleteLesson}
      />

      {showPaywall && <PaywallRow onEditSettings={onEditPaywall} />}

      {showPaywall && paidItems.length > 0 && (
        <>
          <SectionPill text="Members Only" count={paidItems.length} />
          <ModuleGroups
            groups={paidGroups}
            locked
            selectedLessonId={selectedLessonId}
            onSelectLesson={onSelectLesson}
            onDeleteLesson={onDeleteLesson}
          />
        </>
      )}

      {trimmed && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-[13px] text-gray-500">
          No lessons match "{query}"
        </div>
      )}

      {!trimmed && allLessons.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-[13px] text-gray-500">
          No lessons yet. Use "Add lesson" to start building.
        </div>
      )}
    </div>
  )
}

function ModuleGroups({
  groups,
  locked,
  selectedLessonId,
  onSelectLesson,
  onDeleteLesson,
}: {
  groups: ModuleGroup[]
  locked: boolean
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
}) {
  if (groups.length === 0) return null
  return (
    <div className="mb-6 flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.module.id}>
          <ModuleHeader title={group.module.title} count={group.items.length} />
          <LessonGrid>
            {group.items.map(({ lesson, globalIndex }) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                position={globalIndex}
                locked={locked}
                isSelected={selectedLessonId === lesson.id}
                onSelect={() => onSelectLesson(lesson.id)}
                onDelete={() => onDeleteLesson(lesson)}
              />
            ))}
          </LessonGrid>
        </div>
      ))}
    </div>
  )
}

// "FEATURED"-style pill — borrowed from the Spaire space categories chips.
// White rounded chip with subtle border + shadow and dark uppercase text.
function SectionPill({ text, count }: { text: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2 px-0.5">
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_8px_rgba(0,0,0,0.04)]">
        {text}
      </span>
      <span className="text-[11px] tabular-nums text-gray-400">{count}</span>
    </div>
  )
}

// Module sub-header — uses what was previously the "Free preview" font
// (small uppercase gray label). Keeps the modules visually subordinate to
// the Free Preview / Members Only chips above them.
function ModuleHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-1.5 px-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
        {title}
      </span>
      <span className="text-[11px] text-gray-400">{count}</span>
    </div>
  )
}

function LessonGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      {children}
    </div>
  )
}
