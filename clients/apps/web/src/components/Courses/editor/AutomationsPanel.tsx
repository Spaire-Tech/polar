'use client'

// Automations panel — used by the course editor's Automations tab and the
// per-lesson Automations card. Shows the "New automation" card, a small
// template gallery scoped to course/lesson, and any existing sequences
// linked to this course/lesson. Picking a card opens the email-sequence
// editor inside a fullscreen iframe so the user never leaves the course
// editor context. The iframe runs the regular /email-marketing/sequences
// route with ?embed=1, which hides the email marketing chrome.

import {
  useDeleteEmailSequence,
  useEmailSequences,
} from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { toast } from '../../Toast/use-toast'

type SequenceRow = {
  id: string
  name: string
  description?: string | null
  trigger_type: string
  status: string
}

export function AutomationsPanel({
  organization,
  courseId,
  lessonId,
  scopeLabel,
}: {
  organization: schemas['Organization']
  courseId?: string
  lessonId?: string
  /** What to call the scope in placeholder copy, e.g. "course" or "lesson". */
  scopeLabel: string
}) {
  const router = useRouter()

  const sequencesQuery = useEmailSequences(organization.id, {
    courseId,
    lessonId,
    limit: 50,
  })

  const sequences: SequenceRow[] = (sequencesQuery.data?.items ?? []) as SequenceRow[]

  // Open the standalone automation builder (the new design). It lives under
  // the course, NOT the email-marketing tabbed area, and returns here when
  // done. The lesson scope rides along as ?lesson_id=.
  const base = courseId
    ? `/dashboard/${organization.slug}/courses/${courseId}/automations`
    : `/dashboard/${organization.slug}/email-marketing/sequences`
  const lessonQs = lessonId ? `?lesson_id=${lessonId}` : ''
  const openNew = () => router.push(`${base}/new${lessonQs}`)
  const openEdit = (sequenceId: string) =>
    router.push(`${base}/${sequenceId}${lessonQs}`)

  const deleteSequence = useDeleteEmailSequence()
  const onDelete = async (row: SequenceRow) => {
    const ok = window.confirm(
      `Delete "${row.name}"? Subscribers currently in this sequence stop receiving its emails. This cannot be undone.`,
    )
    if (!ok) return
    try {
      await deleteSequence.mutateAsync(row.id)
      toast({ title: 'Automation deleted' })
      void sequencesQuery.refetch()
    } catch {
      toast({ title: 'Could not delete automation' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <NewCard onClick={openNew} />

      {sequencesQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
      ) : sequences.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Active for this {scopeLabel}
          </div>
          <div className="flex flex-col gap-2">
            {sequences.map((s) => (
              <SequenceRowItem
                key={s.id}
                row={s}
                onOpen={() => openEdit(s.id)}
                onDelete={() => void onDelete(s)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-transform group-hover:scale-105">
        <AddOutlined sx={{ fontSize: 18 }} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-gray-900">
          New automation
        </span>
        <span className="text-xs text-gray-500">
          Build a sequence from a blank canvas.
        </span>
      </div>
    </button>
  )
}

function SequenceRowItem({
  row,
  onOpen,
  onDelete,
}: {
  row: SequenceRow
  onOpen: () => void
  onDelete: () => void
}) {
  const statusColor =
    row.status === 'active'
      ? 'bg-emerald-50 text-emerald-700'
      : row.status === 'paused'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen()
      }}
      className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-gray-900">
          {row.name}
        </span>
        {row.description ? (
          <span className="truncate text-xs text-gray-500">
            {row.description}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}
        >
          {row.status}
        </span>
        <button
          type="button"
          aria-label="Edit automation"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700"
        >
          <EditOutlined sx={{ fontSize: 15 }} />
        </button>
        <button
          type="button"
          aria-label="Delete automation"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
        >
          <DeleteOutlineOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>
    </div>
  )
}
