'use client'

// Coaching program — customer portal view. Mirrors the editor's design
// language (.coaching-editor scope) but consumption-mode: no edit
// affordances, the "next live call" hero is the centre of gravity.

import {
  useCustomerCommunity,
  useCustomerCreatePost,
  useCustomerDeletePost,
  useCustomerIntakeForm,
  useSubmitCustomerIntakeForm,
  type CoachingPostRead,
  type CoachingThreadRead,
} from '@/hooks/queries/coaching'
import type { CustomerCourseDetail, CustomerLessonRead } from '@/hooks/queries/courses'
import {
  icsDownloadUrl,
  useCustomerCoachingEvents,
  type CustomerCoachingEvent,
} from '@/hooks/queries/customerPortalCoaching'
import '@/components/Coaching/editor/coaching-editor.css'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, Btn, Pill, SectionHead } from '@/components/Coaching/editor/ui'
import { Ic } from '@/components/Coaching/editor/icons'

type Props = {
  data: CustomerCourseDetail
  organizationName: string
  onSelectLesson: (lesson: CustomerLessonRead) => void
}

export function ProgramPortalView({
  data,
  organizationName,
  onSelectLesson,
}: Props) {
  const courseId = data.course.id
  const { data: schedule } = useCustomerCoachingEvents(courseId)
  const events = schedule?.events ?? []
  const { data: community } = useCustomerCommunity(courseId)

  const upcoming = useMemo(
    () => events.filter((e) => !e.is_past),
    [events],
  )
  const past = useMemo(() => events.filter((e) => e.is_past), [events])
  const next = upcoming[0] ?? null

  return (
    <div className="coaching-editor">
      <div
        className="ce-shell"
        style={{ paddingTop: 32, paddingBottom: 96 }}
      >
        {/* Eyebrow + program title */}
        <header style={{ paddingTop: 24, paddingBottom: 32 }}>
          <div className="ce-prog-eyebrow">
            {organizationName} · Coaching program
          </div>
          <h1
            className="ce-prog-title"
            style={{ marginTop: 14, marginBottom: 0 }}
          >
            {data.course.title || 'Coaching program'}
          </h1>
        </header>

        {/* Intake nudge if applicable */}
        <IntakeBanner courseId={courseId} />

        {/* Hero: next live call */}
        {next && <NextSessionHero event={next} courseId={courseId} />}

        {/* Schedule */}
        {(upcoming.length > 0 || past.length > 0) && (
          <ScheduleSection
            upcoming={upcoming}
            past={past}
            courseId={courseId}
          />
        )}

        {/* Recorded modules — links into the existing lesson viewer */}
        {data.course.modules.length > 0 && (
          <ModulesSection data={data} onSelectLesson={onSelectLesson} />
        )}

        {/* Community */}
        {data.course.community_enabled && community?.enabled !== false && (
          <CommunitySection
            courseId={courseId}
            threads={community?.threads ?? []}
            ownEnrollmentId={community?.enrollment_id ?? null}
          />
        )}
      </div>
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────

const fmtFull = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

function joinWindowOpen(
  starts_at: string,
  duration_minutes: number,
): boolean {
  const start = new Date(starts_at).getTime()
  const end = start + duration_minutes * 60_000
  const now = Date.now()
  return now >= start - 10 * 60_000 && now <= end
}

function useCountdown(targetIso: string): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000 * 30)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(targetIso).getTime() - now)
  if (ms === 0) return 'now'
  const d = Math.floor(ms / 86_400_000)
  if (d > 0) return `in ${d} day${d === 1 ? '' : 's'}`
  const h = Math.floor(ms / 3_600_000)
  if (h > 0) return `in ${h} hour${h === 1 ? '' : 's'}`
  const m = Math.floor(ms / 60_000)
  return `in ${m} min`
}

