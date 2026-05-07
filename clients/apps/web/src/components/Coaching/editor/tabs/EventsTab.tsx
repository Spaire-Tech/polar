'use client'

// Events tab — ported from the design's events.jsx.
//
// Wires to:
//   GET /v1/coaching/events?course_id=...
//   POST /v1/coaching/events
//   PATCH /v1/coaching/events/{id}
//   DELETE /v1/coaching/events/{id}
//   POST /v1/coaching/events/{id}/recording-upload (Mux direct upload)

import {
  useCoachingEvents,
  useCreateCoachingEvent,
  useCreateCoachingRecordingUpload,
  useDeleteCoachingEvent,
  useUpdateCoachingEvent,
  type CoachingEventRead,
  type MeetingProvider,
} from '@/hooks/queries/coaching'
import type { CourseRead } from '@/hooks/queries/courses'
import { useMemo, useState } from 'react'
import { toast } from '../../../Toast/use-toast'
import { Ic } from '../icons'
import { Btn, Menu, Modal, Pill, SectionHead } from '../ui'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDate(iso: string) {
  const d = new Date(iso)
  return {
    mon: MONTHS[d.getMonth()],
    day: d.getDate(),
    weekday: WEEKDAYS[d.getDay()],
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}

type TabEventStatus = 'upcoming' | 'next' | 'past'

function statusOf(event: CoachingEventRead, nextId: string | null): TabEventStatus {
  if (new Date(event.starts_at).getTime() < Date.now()) return 'past'
  if (event.id === nextId) return 'next'
  return 'upcoming'
}

export function EventsTab({ course }: { course: CourseRead }) {
  const courseId = course.id
  const { data: events = [], isLoading } = useCoachingEvents(courseId)
  const createEvent = useCreateCoachingEvent(courseId)
  const updateEvent = useUpdateCoachingEvent(courseId)
  const deleteEvent = useDeleteCoachingEvent(courseId)
  const recordingUpload = useCreateCoachingRecordingUpload()

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    [events],
  )
  const upcoming = useMemo(
    () => sorted.filter((e) => new Date(e.starts_at).getTime() >= Date.now()),
    [sorted],
  )
  const past = useMemo(
    () =>
      [...sorted]
        .filter((e) => new Date(e.starts_at).getTime() < Date.now())
        .reverse(),
    [sorted],
  )

  const nextId = upcoming[0]?.id ?? null
  const needLink = upcoming.filter((e) => !e.meeting_url).length

  const [expanded, setExpanded] = useState<string | null>(nextId)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft())

  const handleSchedule = async () => {
    try {
      await createEvent.mutateAsync({
        course_id: courseId,
        title: draft.title,
        description: null,
        starts_at: combineDateTime(draft.date, draft.time),
        duration_minutes: draft.durationMinutes,
        meeting_url: draft.meetingUrl || null,
        meeting_provider: draft.meetingProvider,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      })
      setScheduleOpen(false)
      setDraft(emptyDraft())
    } catch (e) {
      toast({
        title: 'Could not schedule event',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <>
      <SectionHead
        title="Events"
        subtitle="Your live group calls. The spine of an active cohort."
        actions={
          <>
            <Btn variant="ghost" icon={<Ic.Calendar size={14} />}>
              Sync to calendar
            </Btn>
            <Btn
              variant="primary"
              icon={<Ic.Plus size={14} />}
              onClick={() => setScheduleOpen(true)}
            >
              Schedule event
            </Btn>
          </>
        }
      />

      <div
        style={{
          display: 'flex',
          gap: 24,
          marginBottom: 16,
          color: 'var(--ink-3)',
          fontSize: 12.5,
        }}
      >
        <div className="ce-row" style={{ gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              border: '1px solid var(--line-strong)',
            }}
          />{' '}
          {upcoming.length} upcoming
        </div>
        <div className="ce-row" style={{ gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: 'var(--ink)',
            }}
          />{' '}
          {past.length} completed
        </div>
        {needLink > 0 && (
          <div className="ce-row" style={{ gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: 'var(--warn)',
              }}
            />{' '}
            {needLink} need a meeting link
          </div>
        )}
      </div>

      {isLoading ? (
        <div
          style={{
            height: 96,
            background: 'var(--bg-muted)',
            borderRadius: 16,
          }}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="ce-card">
              <SectionStripe label="Upcoming" count={upcoming.length} />
              {upcoming.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  status={statusOf(event, nextId)}
                  expanded={expanded === event.id}
                  onToggle={() =>
                    setExpanded(expanded === event.id ? null : event.id)
                  }
                  onUpdate={(patch) =>
                    updateEvent.mutate({ eventId: event.id, body: patch })
                  }
                  onDelete={() => deleteEvent.mutate(event.id)}
                  onUploadRecording={(file) =>
                    handleUploadRecording(event.id, file, recordingUpload)
                  }
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="ce-card" style={{ marginTop: 18 }}>
              <SectionStripe label="Completed" count={past.length} />
              {past.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  status="past"
                  expanded={expanded === event.id}
                  onToggle={() =>
                    setExpanded(expanded === event.id ? null : event.id)
                  }
                  onUpdate={(patch) =>
                    updateEvent.mutate({ eventId: event.id, body: patch })
                  }
                  onDelete={() => deleteEvent.mutate(event.id)}
                  onUploadRecording={(file) =>
                    handleUploadRecording(event.id, file, recordingUpload)
                  }
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                />
              ))}
            </div>
          )}

          {events.length === 0 && (
            <div className="ce-empty">
              <div className="glyph">
                <Ic.Calendar size={20} />
              </div>
              <h3>No events scheduled yet</h3>
              <p>Schedule your first live call to get the cohort moving.</p>
              <Btn
                variant="primary"
                icon={<Ic.Plus size={14} />}
                onClick={() => setScheduleOpen(true)}
              >
                Schedule event
              </Btn>
            </div>
          )}
        </>
      )}

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule a new event"
        subtitle="Members get a calendar invite + a reminder before the call."
        footer={
          <>
            <Btn variant="ghost" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleSchedule}
              disabled={
                !draft.title.trim() || !draft.date || !draft.time || createEvent.isPending
              }
            >
              {createEvent.isPending ? 'Scheduling…' : 'Schedule'}
            </Btn>
          </>
        }
      >
        <div className="ce-stack-16">
          <div>
            <label className="ce-label">Title</label>
            <input
              className="ce-input"
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Week 3 — Pricing your offer"
            />
          </div>
          <div className="ce-grid-2">
            <div>
              <label className="ce-label">Date</label>
              <input
                className="ce-input"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <div>
              <label className="ce-label">Time</label>
              <input
                className="ce-input"
                type="time"
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              />
            </div>
          </div>
          <div className="ce-grid-2">
            <div>
              <label className="ce-label">Duration</label>
              <select
                className="ce-select"
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMinutes: parseInt(e.target.value, 10) || 60,
                  })
                }
              >
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={75}>75 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
            <div>
              <label className="ce-label">Provider</label>
              <select
                className="ce-select"
                value={draft.meetingProvider}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    meetingProvider: e.target.value as MeetingProvider,
                  })
                }
              >
                <option value="zoom">Zoom</option>
                <option value="google_meet">Google Meet</option>
                <option value="whereby">Whereby</option>
                <option value="riverside">Riverside</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="ce-label">Meeting link</label>
            <input
              className="ce-input"
              value={draft.meetingUrl}
              onChange={(e) =>
                setDraft({ ...draft, meetingUrl: e.target.value })
              }
              placeholder="Paste Zoom / Google Meet URL (optional — add later)"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function SectionStripe({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        padding: '12px 22px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-muted)',
      }}
    >
      <div className="ce-row" style={{ gap: 10 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
        <Pill>{count}</Pill>
      </div>
    </div>
  )
}

