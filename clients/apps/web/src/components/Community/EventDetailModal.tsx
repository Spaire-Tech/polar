'use client'

// Community v5 — event detail framed in a faux browser chrome.
// URL bar shows the real share URL the Share button copies, so what
// the host sees in the modal === what attendees see in their clipboard.
// Below that: cover-image hero, date/time/location/attendees rows,
// host card, description, and a sticky footer with the right CTA
// depending on state (RSVP / Join live / Watch replay), plus
// Share + Add-to-Calendar.
//
// Per spec the 'Run of show' agenda is NOT included — events backend
// doesn't model an agenda.

import { useEffect, useState } from 'react'
import { getPublicServerURL } from '../../utils/api'
import { Avatar } from './Avatar'
import { calendarLinksFor } from './calendarLinks'
import styles from './community.module.css'
import type { CommunityEvent } from './EventsView'
import {
  IconBookmark,
  IconCalendar,
  IconChat,
  IconClock,
  IconMapPin,
  IconPlayCircle,
  IconShare,
  IconUsers,
  IconVideo,
  IconX,
} from './icons'

const TYPE_LABEL: Record<string, string> = {
  workshop: 'Workshop',
  office: 'Office hours',
  cohort: 'Cohort meetup',
  guest: 'Guest session',
}

type Props = {
  event: CommunityEvent | null
  // The organization slug the modal is being rendered inside. Used to
  // build the canonical share URL — if omitted the Share button falls
  // back to the current page's URL with a #event-{id} fragment.
  organizationSlug?: string
  onClose: () => void
  onToggleGoing: () => void
}

