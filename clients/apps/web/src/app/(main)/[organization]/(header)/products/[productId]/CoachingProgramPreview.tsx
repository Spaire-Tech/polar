'use client'

import type { CoachingLandingPreview } from '@/hooks/queries/courses'

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

const fmtMonthYear = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

export function CoachingProgramPreview({
  preview,
  lessonCount,
  totalDurationSeconds,
  communityEnabled,
}: {
  preview: CoachingLandingPreview
  lessonCount: number
  totalDurationSeconds: number
  communityEnabled: boolean
}) {
  const includes = buildIncludes({
    preview,
    lessonCount,
    totalDurationSeconds,
    communityEnabled,
  })

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* What's included */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="mb-1 text-xs font-semibold tracking-wider text-gray-400 uppercase">
            What&apos;s included
          </h2>
          <p className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
            Everything in the program
          </p>
          <ul className="flex flex-col gap-3">
            {includes.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-gray-700"
              >
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cohort meta + schedule preview */}
        <div className="flex flex-col gap-6">
          {preview.cohort && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="mb-1 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Cohort
              </h2>
              <p className="text-2xl font-semibold tracking-tight text-gray-900">
                {preview.cohort.name}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                {preview.cohort.starts_at && (
                  <div>
                    <dt className="text-xs text-gray-500">Starts</dt>
                    <dd className="font-medium text-gray-900">
                      {fmtMonthYear(preview.cohort.starts_at)}
                    </dd>
                  </div>
                )}
                {preview.cohort.capacity && (
                  <div>
                    <dt className="text-xs text-gray-500">Spots</dt>
                    <dd className="font-medium text-gray-900">
                      {preview.cohort.member_count} / {preview.cohort.capacity}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-500">Members</dt>
                  <dd className="font-medium text-gray-900">
                    {preview.cohort.member_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Enrollment</dt>
                  <dd
                    className={
                      preview.cohort.enrollment_open && !preview.cohort.is_full
                        ? 'font-medium text-emerald-700'
                        : 'font-medium text-amber-700'
                    }
                  >
                    {!preview.cohort.enrollment_open
                      ? 'Closed'
                      : preview.cohort.is_full
                        ? 'Cohort full'
                        : 'Open'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {preview.upcoming_events.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="mb-1 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Upcoming live calls
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                A peek at the schedule. Members get full agendas, join links,
                and recordings inside the portal.
              </p>
              <ul className="flex flex-col gap-3">
                {preview.upcoming_events.slice(0, 5).map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-none last:pb-0"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {event.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {fmtDate(event.starts_at)} · {event.duration_minutes}{' '}
                        min
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {preview.total_events > 5 && (
                <p className="mt-3 text-xs text-gray-400">
                  + {preview.total_events - 5} more events scheduled
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <ProgramTermsBlock />
    </section>
  )
}

function buildIncludes({
  preview,
  lessonCount,
  totalDurationSeconds,
  communityEnabled,
}: {
  preview: CoachingLandingPreview
  lessonCount: number
  totalDurationSeconds: number
  communityEnabled: boolean
}): string[] {
  const out: string[] = []
  if (preview.total_events > 0) {
    out.push(
      `${preview.total_events} live group ${preview.total_events === 1 ? 'call' : 'calls'} with the coach`,
    )
  }
  if (lessonCount > 0) {
    const hours = Math.round(totalDurationSeconds / 3600)
    out.push(
      hours > 0
        ? `${lessonCount} pre-recorded lessons (~${hours} ${hours === 1 ? 'hour' : 'hours'})`
        : `${lessonCount} pre-recorded lessons`,
    )
  }
  out.push('Recordings of every live call, available in your portal')
  out.push('Calendar invites for every session (.ics)')
  if (communityEnabled) {
    out.push('Private discussion board with the cohort')
  }
  if (preview.has_intake) {
    out.push('Personal intake form so the coach can prep for you')
  }
  return out
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 flex-shrink-0 text-emerald-500"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ProgramTermsBlock() {
  return (
    <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-5 text-xs leading-relaxed text-gray-600">
      <p className="font-semibold text-gray-700">Refund &amp; access policy</p>
      <p className="mt-2">
        Full refund within 14 days of purchase, and before the program&apos;s
        second live event — whichever comes first. After that, no refund. Live
        calls are delivered as scheduled program content; the recording is
        published in your portal afterwards. Programs are sold by the creator
        on Polar, our merchant of record.
      </p>
    </div>
  )
}
