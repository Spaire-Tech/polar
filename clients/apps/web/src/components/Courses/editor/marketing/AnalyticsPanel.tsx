'use client'

/**
 * Analytics — subscriber growth + email engagement for the org, styled to match
 * the dashboard's chart language: a single accent line with a soft gradient
 * fill below a rising curve, minimal axes. All colours come from the hub tokens
 * (--accent, --ink, --t2/--t3) so it stays on-palette in light and dark.
 */
import {
  useBroadcastAggregateAnalytics,
  useBroadcastDailyEngagement,
  useEmailSubscriberStats,
  useSubscriberDailyGrowth,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import * as React from 'react'

function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}
function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US')
}

// Delta pill — accent for up, muted-red for down, neutral otherwise. Points
// (pt) for rates, percent (pct) for counts.
function Delta({
  value,
  unit,
  invert,
}: {
  value: number | null | undefined
  unit: 'pt' | 'pct'
  /** When true (e.g. unsub rate), a rise is bad. */
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
    <span className={`mk-delta${good ? ' up' : ' down'}`}>
      {up ? '▲' : '▼'} {label}
    </span>
  )
}

// ── Area chart: line + gradient fill, normalised into a fixed viewBox ──
function AreaChart({
  values,
  height = 168,
  format,
}: {
  values: number[]
  height?: number
  format?: (n: number) => string
}) {
  const id = React.useId().replace(/:/g, '')
  const W = 600
  const H = 180
  const pad = 8
  if (values.length < 2) {
    return (
      <div className="mk-chart-empty" style={{ height }}>
        Not enough data yet.
      </div>
    )
  }
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const x = (i: number) =>
    pad + (i / (values.length - 1)) * (W - pad * 2)
  const y = (v: number) =>
    pad + (1 - (v - min) / span) * (H - pad * 2)

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
  const area =
    `${line} L${x(values.length - 1).toFixed(1)},${(H - pad).toFixed(1)} ` +
    `L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`

  const last = values[values.length - 1]
  return (
    <div className="mk-chart" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        <defs>
          <linearGradient id={`mkg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#mkg-${id})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {format && (
        <div className="mk-chart-last">{format(last)}</div>
      )}
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
    <div className="card mk-tile">
      <div className="mk-tile-k">{k}</div>
      <div className="mk-tile-v">{v}</div>
      <div className="mk-tile-s">
        {s}
        {delta}
      </div>
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

  // Cumulative net-new subscribers across the window → a rising curve.
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
      <div className="mk-head">
        <div>
          <div className="mk-h">Analytics</div>
          <div className="mk-sub">
            Audience growth and email engagement over the last 30 days.
          </div>
        </div>
      </div>

      <div className="mk-tiles mk-tiles-4">
        <Tile
          k="Subscribers"
          v={fmtNum(s?.total)}
          s={
            s?.added_30d
              ? `+${fmtNum(s.added_30d)} in 30 days`
              : 'No change in 30 days'
          }
        />
        <Tile
          k="Emails sent"
          v={fmtNum(a?.current.total_sent)}
          s="last 30 days"
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

      <div className="card mk-chart-card">
        <div className="mk-chart-head">
          <div>
            <div className="mk-chart-k">Subscriber growth</div>
            <div className="mk-chart-v">
              +{fmtNum(growthSeries[growthSeries.length - 1] ?? 0)}
              <span className="mk-chart-u"> new · 30 days</span>
            </div>
          </div>
        </div>
        {growth.isLoading ? (
          <div className="mk-chart-empty" style={{ height: 168 }}>
            Loading…
          </div>
        ) : (
          <AreaChart values={growthSeries} />
        )}
      </div>

      <div className="card mk-chart-card">
        <div className="mk-chart-head">
          <div>
            <div className="mk-chart-k">Open rate</div>
            <div className="mk-chart-v">
              {pct(a?.current.open_rate)}
              <span className="mk-chart-u"> avg · 30 days</span>
            </div>
          </div>
        </div>
        {engagement.isLoading ? (
          <div className="mk-chart-empty" style={{ height: 168 }}>
            Loading…
          </div>
        ) : (
          <AreaChart
            values={openSeries}
            format={(n) => `${(n * 100).toFixed(0)}%`}
          />
        )}
      </div>

      {a && !a.current.webhook_signal_present && a.current.total_sent > 0 && (
        <div className="mk-note">
          Open and click rates appear once email delivery tracking has data —
          they’ll fill in after your first sends are processed.
        </div>
      )}
    </div>
  )
}

export default AnalyticsPanel
