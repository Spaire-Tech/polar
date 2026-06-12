'use client'

import {
  CourseLessonRead,
  CourseModuleRead,
  CourseRead,
  usePreviewAccess,
} from '@/hooks/queries/courses'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { useMemo, useState } from 'react'
import {
  LessonOptionsMenu,
  LessonOptionsPatch,
} from './LessonOptionsMenu'
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
  objectPosition,
  position,
}: {
  thumbnailUrl: string | null
  objectPosition?: string | null
  position: number
}) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: objectPosition ?? '50% 50%' }}
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

// The outline renders the SAME card the landing shows — Spotlight (text
// over the image) or Catalog (text under the image) per the course's
// lesson_card_variant — with the editor's affordances layered on top:
// drag-to-reorder, Live / lock / drip chips, hover play, options menu
// (publish / schedule / free preview / delete).
function LessonCard({
  lesson,
  position,
  locked,
  isSelected,
  isReorderable,
  variant,
  unitCap,
  onSelect,
  onUpdate,
  onDelete,
}: {
  lesson: CourseLessonRead
  position: number
  locked: boolean
  isSelected: boolean
  isReorderable: boolean
  variant: 'spotlight' | 'catalog'
  unitCap: string
  onSelect: () => void
  onUpdate: (patch: LessonOptionsPatch) => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id, disabled: !isReorderable })
  const [menuOpen, setMenuOpen] = useState(false)

  // Editor chips shared by both variants, overlaid on the artwork.
  const overlays = (
    <>
      {isReorderable && (
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder lesson"
          className="absolute top-2 left-2 z-20 flex h-[22px] w-[22px] cursor-grab items-center justify-center rounded-md bg-black/45 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        >
          <DragIndicatorOutlined sx={{ fontSize: 13 }} className="text-white" />
        </button>
      )}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        {(lesson.drip_days != null || lesson.release_at) && (
          <span className="rounded-full bg-amber-500/90 px-2 py-[3px] text-[9px] font-bold tracking-[0.06em] text-white uppercase backdrop-blur-sm">
            {lesson.drip_days != null ? `Drip ${lesson.drip_days}d` : 'Scheduled'}
          </span>
        )}
        {lesson.published ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100/95 px-2 py-[3px] text-[9px] font-semibold tracking-[0.05em] text-green-700 uppercase">
            <span className="h-1 w-1 rounded-full bg-green-500" />
            Live
          </span>
        ) : (
          <span className="rounded-full bg-black/45 px-2 py-[3px] text-[9px] font-semibold tracking-[0.05em] text-white/85 uppercase backdrop-blur-sm">
            Draft
          </span>
        )}
        {locked && (
          <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <LockOutlined sx={{ fontSize: 11 }} className="text-white" />
          </span>
        )}
      </div>
      {/* hover play — the landing's circular play affordance */}
      <div className="absolute inset-0 z-[5] flex items-center justify-center bg-transparent transition-colors group-hover:bg-black/15">
        <div className="flex h-10 w-10 scale-75 items-center justify-center rounded-full bg-white/95 pl-[2px] opacity-0 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all group-hover:scale-100 group-hover:opacity-100">
          <PlayArrowRounded sx={{ fontSize: 20 }} className="text-gray-900" />
        </div>
      </div>
    </>
  )

  const optionsButton = (overlaid: boolean) => (
    <div
      className={
        overlaid ? 'absolute right-2 bottom-2 z-30' : 'relative'
      }
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
        className={
          overlaid
            ? 'flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/65'
            : 'flex items-center rounded-md p-[2px_3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700'
        }
        aria-label="Lesson options"
      >
        <MoreHorizOutlined sx={{ fontSize: overlaid ? 16 : 14 }} />
      </button>
      {menuOpen && (
        <LessonOptionsMenu
          lesson={lesson}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  )

  if (variant === 'spotlight') {
    // ── Spotlight — the landing's image card, text over the photo. ──
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
        }}
        onClick={onSelect}
        className={[
          'group relative cursor-pointer overflow-visible rounded-[18px] transition-all',
          menuOpen ? 'z-40' : isDragging ? 'z-30' : '',
          'hover:-translate-y-0.5',
          isSelected
            ? 'ring-2 ring-gray-900 ring-offset-2'
            : '',
        ].join(' ')}
      >
        <div
          className="relative w-full overflow-hidden rounded-[18px] shadow-[0_14px_14px_rgba(0,0,0,0.04)]"
          style={{ aspectRatio: '465 / 320' }}
        >
          {lesson.thumbnail_url ? (
            <img
              src={lesson.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: lesson.thumbnail_object_position ?? '50% 50%',
              }}
            />
          ) : (
            // the landing's liquid-glass placeholder
            <div
              className="absolute -inset-[15%]"
              style={{
                background:
                  'radial-gradient(42% 52% at 20% 28%, #6e7a5e 0%, transparent 70%), radial-gradient(46% 56% at 76% 22%, #8a7565 0%, transparent 70%), radial-gradient(52% 62% at 62% 82%, #46464c 0%, transparent 72%), radial-gradient(36% 46% at 28% 78%, #5d6e6a 0%, transparent 70%), #57544e',
                filter: 'blur(40px)',
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)',
            }}
          />
          {overlays}
          {/* landing card-info: text over the image */}
          <div className="absolute right-0 bottom-0 left-0 z-10 px-4 pb-[13px]">
            <div className="text-[10px] font-semibold tracking-[0.07em] text-[rgba(235,235,245,0.66)] uppercase">
              {unitCap} {position}
            </div>
            <div className="mt-1 truncate text-[16px] leading-[1.2] font-semibold tracking-[-0.015em] text-white">
              {lesson.title}
            </div>
            {lesson.description && (
              <div className="mt-[3px] line-clamp-2 text-[13px] leading-[1.45] text-[rgba(235,235,245,0.72)]">
                {lesson.description}
              </div>
            )}
            <div className="mt-[6px] flex items-center gap-1.5 text-[12px] font-medium text-[rgba(235,235,245,0.75)] tabular-nums">
              <ScheduleOutlined sx={{ fontSize: 12 }} />
              {formatDuration(lesson.duration_seconds)}
            </div>
          </div>
          {optionsButton(true)}
        </div>
      </div>
    )
  }

  // ── Catalog — the landing's white card, text under the image. ──
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={onSelect}
      className={cardWrapperClass(isSelected, isDragging, menuOpen)}
    >
      <div
        className="relative w-full overflow-hidden rounded-t-2xl bg-[#111]"
        style={{ aspectRatio: '380 / 214' }}
      >
        <ThumbArt
          thumbnailUrl={lesson.thumbnail_url ?? null}
          objectPosition={lesson.thumbnail_object_position ?? null}
          position={position}
        />
        {overlays}
      </div>
      {/* landing lc-info: text under the image */}
      <div className="flex flex-col px-4 pt-[13px] pb-[14px]">
        <div className="mb-[5px] text-[10px] font-semibold tracking-[0.08em] text-[#86868b] uppercase">
          {unitCap} {position}
        </div>
        <div className="truncate text-[15px] leading-[1.2] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
          {lesson.title}
        </div>
        {lesson.description && (
          <div className="mt-[5px] line-clamp-2 min-h-[36px] text-[12.5px] leading-[1.5] text-[rgba(0,0,0,0.56)]">
            {lesson.description}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#86868b] tabular-nums">
            <ScheduleOutlined sx={{ fontSize: 12 }} />
            {formatDuration(lesson.duration_seconds)}
          </div>
          {optionsButton(false)}
        </div>
      </div>
    </div>
  )
}

