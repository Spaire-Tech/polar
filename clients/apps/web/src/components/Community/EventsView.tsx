'use client'

import { useEffect, useRef, useState } from 'react'
import { useAnnounceCommunityEvent } from '../../hooks/queries/community'
import { Avatar } from './Avatar'
import { EventAttendeesModal } from './EventAttendeesModal'
import { EventDetailModal } from './EventDetailModal'
import { PageHero } from './PageHero'
import styles from './community.module.css'
import {
  IconCalendar,
  IconChat,
  IconClock,
  IconImage,
  IconMapPin,
  IconPlayCircle,
  IconPlus,
  IconSmile,
  IconUsers,
  IconVideo,
  IconX,
} from './icons'

// Phase 3D: events surface is now backed by /v1/.../events.  Local
// state in this file is UI-only (modal open, filter chip).  Hosts
// (course-owner instructors) see "Create event"; students don't.

export type EventType = 'workshop' | 'office' | 'cohort' | 'guest'

export type CommunityEvent = {
  id: string
  title: string
  type: EventType
  desc: string
  // Canonical ISO timestamp in UTC. The card renders both the host's
  // timezone (event.timezone) and the viewer's local zone from this
  // single instant.
  startAt: string
  timezone: string
  duration: string // minutes
  location: string
  meetingUrl?: string | null
  replayUrl?: string | null
  coverUrl?: string | null
  coverObjectPosition?: string | null
  hostName: string
  rsvpCount: number
  going: boolean
  live: boolean
  past?: boolean
}

// Payload emitted from the create modal. Includes the notify toggle and
// the host's chosen timezone — the modal lets them schedule "8pm PT"
// rather than "8pm browser-local."
export type CommunityEventCreateInput = {
  title: string
  type: EventType
  desc: string
  date: string
  startTime: string
  timezone: string
  duration: string
  location: string
  meetingUrl: string
  coverUrl: string
  coverObjectPosition: string
  notify: boolean
}

const TYPE_LABEL: Record<EventType, string> = {
  workshop: 'Workshop',
  office: 'Office hours',
  cohort: 'Cohort meetup',
  guest: 'Guest session',
}

const MONTH_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

const tzAbbrev = (tz: string, at: Date): string => {
  // Best-effort short label for a tz. Intl gives us "PDT", "EST", "GMT+1"
  // etc. when shortGeneric / short is requested.
  try {
    const parts = new Intl.DateTimeFormat([], {
      timeZone: tz,
      timeZoneName: 'short',
      hour: 'numeric',
    }).formatToParts(at)
    const part = parts.find((p) => p.type === 'timeZoneName')
    return part?.value ?? tz
  } catch {
    return tz
  }
}

const formatDateChip = (
  startAt: string,
  tz: string,
): { month: string; day: number } => {
  const d = new Date(startAt)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
  }).formatToParts(d)
  const monthStr = parts.find((p) => p.type === 'month')?.value ?? ''
  const dayStr = parts.find((p) => p.type === 'day')?.value ?? '1'
  const idx = [
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
  ].indexOf(monthStr)
  return {
    month: MONTH_ABBR[idx >= 0 ? idx : 0],
    day: parseInt(dayStr, 10) || 1,
  }
}

const VIEWER_TZ =
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC'

// Curated short list — covers the common cohort timezones without
// dumping all ~600 IANA names into the select. If the host's tz is
// already set and missing from this list, the modal prepends it.
const COMMON_TIMEZONES = [
  VIEWER_TZ,
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
].filter((v, i, a) => a.indexOf(v) === i)

const previewWhen = (date: string, startTime: string, tz: string): string => {
  // Interpret `date + startTime` as a wall clock in `tz` and show the
  // host what "8pm PT" actually maps to in their viewer-local time —
  // a sanity check before they hit publish.
  try {
    // Build the candidate instant in the target tz by formatting the
    // viewer-local interpretation, then back-calculating the offset.
    // For a preview this is fine to do approximately.
    const local = new Date(`${date}T${startTime}:00`)
    // Use Intl to get the host-tz wall clock for that instant; compare
    // to the literal date/time to compute drift.
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    })
    return `~ ${fmt.format(local)} ${tzAbbrev(tz, local)}`
  } catch {
    return ''
  }
}

const fmtInTz = (
  d: Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions,
): string => new Intl.DateTimeFormat([], { ...opts, timeZone: tz }).format(d)

