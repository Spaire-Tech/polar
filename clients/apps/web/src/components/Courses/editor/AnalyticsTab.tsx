'use client'

import { MetricGroup } from '@/app/(main)/dashboard/[organization]/(header)/analytics/metrics/components/MetricGroup'
import {
  getMetricsForType,
  MetricType,
} from '@/app/(main)/dashboard/[organization]/(header)/analytics/metrics/components/metrics-config'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import { CourseRead } from '@/hooks/queries/courses'
import { useMetrics } from '@/hooks/queries/metrics'
import { useProduct } from '@/hooks/queries/products'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { subMonths } from 'date-fns'
import { useMemo, useState } from 'react'

// The course editor's analytics surface reuses the SAME rich metric charts as
// the dashboard (MetricGroup -> MetricChartBox -> recharts), scoped to this
// course's underlying product and recolored to the editor accent
// (--color-ce-accent) instead of the dashboard purple.
const CE_ACCENT = '#0066cc'

export function AnalyticsTab({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: CourseRead
}) {
  // A course is a 1:1 wrapper over a product; recurring vs one-time drives
  // which metric groups are relevant (matches the dashboard's logic).
  const { data: product } = useProduct(course.product_id)
  const hasRecurringProducts = !!product?.is_recurring
  const hasOneTimeProducts = product ? !product.is_recurring : true

  const types = useMemo<{ id: MetricType; label: string }[]>(() => {
    const t: { id: MetricType; label: string }[] = []
    if (hasRecurringProducts)
      t.push({ id: 'subscriptions', label: 'Subscriptions' })
    if (hasOneTimeProducts) t.push({ id: 'one-time', label: 'One-time' })
    t.push({ id: 'orders', label: 'Orders' })
    t.push({ id: 'checkouts', label: 'Checkouts' })
    t.push({ id: 'net-revenue', label: 'Net Revenue' })
    return t
  }, [hasRecurringProducts, hasOneTimeProducts])

  const [type, setType] = useState<MetricType>('orders')
  const activeType = types.some((t) => t.id === type)
    ? type
    : (types[0]?.id ?? 'orders')

  const [interval, setInterval] = useState<schemas['TimeInterval']>('day')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => ({
    from: subMonths(new Date(), 1),
    to: new Date(),
  }))

  const onDateChange = (range: { from: Date; to: Date }) => {
    setInterval((prev) => getNextValidInterval(prev, range.from, range.to))
    setDateRange(range)
  }

  const metricKeys = useMemo(
    () =>
      getMetricsForType(activeType, {
        hasRecurringProducts,
        hasOneTimeProducts,
      }),
    [activeType, hasRecurringProducts, hasOneTimeProducts],
  )

  const { data } = useMetrics({
    startDate: dateRange.from,
    endDate: dateRange.to,
    interval,
    organization_id: organization.id,
    product_id: [course.product_id],
    metrics: metricKeys,
  })

  const minDate = useMemo(
    () => new Date(course.created_at),
    [course.created_at],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Analytics</h1>
          <p className="mt-1 text-gray-500">
            Revenue, orders and subscriptions for this course.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <IntervalPicker
            interval={interval}
            onChange={setInterval}
            startDate={dateRange.from}
            endDate={dateRange.to}
          />
          <DateRangePicker
            date={dateRange}
            onDateChange={onDateChange}
            minDate={minDate}
          />
        </div>
      </div>

      {/* Metric-type tabs — mirror the editor's underline tab pattern */}
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-gray-200">
        {types.map((t) => {
          const active = t.id === activeType
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-[13px] tracking-tight transition-colors',
                active
                  ? 'border-ce-accent text-ce-accent font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-900',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {data ? (
        <MetricGroup
          data={data}
          metricKeys={metricKeys}
          interval={interval}
          color={CE_ACCENT}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metricKeys.map((k) => (
            <div
              key={k}
              className="h-[260px] animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      )}
    </div>
  )
}