function cardWrapperClass(
  selected: boolean,
  dragging: boolean = false,
  menuOpen: boolean = false,
): string {
  // No overflow-hidden on the outer — the lesson options menu pops below the
  // card and would otherwise be clipped. The thumbnail clips itself via
  // rounded-t-2xl on its own container.
  return [
    'group relative cursor-pointer rounded-2xl border bg-white transition-all',
    menuOpen ? 'z-40' : dragging ? 'z-30' : '',
    dragging
      ? 'shadow-[0_18px_50px_rgba(0,0,0,0.18),0_4px_10px_rgba(0,0,0,0.08)]'
      : 'shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.03)]',
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
  organizationSlug,
  selectedLessonId,
  onSelectLesson,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onReorderLessons,
  onEditPaywall,
  onAddModule,
  onRenameModule,
  onDeleteModule,
}: {
  course: CourseRead
  organizationSlug?: string
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onAddLesson: (
    module: CourseModuleRead,
    contentType: LessonContentType,
  ) => void
  onUpdateLesson: (
    lesson: CourseLessonRead,
    patch: LessonOptionsPatch,
  ) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void
  onEditPaywall?: () => void
  onAddModule?: () => void
  onRenameModule?: (module: CourseModuleRead, title: string) => void
  onDeleteModule?: (module: CourseModuleRead) => void
}) {
  const [query, setQuery] = useState('')
  const previewAccess = usePreviewAccess()

  // The outline mirrors the landing: render whichever lesson-card variant
  // the creator chose (Spotlight = text over the image, Catalog = under).
  const cardVariant: 'spotlight' | 'catalog' =
    course.lesson_card_variant === 'spotlight' ? 'spotlight' : 'catalog'
  const unitCap = course.format === 'series' ? 'Episode' : 'Lesson'

  const handlePreview = async () => {
    try {
      const { portal_url } = await previewAccess.mutateAsync(course.id)
      window.open(portal_url, '_blank', 'noopener,noreferrer')
    } catch {
      if (organizationSlug) {
        window.open(
          `/${organizationSlug}/portal/courses/${course.id}`,
          '_blank',
          'noopener,noreferrer',
        )
      }
    }
  }

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

  // A lesson is in the Free Preview section if it sits before the paywall
  // position OR it's explicitly marked as a free preview (regardless of
  // position). The is_free_preview flag bypasses the paywall on the
  // customer side, so the editor needs to reflect the same grouping.
  const paywallAt = showPaywall
    ? Math.min(course.paywall_position!, filtered.length)
    : 0
  const freeItems = showPaywall
    ? filtered.filter(
        (x, i) => i < paywallAt || x.lesson.is_free_preview === true,
      )
    : filtered
  const paidItems = showPaywall
    ? filtered.filter(
        (x, i) => i >= paywallAt && x.lesson.is_free_preview !== true,
      )
    : []

  const freeGroups = useMemo(() => groupByModule(freeItems), [freeItems])
  const paidGroups = useMemo(() => groupByModule(paidItems), [paidItems])

  // Modules with no lessons still need to appear so instructors can rename
  // or delete them — without this, an empty new module is invisible.
  const emptyModules = useMemo(
    () =>
      course.modules.filter((m) => m.lessons.length === 0).map(
        (m): ModuleGroup => ({ module: m, items: [] }),
      ),
    [course.modules],
  )

  const showEmptyCourseState =
    !trimmed && allLessons.length === 0 && course.modules.length === 0

  return (
    <div className="mx-auto w-full max-w-[880px] px-8 pt-7 pb-20">
      {/* Search + Preview */}
      <div className="flex items-center gap-3 pb-5">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-[9px] shadow-sm transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <SearchOutlined sx={{ fontSize: 14 }} className="text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find lesson…"
            className="flex-1 border border-transparent bg-transparent text-[13px] tracking-tight text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
        </div>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewAccess.isPending}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-[9px] text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          title="Open the customer portal landing in a new tab"
        >
          <VisibilityOutlined sx={{ fontSize: 14 }} />
          {previewAccess.isPending ? 'Opening…' : 'Preview'}
        </button>
      </div>

      {showEmptyCourseState ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-gray-900">
            No modules yet
          </p>
          <p className="max-w-[360px] text-[13px] text-gray-500">
            Modules group your lessons. Create one to start building the
            course outline.
          </p>
          {onAddModule && (
            <button
              type="button"
              onClick={onAddModule}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-gray-800"
            >
              <AddOutlined sx={{ fontSize: 14 }} />
              Create first module
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Section: Free preview (or All when searching) */}
          <SectionPill
            text={showPaywall ? 'Free Preview' : 'Lessons'}
            count={freeItems.length}
          />
          <ModuleGroups
            groups={freeGroups}
            locked={false}
            variant={cardVariant}
            unitCap={unitCap}
            isReorderable={!trimmed}
            selectedLessonId={selectedLessonId}
            onSelectLesson={onSelectLesson}
            onAddLesson={onAddLesson}
            onUpdateLesson={onUpdateLesson}
            onDeleteLesson={onDeleteLesson}
            onReorderLessons={onReorderLessons}
            onRenameModule={onRenameModule}
            onDeleteModule={onDeleteModule}
          />

          {showPaywall && <PaywallRow onEditSettings={onEditPaywall} />}

          {showPaywall && paidItems.length > 0 && (
            <>
              <SectionPill text="Members Only" count={paidItems.length} />
              <ModuleGroups
                groups={paidGroups}
                locked
                variant={cardVariant}
                unitCap={unitCap}
                isReorderable={!trimmed}
                selectedLessonId={selectedLessonId}
                onSelectLesson={onSelectLesson}
                onAddLesson={onAddLesson}
                onUpdateLesson={onUpdateLesson}
                onDeleteLesson={onDeleteLesson}
                onReorderLessons={onReorderLessons}
                onRenameModule={onRenameModule}
                onDeleteModule={onDeleteModule}
              />
            </>
          )}

          {/* Modules with no lessons — show only when not searching. */}
          {!trimmed && emptyModules.length > 0 && (
            <ModuleGroups
              groups={emptyModules}
              locked={false}
              variant={cardVariant}
              unitCap={unitCap}
              isReorderable={false}
              selectedLessonId={selectedLessonId}
              onSelectLesson={onSelectLesson}
              onAddLesson={onAddLesson}
              onUpdateLesson={onUpdateLesson}
              onDeleteLesson={onDeleteLesson}
              onRenameModule={onRenameModule}
              onDeleteModule={onDeleteModule}
            />
          )}

          {!trimmed && onAddModule && (
            <button
              type="button"
              onClick={onAddModule}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-4 text-[13px] font-medium text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              Add module
            </button>
          )}

          {trimmed && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-[13px] text-gray-500">
              No lessons match "{query}"
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ModuleGroups({
  groups,
  locked,
  isReorderable,
  variant,
  unitCap,
  selectedLessonId,
  onSelectLesson,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onReorderLessons,
  onRenameModule,
  onDeleteModule,
}: {
  groups: ModuleGroup[]
  locked: boolean
  isReorderable: boolean
  variant: 'spotlight' | 'catalog'
  unitCap: string
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onAddLesson?: (
    module: CourseModuleRead,
    contentType: LessonContentType,
  ) => void
  onUpdateLesson: (
    lesson: CourseLessonRead,
    patch: LessonOptionsPatch,
  ) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onReorderLessons?: (moduleId: string, orderedIds: string[]) => void
  onRenameModule?: (module: CourseModuleRead, title: string) => void
  onDeleteModule?: (module: CourseModuleRead) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )
  if (groups.length === 0) return null

  const canReorder = isReorderable && !!onReorderLessons

  const handleDragEnd = (group: ModuleGroup) => (e: DragEndEvent) => {
    if (!onReorderLessons) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    // The visible items in this group may be a paywall-split subset of the
    // module's full lesson list. Swap inside the visible subset, then merge
    // back into the full module order so lessons outside the visible range
    // keep their positions.
    const visibleIds = group.items.map((x) => x.lesson.id)
    const fullIds = group.module.lessons.map((l) => l.id)
    const from = visibleIds.indexOf(String(active.id))
    const to = visibleIds.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const newVisible = arrayMove(visibleIds, from, to)
    const visibleSet = new Set(visibleIds)
    let i = 0
    const reordered = fullIds.map((id) =>
      visibleSet.has(id) ? newVisible[i++] : id,
    )
    onReorderLessons(group.module.id, reordered)
  }

  return (
    <div className="mb-6 flex flex-col gap-5">
      {groups.map((group) => {
        const lessonGrid = (
          <LessonGrid>
            {group.items.map(({ lesson, globalIndex }) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                position={globalIndex}
                locked={locked}
                isReorderable={canReorder && group.items.length > 1}
                isSelected={selectedLessonId === lesson.id}
                variant={variant}
                unitCap={unitCap}
                onSelect={() => onSelectLesson(lesson.id)}
                onUpdate={(patch) => onUpdateLesson(lesson, patch)}
                onDelete={() => onDeleteLesson(lesson)}
              />
            ))}
          </LessonGrid>
        )

        return (
          <div key={group.module.id}>
            <ModuleHeader
              module={group.module}
              count={group.items.length}
              onAddLesson={
                onAddLesson
                  ? () => onAddLesson(group.module, 'video')
                  : undefined
              }
              onRename={
                onRenameModule
                  ? (title) => onRenameModule(group.module, title)
                  : undefined
              }
              onDelete={
                onDeleteModule ? () => onDeleteModule(group.module) : undefined
              }
            />
            {canReorder && group.items.length > 1 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd(group)}
              >
                <SortableContext
                  items={group.items.map((x) => x.lesson.id)}
                  strategy={rectSortingStrategy}
                >
                  {lessonGrid}
                </SortableContext>
              </DndContext>
            ) : (
              lessonGrid
            )}
          </div>
        )
      })}
    </div>
  )
}

// "FEATURED"-style pill — borrowed from the Spaire space categories chips.
// White rounded chip with subtle border + shadow and dark uppercase text.
function SectionPill({ text, count }: { text: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2 px-0.5">
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[11px] font-bold tracking-[0.18em] text-gray-700 uppercase shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_8px_rgba(0,0,0,0.04)]">
        {text}
      </span>
      <span className="text-[11px] text-gray-400 tabular-nums">{count}</span>
    </div>
  )
}

