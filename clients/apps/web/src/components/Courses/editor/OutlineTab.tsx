'use client'

import { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { cn } from '@spaire/ui/lib/utils'
import { useMemo, useState } from 'react'
import { LessonContentType } from './ModuleCard'
import { PaywallRow } from './PaywallRow'

function FlatLessonRow({
  lesson,
  position,
  isSelected,
  onSelect,
  onDelete,
}: {
  lesson: CourseLessonRead
  position: number
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: lesson.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border transition-colors',
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300',
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
        >
          <DragIndicatorOutlined sx={{ fontSize: 20 }} />
        </button>

        <button onClick={onSelect} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            {lesson.content_type === 'video' && (
              <OndemandVideoOutlined sx={{ fontSize: 16 }} />
            )}
            <span className="text-sm font-medium text-gray-900">
              Lesson {position}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{lesson.title}</p>
          {(lesson as any).description && (
            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
              {(lesson as any).description}
            </p>
          )}
        </button>

        <button
          onClick={onDelete}
          className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        >
          <DeleteOutlined sx={{ fontSize: 18 }} />
        </button>
      </div>
    </div>
  )
}

export function OutlineTab({
  course,
  selectedLessonId,
  onSelectLesson,
  onAddLesson,
  onDeleteLesson,
  onReorderLessons,
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

  // Flatten all lessons from all modules
  const allLessons = useMemo(() => {
    return course.modules.flatMap((m) =>
      m.lessons.map((l) => ({ lesson: l, moduleId: m.id })),
    )
  }, [course.modules])

  const filteredLessons = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allLessons
    return allLessons.filter((item) =>
      item.lesson.title.toLowerCase().includes(q),
    )
  }, [allLessons, query])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const ids = filteredLessons.map((item) => item.lesson.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const reorderedIds = arrayMove(ids, from, to)
    if (allLessons.length > 0) {
      onReorderLessons(allLessons[0].moduleId, reorderedIds)
    }
  }

  const paywallPos = course.paywall_position
  const firstModule = course.modules[0]

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="relative mb-6">
        <SearchOutlined
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gray-400"
          fontSize="small"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find lesson..."
          className="focus:border-primary w-full rounded-xl border border-gray-200 bg-white py-3 pr-4 pl-11 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold text-gray-900">
            {allLessons.length}
          </span>{' '}
          <span className="text-gray-600">
            Lesson{allLessons.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredLessons.map((item) => item.lesson.id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredLessons.map((item, idx) => {
              const showPaywallAfter =
                paywallPos !== null &&
                paywallPos !== undefined &&
                idx + 1 === paywallPos
              return (
                <div key={item.lesson.id}>
                  <FlatLessonRow
                    lesson={item.lesson}
                    position={idx + 1}
                    isSelected={selectedLessonId === item.lesson.id}
                    onSelect={() => onSelectLesson(item.lesson.id)}
                    onDelete={() => onDeleteLesson(item.lesson)}
                  />
                  {showPaywallAfter && (
                    <PaywallRow onEditSettings={onEditPaywall} />
                  )}
                </div>
              )
            })}
          </SortableContext>
        </DndContext>

        {paywallPos !== null &&
          paywallPos !== undefined &&
          paywallPos >= allLessons.length && (
            <PaywallRow onEditSettings={onEditPaywall} />
          )}

        {filteredLessons.length === 0 && allLessons.length > 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            No lessons match "{query}".
          </div>
        )}

        {allLessons.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
            No lessons yet. Click "Add Lesson" to build your curriculum.
          </div>
        )}

        <button
          onClick={() => {
            if (firstModule) {
              onAddLesson(firstModule, 'text')
            }
          }}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white py-4 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
        >
          <AddOutlined sx={{ fontSize: 18 }} />
          Add Lesson
        </button>
      </div>
    </div>
  )
}
