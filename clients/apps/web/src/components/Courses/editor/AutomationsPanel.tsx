'use client'

// Automations panel — used by the course editor's Automations tab and the
// per-lesson Automations card. Shows the "New automation" card, a small
// template gallery scoped to course/lesson, and any existing sequences
// linked to this course/lesson. Picking a card opens the email-sequence
// editor inside a fullscreen iframe so the user never leaves the course
// editor context. The iframe runs the regular /email-marketing/sequences
// route with ?embed=1, which hides the email marketing chrome.

import { useEmailSequences } from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'

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
}: {
  row: SequenceRow
  onOpen: () => void
}) {
  const statusColor =
    row.status === 'active'
      ? 'bg-emerald-50 text-emerald-700'
      : row.status === 'paused'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
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
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}
      >
        {row.status}
      </span>
    </button>
  )
}