// "Thu, Jun 12 · 8:00 PM PDT" in the host's tz.
const formatHostWhen = (startAt: string, tz: string): string => {
  const d = new Date(startAt)
  const date = fmtInTz(d, tz, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const time = fmtInTz(d, tz, { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time} ${tzAbbrev(tz, d)}`
}

// "Your time: 11:00 PM EDT" when viewer's tz differs from host's.
const formatViewerWhen = (startAt: string, hostTz: string): string | null => {
  if (!hostTz || hostTz === VIEWER_TZ) return null
  const d = new Date(startAt)
  const time = fmtInTz(d, VIEWER_TZ, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Your time: ${time} ${tzAbbrev(VIEWER_TZ, d)}`
}

type Props = {
  courseId: string | undefined
  // Used to build the canonical share URL inside EventDetailModal.
  // Optional so embed/preview surfaces can still mount EventsView
  // without an org context — Share falls back to the page hash URL.
  organizationSlug?: string
  hostName: string
  events: CommunityEvent[]
  onCreate: (event: CommunityEventCreateInput) => void
  onUpdate: (eventId: string, patch: CommunityEventCreateInput) => void
  onDelete: (eventId: string) => void
  onToggleGoing: (id: string) => void
  canCreate: boolean
}

export function EventsView({
  courseId,
  organizationSlug,
  hostName,
  events,
  onCreate,
  onUpdate,
  onDelete,
  onToggleGoing,
  canCreate,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<CommunityEvent | null>(null)
  const [openEvent, setOpenEvent] = useState<CommunityEvent | null>(null)
  // Host-only roster modal. Tracked at the EventsView level (not on
  // each card) so the modal lives outside the card grid and can't be
  // unmounted by re-renders of the underlying list.
  const [attendeesFor, setAttendeesFor] = useState<CommunityEvent | null>(null)
  // Toast strip — reused for the "Announcement sent" confirmation so we
  // don't introduce a second notification surface.
  const [hostToast, setHostToast] = useState<string | null>(null)
  const announceMut = useAnnounceCommunityEvent(courseId)
  const onAnnounce = (event: CommunityEvent) => {
    // Confirm before fanning out — re-announcing isn't destructive but
    // it does email every enrolled member, which is irreversible. The
    // confirm copy spells out exactly what happens.
    const ok = window.confirm(
      `Send a fresh "new event" notification to everyone enrolled in this course? They'll get a bell + email for "${event.title}".`,
    )
    if (!ok) return
    announceMut.mutate(event.id, {
      onSuccess: () => setHostToast('Announcement queued'),
      onError: () => setHostToast('Could not send announcement'),
    })
  }
  useEffect(() => {
    if (!hostToast) return
    const t = setTimeout(() => setHostToast(null), 2400)
    return () => clearTimeout(t)
  }, [hostToast])
  // v5 redesign trims the v4 per-type chip row down to two segments:
  // All events vs Mine (going/hosting). Per-type grouping moves into
  // the act-module section headers further down.
  const [filter, setFilter] = useState<'all' | 'mine'>('all')

  const matches = (e: CommunityEvent) => {
    if (filter === 'mine') return e.going
    return true
  }

  const live = events.find((e) => e.live && matches(e)) ?? null
  const upcoming = events.filter((e) => !e.live && !e.past && matches(e))
  const past = events.filter((e) => e.past && filter !== 'mine' && matches(e))

  const totalCount = events.filter((e) => !e.past).length
  const mineCount = events.filter((e) => e.going && !e.past).length

  // v5 redesign: only two segmented filters (All / Mine). The per-type
  // filters from the v4 chip row are folded into the type-group section
  // headers further down so navigation lives with the content.
  const segments: { id: 'all' | 'mine'; label: string; count: number }[] = [
    { id: 'all', label: 'All events', count: totalCount },
    {
      id: 'mine',
      label: canCreate ? 'Hosting' : 'My events',
      count: mineCount,
    },
  ]

  // Group upcoming events by type so each gets its own act-module
  // section with eyebrow + name + count meta.
  const TYPE_GROUPS: {
    id: EventType
    name: string
    desc: string
  }[] = [
    {
      id: 'workshop',
      name: 'Workshops',
      desc: 'Live bake-alongs and deep-dives',
    },
    {
      id: 'office',
      name: 'Office hours',
      desc: `Open Q&A with ${hostName || 'the instructor'}`,
    },
    {
      id: 'cohort',
      name: 'Cohort meetups',
      desc: 'Show & tell with your peers',
    },
    {
      id: 'guest',
      name: 'Guest sessions',
      desc: 'Outside bakers and authors',
    },
  ]
  const groups = TYPE_GROUPS.map((g) => ({
    ...g,
    items: upcoming.filter((e) => e.type === g.id),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <PageHero
        eyebrow={
          totalCount === 0
            ? 'No upcoming events yet'
            : `${totalCount} upcoming${live ? ' · 1 live now' : ''}`
        }
        live={!!live}
        title="Events"
        subtitle="Live workshops, office hours, cohort meetups, and guest sessions. Replays show up here for anything you miss."
      />

      <div className={styles.actToolbar}>
        <div className={styles.actSegmented}>
          {segments.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.actSegmentedBtn} ${
                filter === s.id ? styles.actSegmentedBtnActive : ''
              }`}
              onClick={() => setFilter(s.id)}
            >
              {s.label} <span className={styles.actSegmentedCt}>{s.count}</span>
            </button>
          ))}
        </div>
        <span className={styles.eventsToolbarSpacer} />
        {canCreate && (
          <button
            type="button"
            className={styles.actCreate}
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={13} /> Create event
          </button>
        )}
      </div>

      {live && (
        <section className={styles.eventsSection}>
          <header className={styles.actModuleHeader}>
            <div>
              <div className={styles.actModuleEyebrow}>
                <span
                  className={`${styles.actModuleNum} ${styles.actModuleNumLive}`}
                  aria-hidden
                >
                  <span className={styles.actModuleLivePulse} />
                </span>
                Live now
              </div>
              <div className={styles.actModuleName}>Happening right now</div>
            </div>
            <div className={styles.actModuleMeta}>
              <span>
                <strong>{live.rsvpCount}</strong> watching
              </span>
            </div>
          </header>
          <FeaturedLive event={live} />
        </section>
      )}

      {upcoming.length === 0 && !live ? (
        <EmptyEvents
          onCreate={() => setCreateOpen(true)}
          mine={filter === 'mine'}
          onResetFilter={() => setFilter('all')}
          activeFilter={filter}
          canCreate={canCreate}
        />
      ) : filter === 'mine' ? (
        // Mine view: single section, "Going / Hosting" eyebrow.
        upcoming.length > 0 && (
          <section className={styles.eventsSection}>
            <header className={styles.actModuleHeader}>
              <div>
                <div className={styles.actModuleEyebrow}>
                  {canCreate ? 'Hosting' : "RSVP'd"}
                </div>
                <div className={styles.actModuleName}>
                  {canCreate
                    ? 'Events you’re hosting'
                    : 'Events you’re going to'}
                </div>
              </div>
              <div className={styles.actModuleMeta}>
                <span>
                  <strong>{upcoming.length}</strong>{' '}
                  {upcoming.length === 1 ? 'event' : 'events'}
                </span>
              </div>
            </header>
            <div className={styles.eventsGridV5}>
              {upcoming.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onToggleGoing={onToggleGoing}
                  onOpen={() => setOpenEvent(e)}
                  canRsvp={!canCreate}
                  canManage={canCreate}
                  onEdit={() => setEditing(e)}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Delete "${e.title}"? Attendees will no longer see it and any RSVPs will be removed.`,
                      )
                    ) {
                      onDelete(e.id)
                    }
                  }}
                  onViewAttendees={
                    canCreate ? () => setAttendeesFor(e) : undefined
                  }
                  onAnnounce={canCreate ? () => onAnnounce(e) : undefined}
                />
              ))}
            </div>
          </section>
        )
      ) : (
        groups.map((g) => (
          <section key={g.id} className={styles.eventsSection}>
            <header className={styles.actModuleHeader}>
              <div>
                <div className={styles.actModuleEyebrow}>{g.name}</div>
                <div className={styles.actModuleName}>{g.desc}</div>
              </div>
              <div className={styles.actModuleMeta}>
                <span>
                  <strong>{g.items.length}</strong> upcoming
                </span>
              </div>
            </header>
            <div className={styles.eventsGridV5}>
              {g.items.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onToggleGoing={onToggleGoing}
                  onOpen={() => setOpenEvent(e)}
                  canRsvp={!canCreate}
                  canManage={canCreate}
                  onEdit={() => setEditing(e)}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Delete "${e.title}"? Attendees will no longer see it and any RSVPs will be removed.`,
                      )
                    ) {
                      onDelete(e.id)
                    }
                  }}
                  onViewAttendees={
                    canCreate ? () => setAttendeesFor(e) : undefined
                  }
                  onAnnounce={canCreate ? () => onAnnounce(e) : undefined}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {past.length > 0 && (
        <section className={styles.eventsSection}>
          <header className={styles.actModuleHeader}>
            <div>
              <div className={styles.actModuleEyebrow}>Past</div>
              <div className={styles.actModuleName}>Replays available</div>
            </div>
            <div className={styles.actModuleMeta}>
              <span>
                <strong>{past.length}</strong>{' '}
                {past.length === 1 ? 'replay' : 'replays'}
              </span>
            </div>
          </header>
          <div className={styles.eventsGridV5}>
            {past.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                onToggleGoing={onToggleGoing}
                onOpen={() => setOpenEvent(e)}
                past
                canRsvp={!canCreate}
                canManage={canCreate}
                onEdit={() => setEditing(e)}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Delete "${e.title}"? This past event and its replay will be removed.`,
                    )
                  ) {
                    onDelete(e.id)
                  }
                }}
                onViewAttendees={
                  canCreate ? () => setAttendeesFor(e) : undefined
                }
                // Past events: no "Re-announce" — emailing members
                // "New event: X" about something already-happened
                // reads as a mistake from the host. They can use
                // the discussions surface instead.
              />
            ))}
          </div>
        </section>
      )}

      {canCreate && (
        <CreateEventModal
          open={createOpen}
          courseId={courseId}
          hostName={hostName}
          editing={null}
          onClose={() => setCreateOpen(false)}
          onSubmit={(payload) => {
            onCreate(payload)
            setCreateOpen(false)
          }}
        />
      )}

      {canCreate && editing && (
        <CreateEventModal
          open={!!editing}
          courseId={courseId}
          hostName={hostName}
          editing={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            onUpdate(editing.id, payload)
            setEditing(null)
          }}
          onAnnounce={() => onAnnounce(editing)}
        />
      )}

      <EventDetailModal
        event={openEvent}
        organizationSlug={organizationSlug}
        onClose={() => setOpenEvent(null)}
        onToggleGoing={() => {
          if (openEvent) onToggleGoing(openEvent.id)
        }}
      />

      {canCreate && courseId && (
        <EventAttendeesModal
          open={!!attendeesFor}
          courseId={courseId}
          eventId={attendeesFor?.id ?? null}
          eventTitle={attendeesFor?.title ?? null}
          onClose={() => setAttendeesFor(null)}
        />
      )}

      {hostToast && (
        // Lightweight toast — bottom-right, auto-dismiss after 2.4s.
        // Inline-styled because this is the only host-side toast in
        // EventsView (student-side toasts live in CommunityFeed and
        // already have a shared treatment).
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            background: '#111',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
          role="status"
        >
          {hostToast}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------

function FeaturedLive({ event }: { event: CommunityEvent }) {
  return (
    <div className={styles.eventFeatured}>
      <div className={styles.eventFeaturedTop}>
        <span className={styles.eventFeaturedLive}>
          <span className={styles.eventFeaturedDot} /> Live now
        </span>
        <span className={styles.eventFeaturedWhen}>
          <IconClock size={12} /> {event.duration} min
        </span>
      </div>
      <h2 className={styles.eventFeaturedTitle}>{event.title}</h2>
      {event.desc && <p className={styles.eventFeaturedDesc}>{event.desc}</p>}
      <div className={styles.eventFeaturedFoot}>
        <div className={styles.eventFeaturedHost}>
          <Avatar name={event.hostName} size={36} />
          <div>
            <div>
              <strong>{event.hostName}</strong>
            </div>
            <div className={styles.eventFeaturedHostSub}>
              {event.rsvpCount} watching
            </div>
          </div>
        </div>
        {event.meetingUrl ? (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.eventFeaturedJoin}
          >
            <IconVideo size={15} /> Join live now
          </a>
        ) : (
          <button
            type="button"
            className={styles.eventFeaturedJoin}
            disabled
            title="The host hasn't added a meeting link yet."
          >
            <IconVideo size={15} /> Join live now
          </button>
        )}
      </div>
    </div>
  )
}

function EventCard({
  event,
  past,
  onToggleGoing,
  onOpen,
  canRsvp,
  canManage,
  onEdit,
  onDelete,
  onViewAttendees,
  onAnnounce,
}: {
  event: CommunityEvent
  past?: boolean
  onToggleGoing: (id: string) => void
  onOpen: () => void
  canRsvp: boolean
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  // Host-only — undefined for student-facing cards so the menu items
  // simply don't render.
  onViewAttendees?: () => void
  onAnnounce?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger when the click came from an inner button / link.
    if ((e.target as HTMLElement).closest('button, a, label')) return
    onOpen()
  }
  const chip = formatDateChip(event.startAt, event.timezone)
  const whenHost = formatHostWhen(event.startAt, event.timezone)
  const whenViewer = formatViewerWhen(event.startAt, event.timezone)
  const coverPos = event.coverObjectPosition || '50% 50%'
  const coverStyle: React.CSSProperties = event.coverUrl
    ? {
        backgroundImage: `url(${event.coverUrl})`,
        backgroundPosition: coverPos,
        backgroundSize: 'cover',
      }
    : { background: `linear-gradient(135deg, #1f1f1f, #4a4a4a)` }

  const cardCls = `${styles.eventCardV5} ${event.live ? styles.eventCardV5Live : ''} ${past ? styles.eventCardV5Past : ''}`

  return (
    <article
      className={cardCls}
      onClick={handleCardClick}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.eventCoverV5}>
        <div className={styles.eventCoverV5Img} style={coverStyle} />
        <div className={styles.eventCoverOverlay}>
          {event.live ? (
            <span className={styles.eventCoverLive}>
              <span className={styles.dot} /> Live
            </span>
          ) : (
            <span className={styles.eventCoverDate}>
              <IconCalendar size={11} />
              <span className={styles.day}>
                {chip.month} {chip.day}
              </span>
            </span>
          )}
          <span className={styles.eventCoverType}>
            {TYPE_LABEL[event.type]}
          </span>
        </div>
        {past && (
          <div className={styles.eventCoverReplay}>
            <span className={styles.play}>
              <IconPlayCircle size={20} />
            </span>
          </div>
        )}
      </div>

      <div className={styles.eventBodyV5}>
        <div className={styles.eventTitleV5}>{event.title}</div>
        <div className={styles.eventMetaV5}>
          <span className={styles.eventMetaBit}>
            <IconClock size={11} /> {whenHost} · {event.duration}m
          </span>
          {whenViewer && (
            <span className={styles.eventMetaBit} style={{ opacity: 0.7 }}>
              {whenViewer}
            </span>
          )}
          {!past && event.location && (
            <span className={styles.eventMetaBit}>
              <IconMapPin size={11} /> {event.location}
            </span>
          )}
        </div>
        <div className={styles.eventHostV5}>
          <Avatar name={event.hostName} size={20} />
          <span>
            <strong>{event.hostName}</strong>
          </span>
        </div>
      </div>

      <div className={styles.eventFootV5}>
        {canManage && onViewAttendees ? (
          // Host view: the count is the primary entry-point to the
          // attendees roster — clicking it opens the same modal the
          // 3-dots menu does. We render as a button to get keyboard
          // focus + a hover affordance without restyling the meta row.
          <button
            type="button"
            className={styles.eventFootGoing}
            onClick={(e) => {
              e.stopPropagation()
              onViewAttendees()
            }}
            // Inline overrides match the static <span> visuals one-for-
            // one — a button has its own UA padding/border defaults.
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
            }}
            title="View attendees"
          >
            <strong>{event.rsvpCount}</strong> {past ? 'attended' : 'going'}
          </button>
        ) : (
          <span className={styles.eventFootGoing}>
            <strong>{event.rsvpCount}</strong> {past ? 'attended' : 'going'}
          </span>
        )}
        {past ? (
          event.replayUrl ? (
            <a
              href={event.replayUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`${styles.eventCtaV5} ${styles.eventCtaV5Replay}`}
            >
              <IconPlayCircle size={13} /> Replay
            </a>
          ) : (
            <button
              type="button"
              className={`${styles.eventCtaV5} ${styles.eventCtaV5Replay}`}
              disabled
              title="No replay posted yet."
            >
              <IconPlayCircle size={13} /> Replay
            </button>
          )
        ) : event.live ? (
          event.meetingUrl ? (
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`${styles.eventCtaV5} ${styles.eventCtaV5Live}`}
            >
              <IconVideo size={13} /> Join live
            </a>
          ) : (
            <button
              type="button"
              className={`${styles.eventCtaV5} ${styles.eventCtaV5Live}`}
              disabled
            >
              <IconVideo size={13} /> Join live
            </button>
          )
        ) : canRsvp ? (
          <button
            type="button"
            className={`${styles.eventCtaV5} ${styles.eventCtaV5Outline} ${event.going ? styles.eventCtaV5Going : ''}`}
            onClick={() => onToggleGoing(event.id)}
          >
            {event.going ? '✓ Going' : 'RSVP'}
          </button>
        ) : null}
      </div>

      {/* v5 redesign: 3-dots menu pinned to the bottom-right of the
          card (same placement as PostCard). Trigger has a white
          ring instead of the dark overlay since it sits over the
          card foot, not the cover image. */}
      {canManage && (
        <CardManageMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={() => setMenuOpen(false)}
          onEdit={() => {
            setMenuOpen(false)
            onEdit()
          }}
          onDelete={() => {
            setMenuOpen(false)
            onDelete()
          }}
          onViewAttendees={
            onViewAttendees
              ? () => {
                  setMenuOpen(false)
                  onViewAttendees()
                }
              : undefined
          }
          onAnnounce={
            onAnnounce
              ? () => {
                  setMenuOpen(false)
                  onAnnounce()
                }
              : undefined
          }
          placement="bottom-right"
        />
      )}
    </article>
  )
}