// Module sub-header — small uppercase label, with inline rename + an
// action menu (add lesson, delete module) on the right. Keeps the
// modules visually subordinate to the Free Preview / Members Only chips
// above them.
function ModuleHeader({
  module: mod,
  count,
  onAddLesson,
  onRename,
  onDelete,
}: {
  module: CourseModuleRead
  count: number
  onAddLesson?: () => void
  onRename?: (title: string) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(mod.title)

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (!next || next === mod.title) {
      setDraft(mod.title)
      return
    }
    onRename?.(next)
  }

  return (
    <div className="mb-2.5 flex items-center gap-2 px-0.5">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onFocus={(e) => {
            // Place caret at the end so the user can keep typing.
            const v = e.currentTarget.value
            e.currentTarget.setSelectionRange(v.length, v.length)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === 'Escape') {
              setEditing(false)
              setDraft(mod.title)
            }
          }}
          // Grow with the title so the user can read the whole name. `ch` is
          // roughly the width of a character at the current font; we add a
          // small buffer plus the input's horizontal padding.
          style={{
            width: `calc(${
              Math.max(draft.length, mod.title.length, 8) + 2
            }ch + 1.25rem)`,
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-gray-700 uppercase focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => onRename && setEditing(true)}
          disabled={!onRename}
          title={onRename ? 'Rename module' : undefined}
          className="group flex items-baseline gap-1.5 text-left disabled:cursor-default"
        >
          <span className="text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase group-hover:text-gray-900">
            {mod.title}
          </span>
          {onRename && (
            <EditOutlined
              sx={{ fontSize: 11 }}
              className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
            />
          )}
        </button>
      )}
      <span className="text-[11px] text-gray-400">{count}</span>
      <div className="ml-auto flex items-center gap-1">
        {onAddLesson && (
          <button
            type="button"
            onClick={onAddLesson}
            title="Add lesson to this module"
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-tight text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <AddOutlined sx={{ fontSize: 12 }} />
            Lesson
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Delete "${mod.title}" and all of its lessons? This can't be undone.`,
                )
              )
                onDelete()
            }}
            title="Delete module"
            className="flex items-center rounded-md px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <DeleteOutlineOutlined sx={{ fontSize: 13 }} />
          </button>
        )}
      </div>
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
