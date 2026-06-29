'use client'

// AnalyticsTab — course-scoped analytics, styled in the course-editor design
// language (the single source of truth: white rounded-2xl cards, text-lg
// medium headings, `ce-accent` token). Pulls REAL metrics for the course's
// linked product via the shared /v1/metrics endpoint, plus the course's own
// enrolment count.

import { CourseRead, useCourseEnrollments } from '@/hooks/queries/courses'
import { useMetrics } from '@/hooks/queries/metrics'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import { useMemo, useState } from 'react'

type RangeKey = '7d' | '30d' | '12mo'

const RANGES: {
  key: RangeKey
  label: string
  days: number
  interval: schemas['TimeInterval']
}[] = [
  { key: '7d', label: '7 days', days: 7, interval: 'day' },
  { key: '30d', label: '30 days', days: 30, interval: 'day' },
  { key: '12mo', label: '12 months', days: 365, interval: 'month' },
]

// Mirror the codebase metric-formatting convention (see MiniMetricChartBox):
// scalar metrics get a human-friendly integer, everything else is currency.
function fmtMetric(
  metric: schemas['Metric'] | null | undefined,
  value: number | null | undefined,
): string {
  if (!metric) return '—'
  return metric.type === 'scalar'
    ? formatHumanFriendlyScalar(value ?? 0)
    : formatCurrency('statistics')(value ?? 0, 'usd')
}

export function AnalyticsTab({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: CourseRead
}) {
  const [range, setRange] = useState<RangeKey>('30d')
  const cfg = RANGES.find((r) => r.key === range) ?? RANGES[1]

  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - cfg.days)
    return { startDate: start, endDate: end }
  }, [cfg.days])

  const { data: metrics, isLoading } = useMetrics({
    startDate,
    endDate,
    interval: cfg.interval,
    organization_id: organization.id,
    product_id: [course.product_id],
  })

  const { data: enrollments } = useCourseEnrollments(course.id)
  const enrolled = enrollments?.pagination.total_count ?? 0

  const cards = [
    {
      title: 'Revenue',
      metric: metrics?.metrics.revenue,
      value: metrics?.totals.revenue,
    },
    {
      title: 'Orders',
      metric: metrics?.metrics.orders,
      value: metrics?.totals.orders,
    },
    {
      title: 'Average order value',
      metric: metrics?.metrics.average_order_value,
      value: metrics?.totals.average_order_value,
    },
  ]

  const series = metrics?.periods ?? []
  const maxRevenue = Math.max(1, ...series.map((p) => p.revenue ?? 0))

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Analytics</h1>
          <p className="mt-1 text-gray-500">
            Revenue, orders and enrolment for this course.
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-0.5 rounded-full border border-gray-200 bg-white p-[3px]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === r.key
                  ? 'bg-ce-accent text-ce-accent-contrast'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
              {c.title}
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {isLoading ? (
                <span className="inline-block h-7 w-20 animate-pulse rounded bg-gray-100" />
              ) : (
                fmtMetric(c.metric, c.value)
              )}
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Enrolled students
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatHumanFriendlyScalar(enrolled)}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Revenue over time
          </h2>
          <span className="text-xs text-gray-400">{cfg.label}</span>
        </div>
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
        ) : series.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No data for this period yet.
          </div>
        ) : (
          <div className="flex h-40 items-end gap-[3px]">
            {series.map((p, i) => {
              const v = p.revenue ?? 0
              const h = Math.max(2, Math.round((v / maxRevenue) * 100))
              return (
                <div key={i} className="group relative h-full flex-1">
                  <div
                    className="bg-ce-accent/80 group-hover:bg-ce-accent absolute bottom-0 w-full rounded-t transition-colors"
                    style={{ height: `${h}%` }}
                  />
                  <div className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
                    {formatCurrency('compact')(v, 'usd')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
