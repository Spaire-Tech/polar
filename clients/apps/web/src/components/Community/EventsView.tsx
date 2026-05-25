'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import {
  IconCalendar,
  IconChat,
  IconClock,
  IconMapPin,
  IconPlayCircle,
  IconPlus,
  IconSmile,
  IconUsers,
  IconVideo,
  IconX,
} from './icons'

// Phase 3C: events surface is client-state only — the backend doesn't
// model events yet. The form ships first so creators see what the flow
// will feel like, and so we have a real UI target to wire when the
// `/community/{course_id}/events` endpoints land.

export type CommunityEvent = {
  id: string
  title: string
  type: EventType
  desc: string
  date: string // ISO date (YYYY-MM-DD)
  startTime: string // HH:mm local
  duration: string // minutes
  location: string
  hostName: string
  rsvpCount: number
  going: boolean
  live: boolean
  past?: boolean
}

type EventType = 'workshop' | 'office' | 'cohort' | 'guest'

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

const formatDateChip = (iso: string): { month: string; day: number } => {
  const d = new Date(iso + 'T00:00:00')
  return { month: MONTH_ABBR[d.getMonth()], day: d.getDate() }
}

const formatWhen = (date: string, time: string, duration: string): string => {
  const d = new Date(`${date}T${time || '00:00'}:00`)
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }
  const timeStr = time
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''
  const datePart = d.toLocaleDateString([], opts)
  return timeStr ? `${datePart} · ${timeStr}` : `${datePart} · ${duration}m`
}

type Props = {
  hostName: string
  events: CommunityEvent[]
  onCreate: (event: CommunityEvent) => void
  onToggleGoing: (id: string) => void
}

export function EventsView({
  hostName,
  events,
  onCreate,
  onToggleGoing,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | EventType | 'mine'>('all')

  const filters: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'workshop', label: 'Workshops' },
    { id: 'office', label: 'Office hours' },
    { id: 'cohort', label: 'Cohort meetups' },
    { id: 'guest', label: 'Guests' },
    { id: 'mine', label: 'My events' },
  ]

  const matches = (e: CommunityEvent) => {
    if (filter === 'all') return true
    if (filter === 'mine') return e.going
    return e.type === filter
  }

  const live = events.find((e) => e.live && matches(e)) ?? null
  const upcoming = events.filter((e) => !e.live && !e.past && matches(e))
  const past = events.filter((e) => e.past)

  const upcomingCount = events.filter((e) => !e.past).length

  return (
    <>
      <header className={styles.feedHeader}>
        <div className={styles.feedEyebrow}>
          {upcomingCount === 0
            ? 'No upcoming events yet'
            : `${upcomingCount} upcoming${live ? ' · 1 live now' : ''}`}
        </div>
        <h1 className={styles.feedTitle}>Events</h1>
        <p className={styles.feedSub}>
          Live workshops, office hours, cohort meetups, and guest sessions.
          Replays show up here for anything you miss.
        </p>
      </header>

      <div className={styles.eventsToolbar}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.filterChip} ${filter === f.id ? styles.active : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <span className={styles.filterSpacer} />
        <button
          type="button"
          className={styles.newEventBtn}
          onClick={() => setCreateOpen(true)}
        >
          <IconPlus size={13} /> Create event
        </button>
      </div>

      {live && <FeaturedLive event={live} />}

      {upcoming.length === 0 && !live ? (
        <EmptyEvents
          onCreate={() => setCreateOpen(true)}
          mine={filter === 'mine'}
          onResetFilter={() => setFilter('all')}
          activeFilter={filter}
        />
      ) : (
        upcoming.length > 0 && (
          <div className={styles.eventsSection}>
            <div className={styles.eventsSectionTitle}>Upcoming</div>
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} onToggleGoing={onToggleGoing} />
            ))}
          </div>
        )
      )}

      {past.length > 0 && filter !== 'mine' && (
        <div className={styles.eventsSection}>
          <div className={styles.eventsSectionTitle}>Past · Replays</div>
          {past.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              onToggleGoing={onToggleGoing}
              past
            />
          ))}
        </div>
      )}

      <CreateEventModal
        open={createOpen}
        hostName={hostName}
        onClose={() => setCreateOpen(false)}
        onCreate={(e) => {
          onCreate(e)
          setCreateOpen(false)
        }}
      />
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
        <button type="button" className={styles.eventFeaturedJoin}>
          <IconVideo size={15} /> Join live now
        </button>
      </div>
    </div>
  )
}