export function EventDetailModal({
  event,
  organizationSlug,
  onClose,
  onToggleGoing,
}: Props) {
  // Tiny inline-toast: "Link copied" feedback after Share. Auto-clears
  // after 2 seconds. We keep it inside the modal (not the parent toast)
  // so the modal's own surface owns its feedback.
  const [shareToast, setShareToast] = useState<string | null>(null)
  useEffect(() => {
    if (!shareToast) return
    const t = setTimeout(() => setShareToast(null), 2000)
    return () => clearTimeout(t)
  }, [shareToast])

  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [event, onClose])

  if (!event) return null

  const isLive = event.live
  const isPast = !!event.past

  // Canonical share URL — public event page rendered by the
  // (header)/events/[eventId] route. Falls back to current-page URL +
  // hash when the modal is rendered without an org context (preview
  // surfaces). The Share button copies this; the URL bar in the
  // chrome shows the same string so what you see is what you share.
  const shareUrl =
    typeof window !== 'undefined' && organizationSlug
      ? `${window.location.origin}/${organizationSlug}/events/${event.id}`
      : typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}#event-${event.id}`
        : ''
  const shareUrlDisplay = shareUrl.replace(/^https?:\/\//, '')

  // .ics + Google/Outlook deep links. Built lazily — we only show the
  // menu after the user clicks Add to Calendar.
  const icsUrl = getPublicServerURL(
    `/v1/community/public/events/${event.id}/ics`,
  )
  const calLinks = calendarLinksFor(
    {
      title: event.title,
      startAt: event.startAt,
      // `duration` is the modal-input string format ("60"); coerce
      // to a number for the calendar deep-link builder.
      durationMinutes: parseInt(event.duration, 10) || 60,
      description: event.desc,
      location: event.location,
      meetingUrl: event.meetingUrl,
    },
    icsUrl,
  )

  const onShare = async () => {
    if (!shareUrl) return
    // navigator.share is the right primitive on mobile (drops into the
    // OS share sheet); on desktop we fall back to clipboard. Both
    // produce a "Link copied" / "Link shared" toast.
    try {
      if (
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({
          title: event.title,
          url: shareUrl,
        })
        setShareToast('Link shared')
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareToast('Link copied')
    } catch {
      // User cancelled the share sheet — silently no-op so we don't
      // confuse them with an error toast.
    }
  }

  const coverPos = event.coverObjectPosition || '50% 50%'
  const coverStyle: React.CSSProperties = event.coverUrl
    ? {
        backgroundImage: `url(${event.coverUrl})`,
        backgroundPosition: coverPos,
        backgroundSize: 'cover',
      }
    : { background: 'linear-gradient(135deg, #1f1f1f, #4a4a4a)' }

  const start = new Date(event.startAt)
  const tz = event.timezone || 'UTC'
  const whenDate = new Intl.DateTimeFormat([], {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(start)
  const whenTime = new Intl.DateTimeFormat([], {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(start)

  return (
    <div className={styles.eventIframeOverlay} onClick={onClose}>
      <div
        className={styles.eventIframe}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
      >
        <div className={styles.eventIframeChrome}>
          <div className={styles.eventIframeDots}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.eventIframeUrl}>
            {shareUrlDisplay || 'community.spaire.app/events/' + event.id}
          </div>
          {/* Share + Close. Share lives inside the chrome (not the
              sticky footer) because it's a meta action on the page,
              not a step in the RSVP flow. */}
          <button
            type="button"
            className={styles.eventIframeClose}
            onClick={onShare}
            title="Copy share link"
            aria-label="Share event"
            style={{ marginRight: 4 }}
          >
            <IconShare size={15} />
          </button>
          <button
            type="button"
            className={styles.eventIframeClose}
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className={styles.eventIframeContent}>
          <div className={styles.evHero}>
            <div className={styles.evHeroImg} style={coverStyle} />
            <div className={styles.evHeroGrad} />
            <div className={styles.evHeroMeta}>
              {isLive ? (
                <span className={styles.evHeroLive}>
                  <span className={styles.dot} /> Live now
                </span>
              ) : isPast ? (
                <span
                  className={styles.evHeroType}
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                  }}
                >
                  Past · Replay
                </span>
              ) : null}
              <span className={styles.evHeroType}>
                {TYPE_LABEL[event.type] ?? event.type}
              </span>
            </div>
          </div>

          <div className={styles.evBody}>
            <div className={styles.evDatePill}>
              <IconCalendar size={11} /> {isLive ? 'Happening now' : whenDate}
            </div>
            <h1 className={styles.evTitle}>{event.title}</h1>

            <div className={styles.evRows}>
              <span className={styles.evRowIcon}>
                <IconClock size={16} />
              </span>
              <div className={styles.evRowText}>
                <strong>
                  {isLive ? 'In progress' : `${whenDate} · ${whenTime}`}
                </strong>
                <div className={styles.evRowTextSub}>
                  {event.duration} min · Drop in any time after doors open
                </div>
              </div>

              <span className={styles.evRowIcon}>
                <IconMapPin size={16} />
              </span>
              <div className={styles.evRowText}>
                <strong>
                  {event.meetingUrl
                    ? 'Online · link in footer'
                    : event.location || 'Location TBD'}
                </strong>
                <div className={styles.evRowTextSub}>
                  Replay posted within 24h for anyone who can&apos;t attend
                </div>
              </div>

              <span className={styles.evRowIcon}>
                <IconUsers size={16} />
              </span>
              <div className={styles.evRowText}>
                <strong>Open to everyone in this course</strong>
                <div className={styles.evRowTextSub}>
                  {event.rsvpCount} {isPast ? 'attended' : 'going'}
                </div>
              </div>
            </div>

            <div className={styles.evSectionTitle}>Hosted by</div>
            <div className={styles.evHostCard}>
              <Avatar name={event.hostName} size={44} />
              <div className={styles.evHostCardInfo}>
                <div className={styles.evHostCardName}>{event.hostName}</div>
                <div className={styles.evHostCardSub}>Instructor</div>
              </div>
            </div>

            <div className={styles.evSectionTitle}>About this event</div>
            <div className={styles.evDesc}>
              {event.desc || 'No description yet.'}
            </div>
          </div>
        </div>

        <div className={styles.evFooter}>
          <div className={styles.evFooterMeta}>
            <span>
              {isLive
                ? 'Live now'
                : isPast
                  ? 'Past event'
                  : 'Doors open 5 min before'}
            </span>
            <strong>
              {event.duration} min · {TYPE_LABEL[event.type] ?? event.type}
            </strong>
          </div>
          <div className={styles.evFooterActions}>
            {isPast ? (
              event.replayUrl ? (
                <a
                  href={event.replayUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`${styles.evFooterBtn} ${styles.evFooterBtnPrimary}`}
                >
                  <IconPlayCircle size={15} /> Watch replay
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.evFooterBtn} ${styles.evFooterBtnPrimary}`}
                  disabled
                >
                  <IconPlayCircle size={15} /> Replay coming soon
                </button>
              )
            ) : isLive ? (
              event.meetingUrl ? (
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`${styles.evFooterBtn} ${styles.evFooterBtnLive}`}
                >
                  <IconVideo size={15} /> Join live now
                </a>
              ) : (
                <button
                  type="button"
                  className={`${styles.evFooterBtn} ${styles.evFooterBtnLive}`}
                  disabled
                >
                  <IconVideo size={15} /> Join live now
                </button>
              )
            ) : (
              <>
                {event.going ? (
                  // Once the user is going, the primary slot becomes
                  // "Add to calendar" — the most useful next step. RSVP
                  // demotes to a small "You're going" indicator on the
                  // left of the footer meta so they can still un-RSVP.
                  <AddToCalendarMenu links={calLinks} />
                ) : null}
                <button
                  type="button"
                  // Once "Add to calendar" takes the primary slot,
                  // the RSVP button demotes to ghost so it still
                  // reads as an active control (for un-RSVP) without
                  // competing for the eye.
                  className={`${styles.evFooterBtn} ${event.going ? styles.evFooterBtnGhost : styles.evFooterBtnPrimary}`}
                  onClick={onToggleGoing}
                >
                  {event.going ? (
                    <>
                      <IconBookmark size={14} /> You&apos;re going
                    </>
                  ) : (
                    <>
                      <IconCalendar size={14} /> RSVP
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {shareToast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 220,
            background: '#111',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}
          role="status"
        >
          {shareToast}
        </div>
      ) : null}
    </div>
  )
}

// "Add to calendar" popover. Three options that cover ~99% of users:
// Google (deep link), Outlook (deep link), .ics download (Apple +
// fallback). Anchored to its trigger; click outside or another option
// to dismiss. Inline-styled to match the AppleX monochrome treatment
// of the rest of the modal without claiming a CSS-module class.
function AddToCalendarMenu({
  links,
}: {
  links: { google: string; outlook: string; ics: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={`${styles.evFooterBtn} ${styles.evFooterBtnPrimary}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Add to calendar"
      >
        <IconCalendar size={14} /> Add to calendar
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            minWidth: 200,
            background: '#fff',
            border: '1px solid var(--c-line)',
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 8,
          }}
        >
          <CalLink href={links.google} label="Google Calendar" />
          <CalLink href={links.outlook} label="Outlook" />
          <CalLink href={links.ics} label="Apple Calendar (.ics)" download />
        </div>
      ) : null}
    </div>
  )
}

function CalLink({
  href,
  label,
  download,
}: {
  href: string
  label: string
  download?: boolean
}) {
  return (
    <a
      role="menuitem"
      href={href}
      target={download ? undefined : '_blank'}
      rel="noreferrer noopener"
      // `download` triggers a file save instead of a navigation for
      // the .ics link. Google/Outlook open in a new tab.
      {...(download ? { download: '' } : {})}
      style={{
        display: 'block',
        textAlign: 'left',
        padding: '8px 12px',
        borderRadius: 8,
        background: 'transparent',
        textDecoration: 'none',
        fontSize: 13,
        color: 'var(--c-ink)',
      }}
    >
      {label}
    </a>
  )
}

// Silence unused-import helper.
const _ = IconChat