function EmptyEvents({
  onCreate,
  mine,
  activeFilter,
  onResetFilter,
  canCreate,
}: {
  onCreate: () => void
  mine: boolean
  activeFilter: string
  onResetFilter: () => void
  canCreate: boolean
}) {
  return (
    <div className={styles.eventsEmpty}>
      <div className={styles.eventsEmptyIcon}>
        <IconCalendar size={28} />
      </div>
      <div>
        <div className={styles.eventsEmptyTitle}>
          {mine
            ? canCreate
              ? 'You haven’t scheduled anything yet'
              : 'You haven’t RSVP’d to anything yet'
            : canCreate
              ? 'No events yet'
              : 'No events scheduled yet'}
        </div>
        <p className={styles.eventsEmptySub}>
          {mine
            ? canCreate
              ? 'Schedule a workshop, office hours, or a guest session.'
              : 'RSVP to an event to see it here.'
            : canCreate
              ? 'Host a bake-along, a cohort meetup, or open up a Q&A. The whole community gets notified.'
              : 'Your instructor hasn’t scheduled anything yet — check back soon.'}
        </p>
      </div>
      <div className={styles.eventsEmptyActions}>
        {canCreate && (
          <button
            type="button"
            className={styles.eventsEmptyBtn}
            onClick={onCreate}
          >
            <IconPlus size={13} /> Create event
          </button>
        )}
        {activeFilter !== 'all' && (
          <button
            type="button"
            className={`${styles.eventsEmptyBtn} ${styles.eventsEmptyBtnGhost}`}
            onClick={onResetFilter}
          >
            See all events
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Create event modal
// ---------------------------------------------------------------------

function CreateEventModal({
  open,
  courseId,
  hostName,
  editing,
  onClose,
  onSubmit,
  onAnnounce,
}: {
  open: boolean
  courseId: string | undefined
  hostName: string
  editing: CommunityEvent | null
  onClose: () => void
  onSubmit: (e: CommunityEventCreateInput) => void
  // Optional — only passed in edit mode. Fires the same "re-announce"
  // confirm-and-enqueue that the 3-dots menu does, but inline in the
  // edit flow so the host can save changes and notify in one sitting.
  onAnnounce?: () => void
}) {
  const isEdit = !!editing
  const [title, setTitle] = useState('')
  const [type, setType] = useState<EventType>('workshop')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [timezone, setTimezone] = useState<string>(VIEWER_TZ)
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState<string>('')
  const [coverObjectPosition, setCoverObjectPosition] =
    useState<string>('50% 50%')
  const [desc, setDesc] = useState('')
  const [notify, setNotify] = useState(true)

  const titleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      // Seed every field from the existing event. Split start_at back
      // into the modal's date/time strings (in the host's tz so the
      // values match what they originally picked).
      const d = new Date(editing.startAt)
      const tz = editing.timezone || VIEWER_TZ
      const fmt = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: tz, ...opts }).format(d)
      const yyyy = fmt({ year: 'numeric' })
      const mm = fmt({ month: '2-digit' })
      const dd = fmt({ day: '2-digit' })
      const hh = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d)
      setTitle(editing.title)
      setType(editing.type)
      setDate(`${yyyy}-${mm}-${dd}`)
      setStartTime(hh)
      setDuration(editing.duration)
      setTimezone(tz)
      setLocation(editing.location || '')
      setCoverUrl(editing.coverUrl || '')
      setCoverObjectPosition(editing.coverObjectPosition || '50% 50%')
      setMeetingUrl(editing.meetingUrl || '')
      setDesc(editing.desc || '')
      // Notify only fires on publish, not on edit — default off in edit mode
      // so a save doesn't accidentally re-notify everyone.
      setNotify(false)
    } else {
      setTitle('')
      setType('workshop')
      setDate('')
      setStartTime('')
      setDuration('60')
      setTimezone(VIEWER_TZ)
      setLocation('')
      setCoverUrl('')
      setCoverObjectPosition('50% 50%')
      setMeetingUrl('')
      setDesc('')
      setNotify(true)
    }
    setTimeout(() => titleRef.current?.focus(), 50)
  }, [open, editing])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const types: { id: EventType; label: string; icon: React.ReactNode }[] = [
    { id: 'workshop', label: 'Workshop', icon: <IconVideo size={15} /> },
    { id: 'office', label: 'Office hours', icon: <IconChat size={15} /> },
    { id: 'cohort', label: 'Cohort meetup', icon: <IconUsers size={15} /> },
    { id: 'guest', label: 'Guest session', icon: <IconSmile size={15} /> },
  ]

  const canSubmit = title.trim().length > 0 && date && startTime

  const submit = () => {
    if (!canSubmit) return
    onSubmit({
      title: title.trim(),
      type,
      desc: desc.trim(),
      date,
      startTime,
      timezone,
      duration,
      location: location.trim(),
      meetingUrl: meetingUrl.trim(),
      coverUrl,
      coverObjectPosition,
      notify,
    })
  }

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.ceModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.ceHead}>
          <div className={styles.ceTitle}>
            {isEdit ? 'Edit event' : 'Create event'}
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className={styles.ceBody}>
          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Cover image</span>
            <CoverUploader
              courseId={courseId}
              value={coverUrl}
              position={coverObjectPosition}
              onChange={({ coverUrl: u, coverObjectPosition: p }) => {
                setCoverUrl(u)
                setCoverObjectPosition(p)
              }}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Title</span>
            <input
              ref={titleRef}
              className={`${styles.ceInput} ${styles.ceInputTitle}`}
              placeholder="Event title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Type</span>
            <div className={styles.ceTypeGrid}>
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.ceType} ${type === t.id ? styles.active : ''}`}
                  onClick={() => setType(t.id)}
                >
                  <span className={styles.ceTypeIco}>{t.icon}</span>
                  <span className={styles.ceTypeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>When</span>
            <div className={styles.ceRow3}>
              <input
                type="date"
                className={styles.ceInput}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                type="time"
                className={styles.ceInput}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <select
                className={styles.ceInput}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="75">75 min</option>
                <option value="90">90 min</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <select
                className={styles.ceInput}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ flex: 1 }}
              >
                {COMMON_TIMEZONES.includes(timezone) ? null : (
                  <option value={timezone}>{timezone}</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              {date && startTime && (
                <span
                  style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap' }}
                >
                  {previewWhen(date, startTime, timezone)}
                </span>
              )}
            </div>
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Meeting link</span>
            <input
              className={styles.ceInput}
              placeholder="Zoom, Google Meet, Calendly… (https://)"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Where (optional)</span>
            <input
              className={styles.ceInput}
              placeholder="Room name, city, or 'TBD'"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Description</span>
            <textarea
              className={styles.ceInput}
              style={{ minHeight: 80, resize: 'none' }}
              placeholder="What will you cover? What should attendees bring?"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <div className={styles.ceToggleRow}>
            <div>
              <div className={styles.ceToggleText}>Notify all members</div>
              <div className={styles.ceToggleSub}>
                Sends a notification when the event is published.
              </div>
            </div>
            <button
              type="button"
              className={`${styles.ceSwitch} ${notify ? styles.ceSwitchOn : ''}`}
              onClick={() => setNotify((v) => !v)}
              aria-pressed={notify}
              aria-label="Notify members"
            />
          </div>
        </div>
        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft}>Hosted by you · {hostName}</div>
          <div className={styles.ceActions}>
            {isEdit && onAnnounce ? (
              <button
                type="button"
                // Ghost variant: re-announcing is a separate action
                // from saving the form, and we don't want it
                // competing with the primary Save CTA. The host hits
                // Cancel/Save for the form-state path; this nudges
                // attendees as a discrete extra step.
                className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
                onClick={onAnnounce}
                title="Send a fresh announcement to all members"
              >
                Re-announce
              </button>
            ) : null}
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnPrimary}`}
              disabled={!canSubmit}
              onClick={submit}
            >
              <IconCalendar size={13} />{' '}
              {isEdit ? 'Save changes' : 'Publish event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Shared cover-image uploader for the create modals.
//
// Uses the existing /v1/community/{course_id}/media/image-upload S3
// pipeline (the same one community-post images ride), then surfaces
// the project-wide ThumbnailPositioner so the host can pick the
// focal point — same UX as course thumbnails. The position is stored
// alongside cover_url as `cover_object_position` (a CSS object-position
// string like '43.5% 62.0%').
// ---------------------------------------------------------------------

import { useUploadPostImage } from '@/hooks/queries/community'
import { ThumbnailPositioner } from '../Courses/editor/ThumbnailPositioner'

export function CoverUploader({
  courseId,
  value,
  position,
  onChange,
}: {
  courseId: string | undefined
  value: string
  position: string
  onChange: (next: { coverUrl: string; coverObjectPosition: string }) => void
}) {
  const upload = useUploadPostImage(null, courseId, 'creator')

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const result = await upload.mutateAsync(f)
      onChange({
        coverUrl: result.public_url,
        coverObjectPosition: position || '50% 50%',
      })
    } catch (err) {
      console.error('[CoverUploader] upload failed', err)
    } finally {
      // Reset so picking the same file twice still fires onChange.
      e.target.value = ''
    }
  }

  const hasImage = !!value

  if (hasImage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ borderRadius: 12, overflow: 'hidden' }}>
          <ThumbnailPositioner
            src={value}
            value={position || '50% 50%'}
            onChange={(next) =>
              onChange({ coverUrl: value, coverObjectPosition: next })
            }
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--c-muted, #6b7280)',
          }}
        >
          <span>Drag the image to pick the focal point.</span>
          <label
            style={{
              cursor: upload.isPending ? 'wait' : 'pointer',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'var(--c-panel)',
              color: 'var(--c-ink)',
              fontSize: 11.5,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid var(--c-line)',
            }}
          >
            <IconImage size={12} />{' '}
            {upload.isPending ? 'Uploading…' : 'Replace image'}
            <input
              type="file"
              accept="image/*"
              onChange={onFile}
              style={{ display: 'none' }}
              disabled={upload.isPending}
            />
          </label>
        </div>
      </div>
    )
  }

  return (
    <label className={styles.ceCover} aria-busy={upload.isPending}>
      <span className={styles.ceCoverIcon}>
        <IconImage size={20} />
      </span>
      <span className={styles.ceCoverText}>
        {upload.isPending ? 'Uploading…' : 'Upload a cover image'}
      </span>
      <span className={styles.ceCoverSub}>
        PNG or JPG · 1600×900 recommended
      </span>
      <input
        className={styles.ceCoverInput}
        type="file"
        accept="image/*"
        onChange={onFile}
        disabled={upload.isPending}
      />
    </label>
  )
}

