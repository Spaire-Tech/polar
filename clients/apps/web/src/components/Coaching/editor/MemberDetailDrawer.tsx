'use client'

// Member detail drawer — opens from a row click on the Members table.
// Surfaces everything the merchant might want to see about one member
// without leaving the page: cohort assignment, progress, intake answers.

import {
  useCoachingIntakeForm,
  useCoachingIntakeResponses,
  type CoachingCohortRead,
  type CoachingMemberRead,
} from '@/hooks/queries/coaching'
import { useEffect, useMemo } from 'react'
import { Ic } from './icons'
import { Avatar, Btn } from './ui'

export function MemberDetailDrawer({
  open,
  member,
  cohorts,
  courseId,
  onClose,
  onAssignCohort,
}: {
  open: boolean
  member: CoachingMemberRead | null
  cohorts: CoachingCohortRead[]
  courseId: string
  onClose: () => void
  onAssignCohort: (cohortId: string) => void
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { data: form } = useCoachingIntakeForm(open ? courseId : undefined)
  const { data: responses = [] } = useCoachingIntakeResponses(
    open ? courseId : undefined,
  )
  const response = useMemo(
    () =>
      responses.find((r) => r.customer_id === member?.customer.id) ?? null,
    [responses, member?.customer.id],
  )

  if (!open || !member) return null

  const completionPct =
    member.total_lessons > 0
      ? Math.round((member.completed_lessons / member.total_lessons) * 100)
      : 0
  const displayName =
    member.customer.name ||
    member.customer.email ||
    member.customer.id.slice(0, 8)

  return (
    <>
      <div className="ce-drawer-backdrop" onClick={onClose} />
      <aside className="ce-drawer">
        <div className="ce-drawer-head">
          <Avatar name={displayName} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 500,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {displayName}
            </div>
            <div
              className="ce-mini"
              style={{
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.customer.email ?? '—'} · joined{' '}
              {new Date(member.enrolled_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
          <Btn variant="ghost" size="icon" onClick={onClose}>
            <Ic.ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
          </Btn>
        </div>

        <div className="ce-drawer-body">
          <section className="ce-drawer-section">
            <div className="ce-label">Cohort</div>
            <select
              className="ce-select"
              value={member.cohort_id ?? ''}
              onChange={(e) => {
                const next = e.target.value
                if (next && next !== member.cohort_id) onAssignCohort(next)
              }}
            >
              {cohorts.length === 0 && <option value="">No cohorts</option>}
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </section>

          <section className="ce-drawer-section">
            <div className="ce-label">Progress</div>
            <div className="ce-row" style={{ gap: 14 }}>
              <div className="ce-progress" style={{ width: 200 }}>
                <span style={{ width: `${completionPct}%` }} />
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {completionPct}%
              </span>
              <span className="ce-mini">
                {member.completed_lessons} / {member.total_lessons} lessons
              </span>
            </div>
          </section>

          <section className="ce-drawer-section">
            <div className="ce-label">Intake response</div>
            {!form ? (
              <p
                className="ce-mini"
                style={{ color: 'var(--ink-3)', margin: 0 }}
              >
                No intake form configured for this program.
              </p>
            ) : !response ? (
              <p
                className="ce-mini"
                style={{ color: 'var(--ink-3)', margin: 0 }}
              >
                Hasn&apos;t submitted yet. Members are nudged with a banner
                in their portal.
              </p>
            ) : (
              <div className="ce-stack-16">
                {form.schema_json.fields.map((field, i) => {
                  const value = (response.answers as Record<string, unknown>)[
                    field.id
                  ]
                  return (
                    <div key={field.id}>
                      <div
                        className="ce-mini"
                        style={{
                          marginBottom: 6,
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          fontWeight: 500,
                        }}
                      >
                        Q{i + 1} · {field.label}
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          color: 'var(--ink)',
                          lineHeight: 1.6,
                        }}
                      >
                        {renderAnswer(value)}
                      </div>
                    </div>
                  )
                })}
                <p
                  className="ce-mini"
                  style={{ marginTop: 8, color: 'var(--ink-4)' }}
                >
                  Submitted {new Date(response.submitted_at).toLocaleString()}
                </p>
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}

function renderAnswer(value: unknown) {
  if (value == null || value === '') {
    return <span style={{ color: 'var(--ink-4)' }}>—</span>
  }
  if (Array.isArray(value)) {
    return (
      <div className="ce-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(value as string[]).map((v) => (
          <span key={v} className="ce-chip">
            {v}
          </span>
        ))}
      </div>
    )
  }
  return <span style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</span>
}
