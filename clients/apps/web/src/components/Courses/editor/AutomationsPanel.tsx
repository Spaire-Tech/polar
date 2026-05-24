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
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useState } from 'react'

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
  const [editing, setEditing] = useState<
    { mode: 'new' } | { mode: 'edit'; sequenceId: string } | null
  >(null)

  const sequencesQuery = useEmailSequences(organization.id, {
    courseId,
    lessonId,
    limit: 50,
  })

  const sequences: SequenceRow[] = (sequencesQuery.data?.items ?? []) as SequenceRow[]

  const openNew = () => setEditing({ mode: 'new' })
  const openEdit = (sequenceId: string) =>
    setEditing({ mode: 'edit', sequenceId })

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

      {editing ? (
        <SequenceEditorModal
          organizationSlug={organization.slug}
          mode={editing.mode}
          sequenceId={editing.mode === 'edit' ? editing.sequenceId : undefined}
          courseId={courseId}
          lessonId={lessonId}
          onClose={() => {
            setEditing(null)
            sequencesQuery.refetch()
          }}
        />
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

function SequenceEditorModal({
  organizationSlug,
  mode,
  sequenceId,
  courseId,
  lessonId,
  onClose,
}: {
  organizationSlug: string
  mode: 'new' | 'edit'
  sequenceId?: string
  courseId?: string
  lessonId?: string
  onClose: () => void
}) {
  const src = useMemo(() => {
    const qs = new URLSearchParams({ embed: '1' })
    if (courseId) qs.set('course_id', courseId)
    if (lessonId) qs.set('lesson_id', lessonId)
    const base = `/dashboard/${organizationSlug}/email-marketing/sequences`
    return mode === 'new'
      ? `${base}/new?${qs}`
      : `${base}/${sequenceId}/edit?${qs}`
  }, [organizationSlug, mode, sequenceId, courseId, lessonId])

  // Listen for the inner editor's close postMessage so the modal can dismiss.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'spaire.sequence-editor.close') {
        onClose()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'oklch(0.985 0.001 280)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '14px 20px',
          background: 'oklch(0.985 0.001 280)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close automation editor"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
        >
          <CloseOutlined sx={{ fontSize: 18 }} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '0 20px 20px',
        }}
      >
        <iframe
          title="Automation editor"
          src={src}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'white',
            borderRadius: 12,
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
          }}
        />
      </div>
    </div>
  )
}