// ---------------------------------------------------------------------
// Card manage menu — the '...' button + dropdown shown on event /
// activity cards when the viewer can manage the row (host only).
// Inline-styled so it can ship without a CSS-module addition.
// ---------------------------------------------------------------------

export function CardManageMenu({
  open,
  onToggle,
  onClose,
  onEdit,
  onDelete,
  onViewAttendees,
  onAnnounce,
  placement = 'top-right',
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  /** Optional host-only actions for event cards. Activities pass
   * neither (Edit/Delete only); EventsView passes both. */
  onViewAttendees?: () => void
  onAnnounce?: () => void
  /** Where on the card the trigger sits. v5 cards (events,
   * activities) anchor it bottom-right; the older cover-overlay
   * placement stays top-right by default. */
  placement?: 'top-right' | 'bottom-right'
}) {
  const isBottom = placement === 'bottom-right'
  const anchorStyle: React.CSSProperties = isBottom
    ? { position: 'absolute', bottom: 14, right: 14, zIndex: 6 }
    : { position: 'absolute', top: 10, right: 10, zIndex: 6 }
  // Anchored to bottom-right: the popup must open UPWARD so it
  // doesn't get clipped or pushed off-screen by the next card.
  const popupStyle: React.CSSProperties = isBottom
    ? {
        position: 'absolute',
        bottom: 36,
        right: 0,
        minWidth: 160,
        background: '#fff',
        border: '1px solid var(--c-line)',
        borderRadius: 12,
        boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }
    : {
        position: 'absolute',
        top: 32,
        right: 0,
        minWidth: 160,
        background: '#fff',
        border: '1px solid var(--c-line)',
        borderRadius: 12,
        boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }
  const triggerStyle: React.CSSProperties = isBottom
    ? {
        width: 28,
        height: 28,
        borderRadius: 999,
        background: '#fff',
        boxShadow: 'inset 0 0 0 1px var(--c-line), 0 1px 2px rgba(0,0,0,0.04)',
        color: 'var(--c-ink)',
        border: 'none',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: -1,
        padding: 0,
      }
    : {
        width: 28,
        height: 28,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: -1,
        padding: 0,
      }
  return (
    <div style={anchorStyle} onMouseLeave={onClose}>
      <button
        type="button"
        aria-label="Manage"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggle()
        }}
        style={triggerStyle}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" style={popupStyle}>
          {onViewAttendees ? (
            <MenuItem onClick={onViewAttendees}>View attendees</MenuItem>
          ) : null}
          {onAnnounce ? (
            <MenuItem onClick={onAnnounce}>Re-announce</MenuItem>
          ) : null}
          <MenuItem onClick={onEdit}>Edit</MenuItem>
          <MenuItem onClick={onDelete} danger>
            Delete
          </MenuItem>
        </div>
      )}
    </div>
  )
}

// Inline menu-item shared between CardManageMenu rows so the four item
// types stay visually identical (one source of padding/font/colour).
function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        color: danger ? '#dc2626' : 'var(--c-ink)',
      }}
    >
      {children}
    </button>
  )
}
