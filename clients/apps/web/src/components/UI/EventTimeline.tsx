'use client'

import { twMerge } from 'tailwind-merge'

export interface TimelineEvent {
  id: string
  type: string
  description: string
  timestamp: Date
  actor?: string
  metadata?: Record<string, string>
}

interface TimelineEventRowProps {
  event: TimelineEvent
  isLast?: boolean
}

const TimelineEventRow = ({ event, isLast }: TimelineEventRowProps) => {
  const relativeTime = formatRelativeTime(event.timestamp)

  return (
    <div className="relative flex gap-4 pb-6">
      {/* Vertical line */}
      {!isLast && (
        <div className="dark:bg-spaire-800 absolute top-5 left-[9px] h-full w-px bg-gray-200" />
      )}

      {/* Event marker dot */}
      <div className="dark:border-spaire-700 relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white dark:bg-spaire-900">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      </div>

      {/* Event content */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-900 dark:text-white">
              {event.description}
            </span>
            {event.actor && (
              <span className="dark:text-spaire-500 text-xs text-gray-400">
                by {event.actor}
              </span>
            )}
          </div>
          <time
            dateTime={event.timestamp.toISOString()}
            title={event.timestamp.toLocaleString()}
            className="dark:text-spaire-500 shrink-0 text-xs text-gray-400"
          >
            {relativeTime}
          </time>
        </div>

        {/* Expandable metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="dark:bg-spaire-950 dark:border-spaire-800 mt-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
            {Object.entries(event.metadata).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 py-0.5">
                <span className="dark:text-spaire-500 w-32 shrink-0 text-xs text-gray-400">
                  {key}
                </span>
                <span className="min-w-0 truncate text-xs text-gray-700 dark:text-spaire-300 font-mono">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface EventTimelineProps {
  events: TimelineEvent[]
  loading?: boolean
  emptyMessage?: string
  className?: string
}

/**
 * Chronological activity feed for resource detail pages.
 * Left vertical line + circular event markers + expandable metadata.
 */
export const EventTimeline = ({
  events,
  loading = false,
  emptyMessage = 'No events yet.',
  className,
}: EventTimelineProps) => {
  if (loading) {
    return (
      <div className={twMerge('flex flex-col gap-4', className)}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="dark:bg-spaire-800 h-5 w-5 shrink-0 animate-pulse rounded-full bg-gray-200" />
            <div className="flex flex-1 flex-col gap-2 pt-0.5">
              <div className="dark:bg-spaire-800 h-3 w-48 animate-pulse rounded bg-gray-200" />
              <div className="dark:bg-spaire-800 h-2.5 w-24 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <p className="dark:text-spaire-500 py-4 text-sm text-gray-400">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className={twMerge('flex flex-col', className)}>
      {events.map((event, index) => (
        <TimelineEventRow
          key={event.id}
          event={event}
          isLast={index === events.length - 1}
        />
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()

  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