function EventCard({
  event,
  past,
  onToggleGoing,
}: {
  event: CommunityEvent
  past?: boolean
  onToggleGoing: (id: string) => void
}) {
  const chip = formatDateChip(event.date)

  if (past) {
    return (
      <div className={`${styles.eventCard} ${styles.eventCardPast}`}>
        <div className={styles.eventDate}>
          <span className={styles.eventDateMonth}>{chip.month}</span>
          <span className={styles.eventDateDay}>{chip.day}</span>
        </div>
        <div className={styles.eventMain}>
          <div className={styles.eventTop}>
            <span
              className={`${styles.eventType} ${styles[`eventType_${event.type}`]}`}
            >
              {TYPE_LABEL[event.type]}
            </span>
          </div>
          <div className={styles.eventTitle}>{event.title}</div>
          <div className={styles.eventHost}>
            <Avatar name={event.hostName} size={18} />
            <span>
              <strong>{event.hostName}</strong> · {event.duration} min
            </span>
            <span>· {event.rsvpCount} attended</span>
          </div>
        </div>
        <div className={styles.eventActions}>
          <button
            type="button"
            className={`${styles.eventCta} ${styles.eventCtaReplay}`}
          >
            <IconPlayCircle size={13} /> Watch replay
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.eventCard}>
      <div className={styles.eventDate}>
        <span className={styles.eventDateMonth}>{chip.month}</span>
        <span className={styles.eventDateDay}>{chip.day}</span>
      </div>
      <div className={styles.eventMain}>
        <div className={styles.eventTop}>
          <span
            className={`${styles.eventType} ${styles[`eventType_${event.type}`]}`}
          >
            {TYPE_LABEL[event.type]}
          </span>
        </div>
        <div className={styles.eventTitle}>{event.title}</div>
        <div className={styles.eventMeta}>
          <span className={styles.eventMetaBit}>
            <IconClock size={11} />
            {formatWhen(event.date, event.startTime, event.duration)}
          </span>
          {event.location && (
            <span className={styles.eventMetaBit}>
              <IconMapPin size={11} /> {event.location}
            </span>
          )}
        </div>
        <div className={styles.eventHost}>
          <Avatar name={event.hostName} size={18} />
          <span>
            <strong>{event.hostName}</strong>
          </span>
          <span>· {event.rsvpCount} going</span>
        </div>
      </div>
      <div className={styles.eventActions}>
        <button
          type="button"
          className={`${styles.eventCta} ${styles.eventCtaOutline} ${
            event.going ? styles.eventCtaGoing : ''
          }`}
          onClick={() => onToggleGoing(event.id)}
        >
          {event.going ? '✓ Going' : 'RSVP'}
        </button>
      </div>
    </div>
  )
}

function EmptyEvents({
  onCreate,
  mine,
  activeFilter,
  onResetFilter,
}: {
  onCreate: () => void
  mine: boolean
  activeFilter: string
  onResetFilter: () => void
}) {
  return (
    <div className={styles.eventsEmpty}>
      <div className={styles.eventsEmptyIcon}>
        <IconCalendar size={28} />
      </div>
      <div>
        <div className={styles.eventsEmptyTitle}>
          {mine ? 'You haven’t RSVP’d to anything yet' : 'No events yet'}
        </div>
        <p className={styles.eventsEmptySub}>
          {mine
            ? 'RSVP to an event to see it here.'
            : 'Host a bake-along, a cohort meetup, or open up a Q&A. The whole community gets notified.'}
        </p>
      </div>
      <div className={styles.eventsEmptyActions}>
        <button
          type="button"
          className={styles.eventsEmptyBtn}
          onClick={onCreate}
        >
          <IconPlus size={13} /> Create event
        </button>
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
  hostName,
  onClose,
  onCreate,
}: {
  open: boolean
  hostName: string
  onClose: () => void
  onCreate: (e: CommunityEvent) => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<EventType>('workshop')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [location, setLocation] = useState('')
  const [desc, setDesc] = useState('')
  const [notify, setNotify] = useState(true)
  const [recurring, setRecurring] = useState(false)

  const titleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setType('workshop')
      setDate('')
      setStartTime('')
      setDuration('60')
      setLocation('')
      setDesc('')
      setNotify(true)
      setRecurring(false)
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open])

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
    onCreate({
      id: `evt-${Date.now()}`,
      title: title.trim(),
      type,
      desc: desc.trim(),
      date,
      startTime,
      duration,
      location: location.trim(),
      hostName,
      rsvpCount: 0,
      going: true,
      live: false,
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
          <div className={styles.ceTitle}>Create event</div>
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
          <div className={styles.ceCover}>
            <span className={styles.ceCoverLabel}>
              <IconCalendar size={13} /> Add cover image
            </span>
          </div>

          <div className={styles.ceField}>
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
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Where</span>
            <input
              className={styles.ceInput}
              placeholder="Zoom link, location, or 'TBD'"
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

          <div className={styles.ceToggleRow}>
            <div>
              <div className={styles.ceToggleText}>Recurring weekly</div>
              <div className={styles.ceToggleSub}>
                Repeats every week until you cancel.
              </div>
            </div>
            <button
              type="button"
              className={`${styles.ceSwitch} ${recurring ? styles.ceSwitchOn : ''}`}
              onClick={() => setRecurring((v) => !v)}
              aria-pressed={recurring}
              aria-label="Recurring weekly"
            />
          </div>
        </div>
        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft}>Hosted by you · {hostName}</div>
          <div className={styles.ceActions}>
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
              <IconCalendar size={13} /> Publish event
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
