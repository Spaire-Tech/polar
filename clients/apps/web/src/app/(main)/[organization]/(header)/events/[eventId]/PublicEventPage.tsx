'use client'

// Public, unauthenticated event landing page. Renders the same hero +
// rows + host card the in-portal EventDetailModal uses, so a shared
// link looks like the in-app modal "popped open" as a real page.
//
// Two key differences from the modal:
//   1. No RSVP button — RSVPing requires an enrolled customer
//      session, which a public viewer doesn't have. The CTA is
//      "Open in portal" which deep-links into community for the
//      logged-in path.
//   2. The Add-to-Calendar menu lives in the footer (same place as
//      the modal) and works without auth — it hits the public
//      `.ics` endpoint.

import { Avatar } from '@/components/Community/Avatar'
import { calendarLinksFor } from '@/components/Community/calendarLinks'
import styles from '@/components/Community/community.module.css'
import {
  IconCalendar,
  IconClock,
  IconMapPin,
  IconPlayCircle,
  IconShare,
  IconUsers,
  IconVideo,
} from '@/components/Community/icons'
import { getPublicServerURL } from '@/utils/api'
import { useEffect, useRef, useState } from 'react'
import type { PublicEventData } from './page'

const TYPE_LABEL: Record<string, string> = {
  workshop: 'Workshop',
  office: 'Office hours',
  cohort: 'Cohort meetup',
  guest: 'Guest session',
}

type Props = {
  event: PublicEventData
  organizationSlug: string
}

