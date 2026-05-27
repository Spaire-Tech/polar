'use client'

// Host-only attendees roster for a single community event. Lives in the
// same shared modal/list style as CreateEventModal — same backdrop, same
// modal chrome, same close affordance — so the host's flow from
// "card 3-dots → View attendees" doesn't visually jump.

import { useEffect } from 'react'
import {
  type CommunityEventAttendeeRead,
  useCommunityEventAttendees,
} from '../../hooks/queries/community'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconUsers, IconX } from './icons'

type Props = {
  open: boolean
  courseId: string
  eventId: string | null
  eventTitle: string | null
  onClose: () => void
}

export function EventAttendeesModal({
  open,
  courseId,
  eventId,
  eventTitle,
  onClose,
}: Props) {
  // The hook's `enabled` guard means we only fetch when both ids are
  // truthy. Passing `null` here mirrors how CreateEventModal/edit gates
  // its loaders.
  const { data, isLoading, isError } = useCommunityEventAttendees(
    open && eventId ? courseId : undefined,
    open ? (eventId ?? undefined) : undefined,
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !eventId) return null

  const rows: CommunityEventAttendeeRead[] = data ?? []

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Event attendees"
    >
      <div
        className={styles.ceModal}
        onClick={(e) => e.stopPropagation()}
        // Cap the modal so a 500-person attendee list scrolls inside,
        // not the page. Inherits .ceModal's max-height; we just need
        // the body to be the scroll container.
        style={{ maxWidth: 520 }}
      >
        <div className={styles.ceHead}>
          <div className={styles.ceTitle}>
            <IconUsers size={16} />{' '}
            {eventTitle ? `Attendees · ${eventTitle}` : 'Attendees'}
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
        <div
          className={styles.ceBody}
          style={{ gap: 0, padding: '8px 0', minHeight: 200 }}
        >
          {isLoading ? (
            <RosterStatus>Loading attendees…</RosterStatus>
          ) : isError ? (
            <RosterStatus>Could not load attendees. Try again.</RosterStatus>
          ) : rows.length === 0 ? (
            <RosterStatus>
              No RSVPs yet — share the event link to nudge members.
            </RosterStatus>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {rows.map((a) => (
                <AttendeeRow key={a.customer_id} attendee={a} />
              ))}
            </ul>
          )}
        </div>
        <div
          // Footer: aggregate count + copy-email helper. Reuses the
          // same border-top look as .ceFoot to stay visually anchored
          // with the create-event modal.
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--c-hair)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--c-muted)',
          }}
        >
          <span>
            <strong style={{ color: 'var(--c-ink)' }}>{rows.length}</strong>{' '}
            going
          </span>
          {rows.length > 0 ? (
            <CopyEmailsButton emails={rows.map((r) => r.email)} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AttendeeRow({ attendee }: { attendee: CommunityEventAttendeeRead }) {
  const rsvped = new Date(attendee.rsvp_at)
  // Same date format the activities feed uses for "posted X" — short
  // month + day, no year unless it's not the current one.
  const sameYear = rsvped.getFullYear() === new Date().getFullYear()
  const when = new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(rsvped)

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 22px',
      }}
    >
      <Avatar
        name={attendee.name}
        avatarUrl={attendee.avatar_url || undefined}
        size={36}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--c-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {attendee.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--c-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {attendee.email}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
        RSVP&apos;d {when}
      </div>
    </li>
  )
}

function RosterStatus({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '40px 22px',
        textAlign: 'center',
        color: 'var(--c-muted)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  )
}

function CopyEmailsButton({ emails }: { emails: string[] }) {
  // Plain inline button — matches the host-modal action affordances
  // already living inside .ceFoot (Cancel/Save). We don't promote it
  // to a primary CTA: the primary action of this modal is *seeing*
  // the list, not exporting it.
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(', '))
    } catch {
      // No-op — clipboard can be blocked in iframe/embed contexts.
      // The host can still see emails inline.
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--c-ink)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 8,
      }}
      title="Copy all emails to clipboard"
    >
      Copy emails
    </button>
  )
}
