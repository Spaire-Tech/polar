'use client'

import {
  CustomerCoachingEvent,
  icsDownloadUrl,
  useCustomerCoachingEvents,
} from '@/hooks/queries/customerPortalCoaching'
import { useMemo } from 'react'

const FONT = "'Poppins', var(--font-poppins), system-ui, sans-serif"

const C = {
  bg: '#ffffff',
  bg2: 'oklch(0.975 0.002 280)',
  line: 'oklch(0.92 0.003 280)',
  fg0: 'oklch(0.18 0.008 280)',
  fg1: 'oklch(0.32 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  accent: 'oklch(0.55 0.20 265)',
}

const fmtFull = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

function joinWindowOpen(starts_at: string, duration_minutes: number): boolean {
  const start = new Date(starts_at).getTime()
  const end = start + duration_minutes * 60_000
  const now = Date.now()
  // 10 minutes before the start, until the scheduled end.
  return now >= start - 10 * 60_000 && now <= end
}

export function CoachingSchedule({ courseId }: { courseId: string }) {
  const { data, isLoading, error } = useCustomerCoachingEvents(courseId)

  const upcoming = useMemo(
    () =>
      (data?.events ?? [])
        .filter((e) => !e.is_past)
        .sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
    [data],
  )
  const past = useMemo(
    () =>
      (data?.events ?? [])
        .filter((e) => e.is_past)
        .sort(
          (a, b) =>
            new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
        ),
    [data],
  )

  if (isLoading) {
    return (
      <section
        style={{
          maxWidth: 1320,
          margin: '0 auto 16px',
          padding: '0 32px',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            height: 96,
            background: C.bg2,
            borderRadius: 20,
          }}
        />
      </section>
    )
  }

  if (error || !data || data.events.length === 0) return null

  return (
    <section
      style={{
        maxWidth: 1320,
        margin: '0 auto 16px',
        padding: '0 32px',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.line}`,
          borderRadius: 24,
          padding: 24,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: C.fg0,
            }}
          >
            Schedule
          </h2>
          <span style={{ fontSize: 12, color: C.fg3 }}>
            Live group calls included with your program
          </span>
        </header>

        {upcoming.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map((event) => (
              <UpcomingRow
                key={event.id}
                event={event}
                courseId={courseId}
              />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: C.fg2,
              }}
            >
              Past events ({past.length})
            </summary>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginTop: 12,
              }}
            >
              {past.map((event) => (
                <PastRow key={event.id} event={event} courseId={courseId} />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  )
}

function UpcomingRow({
  event,
  courseId,
}: {
  event: CustomerCoachingEvent
  courseId: string
}) {
  const canJoin =
    !!event.meeting_url && joinWindowOpen(event.starts_at, event.duration_minutes)
  const cancelled = event.status === 'cancelled'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: C.bg2,
        borderRadius: 14,
        opacity: cancelled ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg0 }}>
          {event.title}
          {cancelled && (
            <span style={{ marginLeft: 8, fontSize: 11, color: C.fg3 }}>
              (cancelled)
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.fg2 }}>
          {fmtFull(event.starts_at)} · {event.duration_minutes} min
          {event.meeting_provider ? ` · ${event.meeting_provider}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a
          href={icsDownloadUrl(courseId, event.id)}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: C.fg1,
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${C.line}`,
            background: C.bg,
            textDecoration: 'none',
          }}
        >
          Add to calendar
        </a>
        {event.meeting_url && !cancelled && (
          <a
            href={event.meeting_url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 999,
              background: canJoin ? C.accent : C.fg3,
              textDecoration: 'none',
              pointerEvents: canJoin ? 'auto' : 'none',
            }}
          >
            {canJoin ? 'Join now' : 'Join'}
          </a>
        )}
      </div>
    </div>
  )
}

function PastRow({
  event,
  courseId,
}: {
  event: CustomerCoachingEvent
  courseId: string
}) {
  const recording = event.recording?.playback_id
    ? `https://stream.mux.com/${event.recording.playback_id}.m3u8`
    : null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: C.fg1 }}>{event.title}</span>
        <span style={{ fontSize: 11, color: C.fg3 }}>
          {fmtFull(event.starts_at)}
        </span>
      </div>
      {recording ? (
        <a
          href={recording}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: C.accent,
            textDecoration: 'none',
          }}
        >
          Watch recording
        </a>
      ) : (
        <span style={{ fontSize: 11, color: C.fg3 }}>
          {event.recording?.status === 'uploading'
            ? 'Recording processing…'
            : 'No recording'}
        </span>
      )}
    </div>
  )
}
