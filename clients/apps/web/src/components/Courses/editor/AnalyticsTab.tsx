'use client'

import { CourseRead } from '@/hooks/queries/courses'
import { useMetrics } from '@/hooks/queries/metrics'
import {
  ChartRange,
  getChartRangeParams,
  getFormattedMetricValue,
  getTimestampFormatter,
} from '@/utils/metrics'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useMemo, useState } from 'react'

// Single source of truth for the editor's analytics surface. Mirrors the
// CourseHeader tab pattern + the `--*-ce-*` tokens so it inherits the course
// editor look automatically — NOT the dashboard analytics design.

// KPI cards shown at the top. Display name + value formatting both come from
// the metrics API itself, so the labels stay in lock-step with the backend.
const KPI_SLUGS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'average_order_value',
  'active_subscriptions',
  'monthly_recurring_revenue',
  'checkouts_conversion',
]

// Metrics offered in the chart switcher.
const CHART_SLUGS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'active_subscriptions',
]

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '30d', label: '30d' },
  { id: '3m', label: '3m' },
  { id: '12m', label: '12m' },
  { id: 'all_time', label: 'All' },
]

export function AnalyticsTab({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: CourseRead
}) {
  const [range, setRange] = useState<ChartRange>('30d')
  const [chartSlug, setChartSlug] =
    useState<keyof schemas['Metrics']>('revenue')

  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams(range, course.created_at),
    [range, course.created_at],
  )

  const { data, isLoading } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    product_id: [course.product_id],
  })

  const tsFormatter = getTimestampFormatter(interval)

  const chartMetric = data?.metrics?.[chartSlug]
  const chartMax = useMemo(() => {
    if (!data) return 0
    return data.periods.reduce(
      (max, p) => Math.max(max, (p[chartSlug] as number) ?? 0),
      0,
    )
  }, [data, chartSlug])

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Analytics</h1>
          <p className="mt-1 text-gray-500">
            Revenue, orders and subscriptions for this course.
          </p>
        </div>
        <SegmentedControl options={RANGES} value={range} onChange={setRange} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {KPI_SLUGS.map((slug) => {
          const metric = data?.metrics?.[slug]
          const total = data?.totals?.[slug]
          return (
            <div
              key={slug}
              className="rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="text-[13px] tracking-tight text-gray-500">
                {metric?.display_name ?? '—'}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                {isLoading || !metric || total == null
                  ? '—'
                  : getFormattedMetricValue(metric, total as number)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="text-[13px] font-medium tracking-tight text-gray-900">
            {chartMetric?.display_name ?? 'Over time'}
          </span>
          <SegmentedControl
            options={CHART_SLUGS.map((slug) => ({
              id: slug,
              label: data?.metrics?.[slug]?.display_name ?? slug,
            }))}
            value={chartSlug}
            onChange={setChartSlug}
          />
        </div>

        {isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ) : !data || data.periods.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-500">
            No data for this period yet.
          </div>
        ) : (
          <div>
            <div className="flex h-48 items-end gap-1">
              {data.periods.map((p, i) => {
                const value = (p[chartSlug] as number) ?? 0
                const height = chartMax > 0 ? (value / chartMax) * 100 : 0
                const formatted = chartMetric
                  ? getFormattedMetricValue(chartMetric, value)
                  : String(value)
                return (
                  <div
                    key={i}
                    className="group relative flex flex-1 items-end"
                    style={{ height: '100%' }}
                  >
                    <div
                      className="bg-ce-accent w-full rounded-t-[3px] transition-[height] group-hover:brightness-110"
                      style={{
                        height: `${Math.max(height, value > 0 ? 2 : 0)}%`,
                      }}
                    />
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {formatted}
                      <span className="ml-1 text-gray-400">
                        {tsFormatter(p.timestamp)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
              <span>{tsFormatter(data.periods[0].timestamp)}</span>
              <span>
                {tsFormatter(data.periods[data.periods.length - 1].timestamp)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="rounded-ce-pill inline-flex items-center gap-0.5 border border-gray-200 bg-white p-0.5">
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-ce-pill px-3 py-1 text-[13px] tracking-tight transition-colors',
              active
                ? 'bg-ce-accent font-medium text-white'
                : 'text-gray-500 hover:text-gray-900',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
