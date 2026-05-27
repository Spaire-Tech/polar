'use client'

// Community v5 — event detail framed in a faux browser chrome.
// Traffic lights + URL bar (community.<host>/events/<slug>), then a
// cover-image hero, date/time/location/attendees rows, host card,
// description, and a sticky footer with the right CTA depending on
// state (RSVP / Join live / Watch replay).
//
// Per spec the 'Run of show' agenda is NOT included — events backend
// doesn't model an agenda.

import { useEffect } from 'react'
import { Avatar } from './Avatar'
import type { CommunityEvent } from './EventsView'
import styles from './community.module.css'
import {
  IconBookmark,
  IconCalendar,
  IconChat,
  IconClock,
  IconMapPin,
  IconPlayCircle,
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
  onClose: () => void
  onToggleGoing: () => void
}

export function EventDetailModal({ event, onClose, onToggleGoing }: Props) {
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
  const slug =
    event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 38) || 'event'

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
            community.spaire.app/events/
            <span className={styles.path}>{slug}</span>
          </div>
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
              <button
                type="button"
                className={`${styles.evFooterBtn} ${styles.evFooterBtnPrimary}`}
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Silence unused-import helper.
const _ = IconChat