function EventRow({
  event,
  status,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onUploadRecording,
  openMenu,
  setOpenMenu,
}: {
  event: CoachingEventRead
  status: TabEventStatus
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: { meeting_url?: string | null; title?: string }) => void
  onDelete: () => void
  onUploadRecording: (file: File) => void
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
}) {
  const dt = fmtDate(event.starts_at)
  const isPast = status === 'past'
  const needsLink = !event.meeting_url
  const hasRecording = !!event.recording_mux_playback_id

  const [linkDraft, setLinkDraft] = useState(event.meeting_url ?? '')

  return (
    <>
      <div
        className={'ce-event-row' + (expanded ? ' expanded' : '')}
        onClick={onToggle}
      >
        <div className="ce-date-block">
          <div className="mon">{dt.mon}</div>
          <div className="day">{dt.day}</div>
        </div>
        <div>
          <div className="ce-event-title">{event.title}</div>
          <div className="ce-event-meta">
            <span>
              {dt.weekday} · {dt.time}
            </span>
            <span className="ce-dot" />
            <span>{event.duration_minutes} min</span>
            {event.meeting_provider && (
              <>
                <span className="ce-dot" />
                <span>{event.meeting_provider}</span>
              </>
            )}
          </div>
        </div>
        <div className="ce-row" style={{ gap: 8 }}>
          {!isPast && needsLink && (
            <Pill tone="warn">
              <span
                className="ce-dot-warn"
                style={{ marginRight: 0 }}
              />
              Add link
            </Pill>
          )}
          {hasRecording && (
            <Pill tone="success">
              <Ic.Video size={11} /> Recording
            </Pill>
          )}
          {!hasRecording && isPast && (
            <Pill tone="warn">Recording missing</Pill>
          )}
          {status === 'next' && !needsLink && (
            <Pill>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: '#0a84ff',
                  marginRight: 4,
                  display: 'inline-block',
                }}
              />
              Next up
            </Pill>
          )}
        </div>
        <div
          style={{ position: 'relative' }}
          onClick={(e) => e.stopPropagation()}
        >
          <Btn
            variant="ghost"
            size="icon"
            onClick={() =>
              setOpenMenu(openMenu === event.id ? null : event.id)
            }
          >
            <Ic.More size={16} />
          </Btn>
          <Menu
            open={openMenu === event.id}
            onClose={() => setOpenMenu(null)}
          >
            <button onClick={onToggle}>
              <Ic.Edit size={13} /> Edit details
            </button>
            <div className="menu-divider" />
            <button className="danger" onClick={onDelete}>
              <Ic.Trash size={13} /> Cancel session
            </button>
          </Menu>
        </div>
      </div>
      {expanded && (
        <div
          className="ce-event-detail"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ce-event-detail-block">
            <div className="ce-label">Description</div>
            <p
              style={{
                margin: 0,
                color: event.description ? 'var(--ink-2)' : 'var(--ink-3)',
                fontSize: 13.5,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {event.description ||
                'No description yet. Add talking points so the cohort knows what they’re showing up for.'}
            </p>
          </div>
          <div className="ce-event-detail-block">
            <div className="ce-stack-16">
              <div>
                <div className="ce-label">Meeting link</div>
                {event.meeting_url ? (
                  <div className="ce-row" style={{ gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        padding: '8px 11px',
                        border: '1px solid var(--line-strong)',
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--bg-muted)',
                        fontSize: 12.5,
                        color: 'var(--ink-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Ic.Link
                        size={12}
                        style={{
                          verticalAlign: -2,
                          marginRight: 6,
                          color: 'var(--ink-3)',
                        }}
                      />
                      {event.meeting_url}
                    </div>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onUpdate({ meeting_url: null })
                      }
                    >
                      <Ic.Edit size={12} />
                    </Btn>
                  </div>
                ) : (
                  <div
                    className="ce-row"
                    style={{ gap: 8 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="ce-input"
                      placeholder="Paste your Zoom / Google Meet / Riverside URL"
                      value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                    />
                    <Btn
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        linkDraft.trim() &&
                        onUpdate({ meeting_url: linkDraft.trim() })
                      }
                    >
                      Save
                    </Btn>
                  </div>
                )}
                <div className="ce-help">
                  Members see this 15 min before the call starts.
                </div>
              </div>
              <div>
                <div className="ce-label">Recording</div>
                {hasRecording ? (
                  <div
                    className="ce-row"
                    style={{
                      gap: 10,
                      padding: '10px 12px',
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: 'var(--ink)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'white',
                      }}
                    >
                      <Ic.Video size={15} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        Hosted on Mux
                      </div>
                      <div className="ce-mini">
                        Released{' '}
                        {event.recording_released_at
                          ? new Date(
                              event.recording_released_at,
                            ).toLocaleDateString()
                          : 'after processing'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <RecordingUploadButton
                    onFile={(f) => onUploadRecording(f)}
                    isPast={isPast}
                  />
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle()
                  }}
                >
                  Collapse
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RecordingUploadButton({
  onFile,
  isPast,
}: {
  onFile: (f: File) => void
  isPast: boolean
}) {
  return (
    <label
      className="ce-btn"
      style={{
        width: '100%',
        padding: 14,
        justifyContent: 'center',
        borderStyle: 'dashed',
        color: 'var(--ink-3)',
        cursor: 'pointer',
      }}
    >
      <Ic.Upload size={14} />
      {isPast ? 'Upload recording' : 'Upload (after the call)'}
      <input
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.currentTarget.value = ''
        }}
      />
    </label>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

type EventDraft = {
  title: string
  date: string
  time: string
  durationMinutes: number
  meetingUrl: string
  meetingProvider: MeetingProvider
}

function emptyDraft(): EventDraft {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setMinutes(0, 0, 0)
  d.setHours(18)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    title: '',
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: '18:00',
    durationMinutes: 60,
    meetingUrl: '',
    meetingProvider: 'zoom',
  }
}

function combineDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10))
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10) || 0)
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh, mm, 0, 0).toISOString()
}

async function handleUploadRecording(
  eventId: string,
  file: File,
  mutation: ReturnType<typeof useCreateCoachingRecordingUpload>,
) {
  try {
    const { upload_url } = await mutation.mutateAsync(eventId)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status})`))
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.open('PUT', upload_url)
      xhr.send(file)
    })
    toast({
      title: 'Recording uploaded',
      description:
        'It will appear in members’ portals once Mux finishes processing.',
    })
  } catch (e) {
    toast({
      title: 'Upload failed',
      description: e instanceof Error ? e.message : 'Unknown error',
    })
  }
}