export function PublicEventPage({ event, organizationSlug }: Props) {
  const [shareToast, setShareToast] = useState<string | null>(null)

  const start = new Date(event.start_at)
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

  const coverPos = event.cover_object_position || '50% 50%'
  const coverStyle: React.CSSProperties = event.cover_url
    ? {
        backgroundImage: `url(${event.cover_url})`,
        backgroundPosition: coverPos,
        backgroundSize: 'cover',
      }
    : { background: 'linear-gradient(135deg, #1f1f1f, #4a4a4a)' }

  const icsUrl = getPublicServerURL(
    `/v1/community/public/events/${event.id}/ics`,
  )
  const calLinks = calendarLinksFor(
    {
      title: event.title,
      startAt: event.start_at,
      durationMinutes: event.duration_minutes,
      description: event.description,
      location: event.location,
      // Public page deliberately doesn't expose meeting_url — but the
      // .ics endpoint includes it (the recipient already had access
      // via the email/portal flow that handed them the calendar file).
      meetingUrl: null,
    },
    icsUrl,
  )

  const portalUrl = `/${organizationSlug}/portal/community`
  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://spaire.app/${organizationSlug}/events/${event.id}`

  const onShare = async () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({ title: event.title, url: shareUrl })
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      setShareToast('Link copied')
      setTimeout(() => setShareToast(null), 2000)
    } catch {
      // User cancelled or clipboard blocked — silent.
    }
  }

  return (
    // Outer wrapper mimics the modal's `.eventIframe` interior
    // (without the faux browser chrome — this IS the real URL). We
    // pad top/bottom so the hero doesn't collide with the org header.
    <div style={{ paddingTop: 8, paddingBottom: 80 }}>
      <article
        style={{
          maxWidth: 760,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.10)',
          overflow: 'hidden',
        }}
      >
        <div className={styles.evHero}>
          <div className={styles.evHeroImg} style={coverStyle} />
          <div className={styles.evHeroGrad} />
          <div className={styles.evHeroMeta}>
            {event.live ? (
              <span className={styles.evHeroLive}>
                <span className={styles.dot} /> Live now
              </span>
            ) : event.past ? (
              <span
                className={styles.evHeroType}
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                Past
              </span>
            ) : null}
            <span className={styles.evHeroType}>
              {TYPE_LABEL[event.type] ?? event.type}
            </span>
          </div>
        </div>

        <div className={styles.evBody}>
          <div className={styles.evDatePill}>
            <IconCalendar size={11} /> {event.live ? 'Happening now' : whenDate}
          </div>
          <h1 className={styles.evTitle}>{event.title}</h1>

          <div className={styles.evRows}>
            <span className={styles.evRowIcon}>
              <IconClock size={16} />
            </span>
            <div className={styles.evRowText}>
              <strong>
                {event.live ? 'In progress' : `${whenDate} · ${whenTime}`}
              </strong>
              <div className={styles.evRowTextSub}>
                {event.duration_minutes} min · {event.course_name}
              </div>
            </div>

            <span className={styles.evRowIcon}>
              <IconMapPin size={16} />
            </span>
            <div className={styles.evRowText}>
              <strong>{event.location || 'Online'}</strong>
              {!event.past ? (
                <div className={styles.evRowTextSub}>
                  Members get the join link by email
                </div>
              ) : null}
            </div>

            <span className={styles.evRowIcon}>
              <IconUsers size={16} />
            </span>
            <div className={styles.evRowText}>
              <strong>Open to members of this course</strong>
              <div className={styles.evRowTextSub}>
                Enrol to RSVP and get reminders
              </div>
            </div>
          </div>

          <div className={styles.evSectionTitle}>Hosted by</div>
          <div className={styles.evHostCard}>
            <Avatar
              name={event.host.name}
              avatarUrl={event.host.avatar_url || undefined}
              size={44}
            />
            <div className={styles.evHostCardInfo}>
              <div className={styles.evHostCardName}>{event.host.name}</div>
              <div className={styles.evHostCardSub}>Instructor</div>
            </div>
          </div>

          <div className={styles.evSectionTitle}>About this event</div>
          <div className={styles.evDesc}>
            {event.description || 'No description yet.'}
          </div>
        </div>

        <div className={styles.evFooter}>
          <div className={styles.evFooterMeta}>
            <span>
              {event.live
                ? 'Live now'
                : event.past
                  ? 'Past event'
                  : 'Doors open 5 min before'}
            </span>
            <strong>
              {event.duration_minutes} min ·{' '}
              {TYPE_LABEL[event.type] ?? event.type}
            </strong>
          </div>
          <div
            className={styles.evFooterActions}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
          >
            <button
              type="button"
              className={`${styles.evFooterBtn} ${styles.evFooterBtnGhost}`}
              onClick={onShare}
              title="Copy share link"
            >
              <IconShare size={14} /> Share
            </button>
            <PublicCalendarMenu links={calLinks} />
            {event.past ? null : (
              <a
                href={portalUrl}
                className={`${styles.evFooterBtn} ${styles.evFooterBtnPrimary}`}
              >
                {event.live ? (
                  <>
                    <IconVideo size={14} /> Open in portal
                  </>
                ) : (
                  <>
                    <IconPlayCircle size={14} /> Open in portal
                  </>
                )}
              </a>
            )}
          </div>
        </div>
      </article>

      {shareToast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
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
          {shareToast}
        </div>
      ) : null}
    </div>
  )
}

function PublicCalendarMenu({
  links,
}: {
  links: { google: string; outlook: string; ics: string }
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (e.target instanceof Node && wrapperRef.current.contains(e.target)) {
        return
      }
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`${styles.evFooterBtn} ${styles.evFooterBtnGhost}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
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
          <CalLinkA href={links.google} label="Google Calendar" />
          <CalLinkA href={links.outlook} label="Outlook" />
          <CalLinkA href={links.ics} label="Apple Calendar (.ics)" download />
        </div>
      ) : null}
    </div>
  )
}

function CalLinkA({
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
      {...(download ? { download: '' } : {})}
      style={{
        display: 'block',
        textAlign: 'left',
        padding: '8px 12px',
        borderRadius: 8,
        textDecoration: 'none',
        fontSize: 13,
        color: 'var(--c-ink)',
      }}
    >
      {label}
    </a>
  )
}