function NextSessionHero({
  event,
  courseId,
}: {
  event: CustomerCoachingEvent
  courseId: string
}) {
  const countdown = useCountdown(event.starts_at)
  const canJoin = !!event.meeting_url && joinWindowOpen(event.starts_at, event.duration_minutes)
  return (
    <section
      className="ce-card ce-card-pad"
      style={{
        marginBottom: 24,
        background: 'var(--bg)',
        border: '1px solid var(--line-strong)',
      }}
    >
      <div
        className="ce-row-between"
        style={{ alignItems: 'flex-start', gap: 24 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ce-prog-eyebrow">Next live call · {countdown}</div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              margin: '14px 0 8px',
              color: 'var(--ink)',
            }}
          >
            {event.title}
          </h2>
          <div
            style={{
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            {fmtFull(event.starts_at)} · {event.duration_minutes} min
            {event.meeting_provider ? ` · ${event.meeting_provider}` : ''}
          </div>
          {event.description && (
            <p
              style={{
                marginTop: 16,
                color: 'var(--ink-2)',
                fontSize: 13.5,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {event.description}
            </p>
          )}
        </div>
        <div className="ce-row" style={{ gap: 8 }}>
          <a
            href={icsDownloadUrl(courseId, event.id)}
            className="ce-btn"
            style={{ textDecoration: 'none' }}
          >
            <Ic.Calendar size={14} /> Add to calendar
          </a>
          {event.meeting_url && (
            <a
              href={event.meeting_url}
              target="_blank"
              rel="noreferrer"
              className={
                'ce-btn ' + (canJoin ? 'ce-btn-primary' : '')
              }
              style={{
                textDecoration: 'none',
                pointerEvents: canJoin ? 'auto' : 'none',
                opacity: canJoin ? 1 : 0.5,
              }}
            >
              {canJoin ? 'Join now' : 'Join'}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Schedule ───────────────────────────────────────────────────────────────

function ScheduleSection({
  upcoming,
  past,
  courseId,
}: {
  upcoming: CustomerCoachingEvent[]
  past: CustomerCoachingEvent[]
  courseId: string
}) {
  return (
    <section style={{ marginTop: 16 }}>
      <SectionHead title="Schedule" subtitle="Live group calls and recordings." />
      <div className="ce-card">
        {upcoming.slice(1).map((event) => (
          <ScheduleRow
            key={event.id}
            event={event}
            courseId={courseId}
            section="upcoming"
          />
        ))}
        {upcoming.length <= 1 && (
          <div
            style={{
              padding: '24px 40px',
              color: 'var(--ink-4)',
              fontSize: 13,
            }}
          >
            No further sessions scheduled.
          </div>
        )}
      </div>
      {past.length > 0 && (
        <details className="ce-card" style={{ marginTop: 18 }}>
          <summary
            style={{
              padding: '16px 22px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--ink)',
              listStyle: 'none',
            }}
          >
            <span style={{ marginRight: 8 }}>Past sessions ({past.length})</span>
          </summary>
          {past.map((event) => (
            <ScheduleRow
              key={event.id}
              event={event}
              courseId={courseId}
              section="past"
            />
          ))}
        </details>
      )}
    </section>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ScheduleRow({
  event,
  courseId,
  section,
}: {
  event: CustomerCoachingEvent
  courseId: string
  section: 'upcoming' | 'past'
}) {
  const d = new Date(event.starts_at)
  const cancelled = event.status === 'cancelled'
  const recording = event.recording?.playback_id
    ? `https://stream.mux.com/${event.recording.playback_id}.m3u8`
    : null
  const canJoin =
    !!event.meeting_url && joinWindowOpen(event.starts_at, event.duration_minutes)
  return (
    <div
      className="ce-event-row"
      style={{
        cursor: 'default',
        opacity: cancelled ? 0.55 : 1,
      }}
    >
      <div className="ce-date-block">
        <div className="mon">{MONTHS[d.getMonth()]}</div>
        <div className="day">{d.getDate()}</div>
      </div>
      <div>
        <div
          className="ce-event-title"
          style={
            cancelled
              ? { textDecoration: 'line-through', color: 'var(--ink-3)' }
              : undefined
          }
        >
          {event.title}
        </div>
        <div className="ce-event-meta">
          <span>
            {WEEKDAYS[d.getDay()]} ·{' '}
            {d.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
          <span className="ce-dot" />
          <span>{event.duration_minutes} min</span>
        </div>
      </div>
      <div className="ce-row" style={{ gap: 8 }}>
        {cancelled && <Pill tone="warn">Cancelled</Pill>}
        {!cancelled && section === 'past' && recording && (
          <Pill tone="success">
            <Ic.Video size={11} /> Recording
          </Pill>
        )}
      </div>
      <div className="ce-row" style={{ gap: 8 }}>
        {section === 'upcoming' && !cancelled && (
          <>
            <a
              href={icsDownloadUrl(courseId, event.id)}
              className="ce-btn ce-btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Add to calendar
            </a>
            {event.meeting_url && (
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noreferrer"
                className={
                  'ce-btn ce-btn-sm ' + (canJoin ? 'ce-btn-primary' : '')
                }
                style={{
                  textDecoration: 'none',
                  pointerEvents: canJoin ? 'auto' : 'none',
                  opacity: canJoin ? 1 : 0.5,
                }}
              >
                {canJoin ? 'Join now' : 'Join'}
              </a>
            )}
          </>
        )}
        {section === 'past' && recording && (
          <a
            href={recording}
            target="_blank"
            rel="noreferrer"
            className="ce-btn ce-btn-sm"
            style={{ textDecoration: 'none' }}
          >
            Watch
          </a>
        )}
      </div>
    </div>
  )
}

// ── Modules ────────────────────────────────────────────────────────────────

function ModulesSection({
  data,
  onSelectLesson,
}: {
  data: CustomerCourseDetail
  onSelectLesson: (lesson: CustomerLessonRead) => void
}) {
  return (
    <section style={{ marginTop: 16 }}>
      <SectionHead
        title="Recorded prep"
        subtitle="Watch any time. Lessons unlock as the cohort progresses."
      />
      {data.course.modules.map((m, i) => (
        <div className="ce-module-card" key={m.id}>
          <div className="ce-module-head">
            <div className="ce-module-num">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="ce-module-title">{m.title}</div>
            <Pill>
              {m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}
            </Pill>
          </div>
          {m.lessons.map((l) => (
            <button
              type="button"
              key={l.id}
              onClick={() => onSelectLesson(l as CustomerLessonRead)}
              className="ce-lesson-row"
              style={{
                background: 'transparent',
                border: 0,
                borderTop: '1px solid var(--line)',
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <div className="ce-lesson-icon">
                <Ic.Video size={12} />
              </div>
              <div style={{ flex: 1 }}>{l.title}</div>
              {l.completed && <Pill tone="success">Watched</Pill>}
            </button>
          ))}
        </div>
      ))}
    </section>
  )
}

// ── Community ──────────────────────────────────────────────────────────────

function CommunitySection({
  courseId,
  threads,
  ownEnrollmentId,
}: {
  courseId: string
  threads: CoachingThreadRead[]
  ownEnrollmentId: string | null
}) {
  const create = useCustomerCreatePost(courseId)
  const remove = useCustomerDeletePost(courseId)
  const [posting, setPosting] = useState(false)
  const [draft, setDraft] = useState('')

  const handlePost = async () => {
    const content = draft.trim()
    if (!content) return
    try {
      await create.mutateAsync({ content })
      setDraft('')
      setPosting(false)
    } catch {
      // no-op
    }
  }

  return (
    <section style={{ marginTop: 16 }}>
      <SectionHead
        title="Community"
        subtitle="Discuss with your cohort. One reply deep, on purpose."
      />

      <div
        className="ce-card"
        style={{ marginBottom: 16, padding: '14px 16px' }}
      >
        <div className="ce-row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <Avatar name="You" size={32} />
          <div style={{ flex: 1 }}>
            {posting ? (
              <>
                <textarea
                  className="ce-textarea"
                  rows={3}
                  autoFocus
                  placeholder="Share a question or update with the cohort…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div
                  className="ce-row"
                  style={{
                    marginTop: 8,
                    justifyContent: 'flex-end',
                    gap: 6,
                  }}
                >
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPosting(false)
                      setDraft('')
                    }}
                  >
                    Cancel
                  </Btn>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={handlePost}
                    disabled={!draft.trim() || create.isPending}
                  >
                    {create.isPending ? 'Posting…' : 'Post'}
                  </Btn>
                </div>
              </>
            ) : (
              <button
                onClick={() => setPosting(true)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 11px',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--bg)',
                  color: 'var(--ink-4)',
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                Share a question or update with the cohort…
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ce-card">
        {threads.length === 0 ? (
          <div className="ce-empty" style={{ borderRadius: 0 }}>
            <div className="glyph">
              <Ic.Users size={20} />
            </div>
            <h3>Quiet so far</h3>
            <p>Be the first to break the ice.</p>
          </div>
        ) : (
          threads.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              ownEnrollmentId={ownEnrollmentId}
              onDelete={() => remove.mutate(t.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

const fmtTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function Thread({
  thread,
  ownEnrollmentId,
  onDelete,
}: {
  thread: CoachingThreadRead
  ownEnrollmentId: string | null
  onDelete: () => void
}) {
  return (
    <div className="ce-thread">
      {thread.pinned && (
        <div className="ce-pinned-tag">
          <Ic.Pin size={11} /> Pinned by coach
        </div>
      )}
      <div className="ce-thread-head">
        <Avatar
          name={thread.is_creator ? 'Coach' : thread.author.name || 'M'}
          size={32}
        />
        <div style={{ flex: 1 }}>
          <div>
            <span className="ce-thread-author">
              {thread.is_creator ? 'Coach' : thread.author.name || 'Member'}
            </span>
            {thread.is_creator && <span className="ce-coach-badge">COACH</span>}
            <span
              className="ce-muted ce-tiny"
              style={{ marginLeft: 8 }}
            >
              · {fmtTime(thread.created_at)}
            </span>
          </div>
          <div className="ce-thread-body">{thread.content}</div>
          <div className="ce-thread-actions">
            {ownEnrollmentId &&
              thread.author.enrollment_id === ownEnrollmentId && (
                <button className="ce-thread-action" onClick={onDelete}>
                  Delete
                </button>
              )}
          </div>
        </div>
      </div>
      {thread.replies.map((r: CoachingPostRead) => (
        <div className="ce-reply" key={r.id}>
          <div className="ce-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Avatar
              name={r.is_creator ? 'Coach' : r.author.name || 'M'}
              size={24}
            />
            <div style={{ flex: 1 }}>
              <div>
                <span
                  className="ce-thread-author"
                  style={{ fontSize: 13 }}
                >
                  {r.is_creator ? 'Coach' : r.author.name || 'Member'}
                </span>
                {r.is_creator && <span className="ce-coach-badge">COACH</span>}
                <span
                  className="ce-muted ce-tiny"
                  style={{ marginLeft: 8 }}
                >
                  · {fmtTime(r.created_at)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  marginTop: 4,
                  color: 'var(--ink-2)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {r.content}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Intake banner ──────────────────────────────────────────────────────────

function IntakeBanner({ courseId }: { courseId: string }) {
  const { data } = useCustomerIntakeForm(courseId)
  const submit = useSubmitCustomerIntakeForm(courseId)
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  if (!data?.form || data.response) return null
  const form = data.form

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await submit.mutateAsync(answers)
      setOpen(false)
    } catch {
      // no-op
    }
  }

  return (
    <>
      <div
        className="ce-card"
        style={{
          marginBottom: 24,
          padding: '14px 18px',
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent)',
        }}
      >
        <div className="ce-row-between">
          <div>
            <div style={{ fontWeight: 500, fontSize: 13.5 }}>
              {form.title || 'A quick intake from your coach'}
            </div>
            <div className="ce-mini" style={{ marginTop: 4 }}>
              {form.description ||
                'Help your coach prepare by sharing a bit about you.'}
            </div>
          </div>
          <Btn variant="primary" size="sm" onClick={() => setOpen(true)}>
            Fill it out
          </Btn>
        </div>
      </div>
      {open && (
        <div className="ce-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ce-modal-head">
              <h3>{form.title || 'Intake'}</h3>
              {form.description && <p>{form.description}</p>}
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ce-modal-body">
                <div className="ce-stack-16">
                  {form.schema_json.fields.map((field) => (
                    <div key={field.id}>
                      <label className="ce-label">
                        {field.label}
                        {field.required && (
                          <span style={{ color: 'var(--danger)' }}> *</span>
                        )}
                      </label>
                      {field.type === 'long_text' ? (
                        <textarea
                          className="ce-textarea"
                          rows={4}
                          value={(answers[field.id] as string) ?? ''}
                          placeholder={field.placeholder ?? ''}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [field.id]: e.target.value,
                            })
                          }
                        />
                      ) : field.type === 'select' ? (
                        <select
                          className="ce-select"
                          value={(answers[field.id] as string) ?? ''}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [field.id]: e.target.value,
                            })
                          }
                        >
                          <option value="">Select…</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'multiselect' ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          {(field.options ?? []).map((opt) => {
                            const selected =
                              Array.isArray(answers[field.id]) &&
                              (answers[field.id] as string[]).includes(opt)
                            return (
                              <label
                                key={opt}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 13,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(e) => {
                                    const cur = Array.isArray(answers[field.id])
                                      ? (answers[field.id] as string[])
                                      : []
                                    setAnswers({
                                      ...answers,
                                      [field.id]: e.target.checked
                                        ? [...cur, opt]
                                        : cur.filter((v) => v !== opt),
                                    })
                                  }}
                                />
                                {opt}
                              </label>
                            )
                          })}
                        </div>
                      ) : (
                        <input
                          type={field.type === 'email' ? 'email' : 'text'}
                          className="ce-input"
                          value={(answers[field.id] as string) ?? ''}
                          placeholder={field.placeholder ?? ''}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [field.id]: e.target.value,
                            })
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="ce-modal-foot">
                <Btn
                  variant="ghost"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Btn>
                <Btn variant="primary" type="submit" disabled={submit.isPending}>
                  {submit.isPending ? 'Submitting…' : 'Submit'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
