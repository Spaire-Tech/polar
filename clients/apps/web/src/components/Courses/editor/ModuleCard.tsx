'use client'

import { CourseLessonRead, CourseModuleRead } from '@/hooks/queries/courses'
import ArticleOutlined from '@mui/icons-material/ArticleOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
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
import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { ScheduleEdits, ScheduleMenu } from './ScheduleMenu'
import { ModuleStatus, StatusDropdown } from './StatusDropdown'

export type LessonContentType = 'text' | 'video'

export function ModuleCard({
  module,
  expanded,
  onToggleExpand,
  selectedLessonId,
  onSelectLesson,
  onAddLesson,
  onDeleteLesson,
  onUpdateStatus,
  onUpdateSchedule,
  onReorderLessons,
  onRenameModule,
  onDeleteModule,
}: {
  module: CourseModuleRead
  expanded: boolean
  onToggleExpand: () => void
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onAddLesson: (contentType: LessonContentType) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onUpdateStatus: (next: ModuleStatus) => void
  onUpdateSchedule: (edits: ScheduleEdits) => void
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void
  onRenameModule: (title: string) => void
  onDeleteModule: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(module.title)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id })

  const lessonSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    setDraftTitle(module.title)
  }, [module.title])

  useEffect(() => {
    if (!addMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [addMenuOpen])

  useEffect(() => {
    if (!moreMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!moreMenuRef.current?.contains(e.target as Node)) setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [moreMenuOpen])

  const commitRename = () => {
    const next = draftTitle.trim()
    if (next && next !== module.title) onRenameModule(next)
    else setDraftTitle(module.title)
    setIsEditing(false)
  }

  const handleLessonDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = module.lessons.map((l) => l.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onReorderLessons(module.id, arrayMove(ids, from, to))
  }

  const lessonCount = module.lessons.length
  const publishedCount = module.lessons.filter((l) => l.published).length

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      {/* Module header */}
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Drag to reorder module"
        >
          <DragIndicatorOutlined sx={{ fontSize: 18 }} />
        </button>

        <FolderOutlined className="shrink-0 text-gray-400" sx={{ fontSize: 18 }} />

        {/* Title / inline edit */}
        {isEditing ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraftTitle(module.title)
                setIsEditing(false)
              }
            }}
            className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex flex-1 items-center gap-2 truncate text-left"
            title="Click to rename"
          >
            <span className="truncate text-sm font-semibold text-gray-900">
              {module.title}
            </span>
            <EditOutlined
              className="shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
              sx={{ fontSize: 13 }}
            />
          </button>
        )}

        {/* Lesson count badge */}
        {lessonCount > 0 && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {publishedCount}/{lessonCount}
          </span>
        )}

        {/* Schedule */}
        <ScheduleMenu module={module} onSave={onUpdateSchedule} />

        {/* Status */}
        <StatusDropdown status={module.status} onChange={onUpdateStatus} />

        {/* Add Content dropdown */}
        <div ref={addMenuRef} className="relative shrink-0">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            + Add
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <button
                onClick={() => {
                  onAddLesson('text')
                  setAddMenuOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <ArticleOutlined sx={{ fontSize: 16 }} className="text-gray-400" />
                Text Lesson
              </button>
              <button
                onClick={() => {
                  onAddLesson('video')
                  setAddMenuOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <OndemandVideoOutlined sx={{ fontSize: 16 }} className="text-purple-400" />
                Video Lesson
              </button>
            </div>
          )}
        </div>

        {/* More menu (edit/delete) */}
        <div ref={moreMenuRef} className="relative shrink-0">
          <button
            onClick={() => setMoreMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <MoreVertOutlined sx={{ fontSize: 18 }} />
          </button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <button
                onClick={() => {
                  setIsEditing(true)
                  setMoreMenuOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <EditOutlined sx={{ fontSize: 15 }} />
                Rename
              </button>
              <button
                onClick={() => {
                  onDeleteModule()
                  setMoreMenuOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <DeleteOutlined sx={{ fontSize: 15 }} />
                Delete module
              </button>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? (
            <ExpandLessOutlined sx={{ fontSize: 18 }} />
          ) : (
            <ExpandMoreOutlined sx={{ fontSize: 18 }} />
          )}
        </button>
      </div>

      {/* Lesson list */}
      {expanded && module.lessons.length > 0 && (
        <DndContext
          sensors={lessonSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLessonDragEnd}
        >
          <SortableContext
            items={module.lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {module.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  selected={selectedLessonId === lesson.id}
                  onSelect={() => onSelectLesson(lesson.id)}
                  onDelete={() => onDeleteLesson(lesson)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {expanded && module.lessons.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-6 text-center text-xs text-gray-400">
          No lessons yet.{' '}
          <button
            className="underline hover:text-gray-600"
            onClick={() => onAddLesson('text')}
          >
            Add a text lesson
          </button>{' '}
          or{' '}
          <button
            className="underline hover:text-gray-600"
            onClick={() => onAddLesson('video')}
          >
            video lesson
          </button>
          .
        </div>
      )}
    </div>
  )
}

function LessonRow({
  lesson,
  selected,
  onSelect,
  onDelete,
}: {
  lesson: CourseLessonRead
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const isVideo = lesson.content_type === 'video'
  const Icon = isVideo ? OndemandVideoOutlined : ArticleOutlined
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2.5 transition-colors',
        selected ? 'bg-gray-50' : 'hover:bg-gray-50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-gray-200 hover:text-gray-400 active:cursor-grabbing"
        aria-label="Drag to reorder lesson"
      >
        <DragIndicatorOutlined sx={{ fontSize: 16 }} />
      </button>

      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-2.5 text-left"
      >
        <Icon
          className={cn(
            'shrink-0',
            isVideo ? 'text-purple-400' : 'text-gray-400',
          )}
          sx={{ fontSize: 15 }}
        />
        <span
          className={cn(
            'truncate text-sm',
            selected ? 'font-semibold text-gray-900' : 'text-gray-700',
          )}
        >
          {lesson.title}
        </span>
      </button>

      {/* Published indicator */}
      {lesson.published ? (
        <CheckCircleOutlined className="shrink-0 text-green-500" sx={{ fontSize: 14 }} />
      ) : (
        <DescriptionOutlined className="shrink-0 text-gray-300" sx={{ fontSize: 14 }} />
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        <DeleteOutlined sx={{ fontSize: 13 }} />
      </button>
    </div>
  )
}
