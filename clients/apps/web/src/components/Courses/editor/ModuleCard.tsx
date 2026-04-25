'use client'

import { CourseLessonRead, CourseModuleRead } from '@/hooks/queries/courses'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArticleOutlined from '@mui/icons-material/ArticleOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
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
import { useEffect, useState } from 'react'
import { ScheduleEdits, ScheduleMenu } from './ScheduleMenu'
import { ModuleStatus, StatusDropdown } from './StatusDropdown'

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
  onAddLesson: () => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onUpdateStatus: (next: ModuleStatus) => void
  onUpdateSchedule: (edits: ScheduleEdits) => void
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void
  onRenameModule: (title: string) => void
  onDeleteModule: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(module.title)
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
      <div className="group flex items-center gap-3 px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Drag to reorder module"
        >
          <DragIndicatorOutlined fontSize="small" />
        </button>
        <FolderOutlined className="shrink-0 text-gray-400" fontSize="small" />

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
          <span className="flex-1 truncate text-sm font-semibold text-gray-900">
            {module.title}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <IconBtn title="Edit" onClick={() => setIsEditing(true)}>
            <EditOutlined sx={{ fontSize: 16 }} />
          </IconBtn>
          <IconBtn title="Preview">
            <VisibilityOutlined sx={{ fontSize: 16 }} />
          </IconBtn>
          <IconBtn title="Delete" onClick={onDeleteModule} danger>
            <DeleteOutlined sx={{ fontSize: 16 }} />
          </IconBtn>
        </div>

        <button
          onClick={onAddLesson}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <AddOutlined sx={{ fontSize: 14 }} />
          Add Content
        </button>

        <ScheduleMenu module={module} onSave={onUpdateSchedule} />

        <StatusDropdown
          status={module.status}
          onChange={onUpdateStatus}
        />

        <button
          onClick={onToggleExpand}
          className="ml-1 text-gray-400 hover:text-gray-600"
        >
          {expanded ? (
            <ExpandLessOutlined fontSize="small" />
          ) : (
            <ExpandMoreOutlined fontSize="small" />
          )}
        </button>
      </div>

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
          No lessons yet. Click “Add Content” to create one.
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
  const Icon =
    lesson.content_type === 'video' ? OndemandVideoOutlined : ArticleOutlined
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
        'group flex items-center gap-3 px-4 py-2.5 transition-colors',
        selected ? 'bg-gray-50' : 'hover:bg-gray-50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label="Drag to reorder lesson"
      >
        <DragIndicatorOutlined fontSize="small" />
      </button>
      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <Icon
          className={cn(
            'shrink-0',
            lesson.content_type === 'video' ? 'text-purple-400' : 'text-gray-400',
          )}
          sx={{ fontSize: 16 }}
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
      {lesson.published ? (
        <CheckCircleOutlined
          className="shrink-0 text-green-500"
          sx={{ fontSize: 14 }}
        />
      ) : (
        <DescriptionOutlined
          className="shrink-0 text-gray-300"
          sx={{ fontSize: 14 }}
        />
      )}
      <button
        onClick={onDelete}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        <DeleteOutlined sx={{ fontSize: 14 }} />
      </button>
    </div>
  )
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode
  title?: string
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors',
        danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-gray-100 hover:text-gray-700',
      )}
    >
      {children}
    </button>
  )
}
