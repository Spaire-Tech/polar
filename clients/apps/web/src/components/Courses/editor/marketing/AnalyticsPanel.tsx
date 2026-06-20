'use client'

/**
 * Analytics — subscriber growth + email engagement, in the course editor's box
 * style. Charts are monochrome (currentColor over a soft fill) so they read on
 * the neutral editor palette and flip cleanly in dark mode. No accent colour.
 */
import {
  useBroadcastAggregateAnalytics,
  useBroadcastDailyEngagement,
  useEmailSubscriberStats,
  useSubscriberDailyGrowth,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import * as React from 'react'
import { SectionHead } from './MarketingHub'

function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}
function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US')
}

function Delta({
  value,
  unit,
  invert,
}: {
  value: number | null | undefined
  unit: 'pt' | 'pct'
  invert?: boolean
}) {
  if (value == null || value === 0) return null
  const up = value > 0
  const good = invert ? !up : up
  const label =
    unit === 'pt'
      ? `${up ? '+' : ''}${(value * 100).toFixed(1)} pt`
      : `${up ? '+' : ''}${value.toFixed(0)}%`
  return (
    <span
      className={good ? 'font-medium text-gray-700' : 'font-medium text-red-600'}
    >
      {up ? '▲' : '▼'} {label}
    </span>
  )
}

// Monochrome area chart: a line in currentColor with a soft same-colour fill
// below it. Normalised into a fixed viewBox and stretched to the container.
function AreaChart({ values, height = 160 }: { values: number[]; height?: number }) {
  const id = React.useId().replace(/:/g, '')
  const W = 600
  const H = 160
  const pad = 6
  if (values.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-gray-400"
        style={{ height }}
      >
        Not enough data yet.
      </div>
    )
  }
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2)

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
  const area =
    `${line} L${x(values.length - 1).toFixed(1)},${(H - pad).toFixed(1)} ` +
    `L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`

  return (
    <div className="mt-3 text-gray-900" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        <defs>
          <linearGradient id={`mkg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#mkg-${id})`} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function Tile({
  k,
  v,
  s,
  delta,
}: {
  k: string
  v: React.ReactNode
  s?: React.ReactNode
  delta?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {k}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        {v}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
        {s}
        {delta}
      </div>
    </div>
  )
}

function ChartCard({
  k,
  v,
  unit,
  loading,
  values,
}: {
  k: string
  v: React.ReactNode
  unit: string
  loading: boolean
  values: number[]
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {k}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
        {v}
        <span className="ml-1 text-[13px] font-normal text-gray-400">
          {unit}
        </span>
      </div>
      {loading ? (
        <div className="mt-3 h-40 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <AreaChart values={values} />
      )}
    </div>
  )
}

export function AnalyticsPanel({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const stats = useEmailSubscriberStats(organization.id)
  const agg = useBroadcastAggregateAnalytics(organization.id, {
    days: 30,
    comparePrior: true,
  })
  const growth = useSubscriberDailyGrowth(organization.id, 30)
  const engagement = useBroadcastDailyEngagement(organization.id, 30)

  const s = stats.data
  const a = agg.data

  const growthSeries = React.useMemo(() => {
    const rows = growth.data ?? []
    return rows.reduce<number[]>((acc, r) => {
      const prev = acc.length ? acc[acc.length - 1]! : 0
      acc.push(prev + r.count)
      return acc
    }, [])
  }, [growth.data])

  const openSeries = React.useMemo(
    () => (engagement.data ?? []).map((r) => r.open_rate),
    [engagement.data],
  )

  return (
    <div>
      <SectionHead
        title="Analytics"
        sub="Audience growth and email engagement over the last 30 days."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          k="Subscribers"
          v={fmtNum(s?.total)}
          s={s?.added_30d ? `+${fmtNum(s.added_30d)} in 30 days` : '30 days'}
        />
        <Tile
          k="Emails sent"
          v={fmtNum(a?.current.total_sent)}
          s="30 days"
          delta={<Delta value={a?.delta.total_sent_pct} unit="pct" />}
        />
        <Tile
          k="Open rate"
          v={pct(a?.current.open_rate)}
          s={`${fmtNum(a?.current.opened)} opens`}
          delta={<Delta value={a?.delta.open_rate_pt} unit="pt" />}
        />
        <Tile
          k="Click rate"
          v={pct(a?.current.click_rate)}
          s={`${fmtNum(a?.current.clicked)} clicks`}
          delta={<Delta value={a?.delta.click_rate_pt} unit="pt" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard
          k="Subscriber growth"
          v={`+${fmtNum(growthSeries[growthSeries.length - 1] ?? 0)}`}
          unit="new · 30 days"
          loading={growth.isLoading}
          values={growthSeries}
        />
        <ChartCard
          k="Open rate"
          v={pct(a?.current.open_rate)}
          unit="avg · 30 days"
          loading={engagement.isLoading}
          values={openSeries}
        />
      </div>

      {a && !a.current.webhook_signal_present && a.current.total_sent > 0 && (
        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-[12px] leading-relaxed text-gray-500">
          Open and click rates appear once email delivery tracking has data —
          they’ll fill in after your first sends are processed.
        </div>
      )}
    </div>
  )
}

export default AnalyticsPanel
