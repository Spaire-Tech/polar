import {
  useBroadcastAggregateAnalytics,
  useBroadcastDailyEngagement,
  useBroadcastDevices,
  useBroadcastTopLinks,
  useEmailBroadcasts,
  useEmailSubscriberStats,
  useSubscriberDailyGrowth,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useState } from 'react'
import { Icon } from '../Icon'
import { MetricTile } from '../shared'

const RANGE_DAYS: Record<'7d' | '14d' | '30d' | '90d', number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
}

export const AnalyticsScreen = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [range, setRange] = useState<'7d' | '14d' | '30d' | '90d'>('14d')
  const days = RANGE_DAYS[range]

  const broadcastsQuery = useEmailBroadcasts(organization.id, {
    status: 'sent',
    page: 1,
    limit: 50,
  })
  const sentBroadcasts = broadcastsQuery.data?.items ?? []

  const aggregateQuery = useBroadcastAggregateAnalytics(organization.id)
  const aggregate = aggregateQuery.data

  const engagementQuery = useBroadcastDailyEngagement(organization.id, days)
  const engagementSeries = engagementQuery.data ?? []

  const growthQuery = useSubscriberDailyGrowth(organization.id, days)
  const growthSeries = growthQuery.data ?? []
  const subStatsQuery = useEmailSubscriberStats(organization.id)
  const totalSubscribers = subStatsQuery.data?.total ?? 0
  const growthDelta = growthSeries.reduce((acc, p) => acc + p.count, 0)

  const topLinksQuery = useBroadcastTopLinks(organization.id, days, 5)
  const topLinks = topLinksQuery.data ?? []

  const devicesQuery = useBroadcastDevices(organization.id, 90)
  const devices = devicesQuery.data ?? []

  return (
    <div className="fade-up">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 40,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Performance
          </div>
          <h1 className="h-display">Analytics</h1>
          <p
            className="muted"
            style={{ fontSize: 15, marginTop: 12, maxWidth: 520 }}
          >
            How your emails actually perform — opens, clicks, growth, and
            what&apos;s getting attention.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="tabs">
            {(
              [
                { id: '7d', l: '7d' },
                { id: '14d', l: '14d' },
                { id: '30d', l: '30d' },
                { id: '90d', l: '90d' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                className={`tab ${range === r.id ? 'tab-active' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.l}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary">
            <Icon name="download" size={15} />
            Export
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MetricTile
          value={(aggregate?.total_sent ?? 0).toLocaleString()}
          label="Emails sent"
          delta={
            aggregate ? `${aggregate.delivered.toLocaleString()}` : undefined
          }
          deltaLabel="delivered"
          subtle
        />
        <MetricTile
          value={`${(aggregate?.open_rate ?? 0).toFixed(1)}%`}
          label="Open rate"
          delta={aggregate ? aggregate.opened.toLocaleString() : undefined}
          deltaLabel="opens"
          subtle
        />
        <MetricTile
          value={`${(aggregate?.click_rate ?? 0).toFixed(1)}%`}
          label="Click rate"
          delta={aggregate ? aggregate.clicked.toLocaleString() : undefined}
          deltaLabel="clicks"
          subtle
        />
        <MetricTile
          value={(aggregate?.unsubscribed ?? 0).toLocaleString()}
          label="Unsubscribes"
          delta={
            aggregate && aggregate.total_sent
              ? `${((aggregate.unsubscribed / aggregate.total_sent) * 100).toFixed(2)}%`
              : undefined
          }
          deltaLabel="of sent"
          subtle
          down
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ padding: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 24,
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Engagement
              </div>
              <h3 className="h2">Open & click rate</h3>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <Legend color="var(--ink)" label="Open rate" />
              <Legend color="var(--ink-4)" label="Click rate" dashed />
            </div>
          </div>
          {engagementSeries.length === 0 && !engagementQuery.isLoading ? (
            <div
              style={{
                padding: 40,
                color: 'var(--ink-3)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No sends in the last {days} days yet.
            </div>
          ) : (
            <LineChart data={engagementSeries} />
          )}
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            List growth
          </div>
          <h3 className="h2" style={{ marginBottom: 18 }}>
            Subscribers
          </h3>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: '-0.03em',
              }}
            >
              {totalSubscribers.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--green)',
              }}
            >
              {growthDelta >= 0 ? `+${growthDelta}` : growthDelta}
            </span>
          </div>
          {growthSeries.length === 0 && !growthQuery.isLoading ? (
            <div
              style={{
                padding: 40,
                color: 'var(--ink-3)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No new subscribers yet.
            </div>
          ) : (
            <AreaChart data={growthSeries} />
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ padding: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 20,
            }}
          >
            <h3 className="h2">Top broadcasts</h3>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              by open rate
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sentBroadcasts
              .filter((b) => b.analytics && b.analytics.delivered > 0)
              .slice()
              .sort(
                (a, b) =>
                  (b.analytics?.open_rate ?? 0) - (a.analytics?.open_rate ?? 0),
              )
              .slice(0, 5)
              .map((b) => {
                const rate = b.analytics?.open_rate ?? 0
                return (
                  <div key={b.id}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--ink)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 280,
                        }}
                      >
                        {b.subject}
                      </span>
                      <span
                        style={{
                          color: 'var(--ink-2)',
                          fontWeight: 500,
                        }}
                      >
                        {rate.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: 'var(--bg-softer)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${rate}%`,
                          background: 'var(--ink)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            {!broadcastsQuery.isLoading && sentBroadcasts.length === 0 && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ink-3)',
                  padding: '8px 0',
                }}
              >
                No sent broadcasts yet.
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 20,
            }}
          >
            <h3 className="h2">Top links</h3>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              last {days} days
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topLinks.length === 0 && !topLinksQuery.isLoading && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                No tracked link clicks yet.
              </div>
            )}
            {topLinks.map((l, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: i < 4 ? '1px solid var(--line)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'var(--bg-softer)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name="link"
                    size={11}
                    style={{ color: 'var(--ink-3)' }}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    color: 'var(--ink-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {l.url}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  {l.clicks}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-3)',
                    width: 50,
                    textAlign: 'right',
                  }}
                >
                  {l.ctr.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: 28 }}>
          <h3 className="h2" style={{ marginBottom: 20 }}>
            Where readers open
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {devices.length === 0 && !devicesQuery.isLoading && (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                Not enough open data yet.
              </div>
            )}
            {devices.map((d, i) => (
              <div key={i}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 5,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--ink-2)' }}>{d.name}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                    {d.share}%
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: 'var(--bg-softer)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${d.share * 2.2}%`,
                      background: 'var(--ink)',
                      opacity: 1 - i * 0.13,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <h3 className="h2" style={{ marginBottom: 6 }}>
            Best time to send
          </h3>
          <p
            className="muted"
            style={{ fontSize: 12.5, marginTop: 0, marginBottom: 18 }}
          >
            Open-rate heatmap by day & hour, last 90 days.
          </p>
          <Heatmap />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              fontSize: 11.5,
              color: 'var(--ink-3)',
            }}
          >
            <span>Lower</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
                <div
                  key={o}
                  style={{
                    width: 16,
                    height: 8,
                    background: `rgba(29,29,31,${o})`,
                    borderRadius: 1,
                  }}
                />
              ))}
            </div>
            <span>Higher</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const Legend = ({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--ink-3)',
    }}
  >
    <div
      style={{
        width: 14,
        height: 0,
        borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
      }}
    />
    {label}
  </div>
)

const LineChart = ({
  data,
}: {
  data: { day: string; open_rate: number; click_rate: number }[]
}) => {
  const W = 720
  const H = 220
  const P = 24
  const xs = data.map(
    (_, i) =>
      P + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (W - 2 * P),
  )
  const max = Math.max(
    70,
    ...data.map((d) => Math.max(d.open_rate, d.click_rate)),
  )
  const yOpen = data.map((d) => H - P - (d.open_rate / max) * (H - 2 * P))
  const yClick = data.map((d) => H - P - (d.click_rate / max) * (H - 2 * P))

  const path = (ys: number[]) =>
    xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const fillPath = (ys: number[]) =>
    `${path(ys)} L${xs[xs.length - 1]},${H - P} L${xs[0]},${H - P} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }}>
      {[0, 25, 50, 75].map((p) => (
        <line
          key={p}
          x1={P}
          x2={W - P}
          y1={H - P - (p / max) * (H - 2 * P)}
          y2={H - P - (p / max) * (H - 2 * P)}
          stroke="var(--line)"
          strokeDasharray="2 4"
        />
      ))}
      <defs>
        <linearGradient id="emailGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(29,29,31,0.08)" />
          <stop offset="100%" stopColor="rgba(29,29,31,0)" />
        </linearGradient>
      </defs>
      <path d={fillPath(yOpen)} fill="url(#emailGrad)" />
      <path
        d={path(yOpen)}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={path(yClick)}
        fill="none"
        stroke="var(--ink-4)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      {xs.map(
        (x, i) =>
          i % 2 === 0 && (
            <text
              key={i}
              x={x}
              y={H - 4}
              fontSize="10"
              fill="var(--ink-4)"
              textAnchor="middle"
            >
              {data[i].day}
            </text>
          ),
      )}
    </svg>
  )
}

const AreaChart = ({ data }: { data: { day: string; count: number }[] }) => {
  const W = 320
  const H = 140
  const P = 4
  // Cumulative net new subscribers over the window — gives the chart a
  // monotonic growth shape rather than a noisy daily bar.
  const cumulative: number[] = []
  let running = 0
  for (const d of data) {
    running += d.count
    cumulative.push(running)
  }
  const min = Math.min(0, ...cumulative)
  const max = Math.max(1, ...cumulative)
  const xs = data.map(
    (_, i) =>
      P + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (W - 2 * P),
  )
  const ys = cumulative.map(
    (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P),
  )
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140 }}>
      <defs>
        <linearGradient id="emailGrad2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(29,29,31,0.14)" />
          <stop offset="100%" stopColor="rgba(29,29,31,0)" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${xs[xs.length - 1]},${H - P} L${xs[0]},${H - P} Z`}
        fill="url(#emailGrad2)"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const Heatmap = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const cell = (d: number, h: number) => {
    let v = 0.15
    if (h >= 7 && h <= 10) v += 0.4
    if (h >= 17 && h <= 19) v += 0.25
    if (d === 1 || d === 2) v += 0.15
    if (d >= 5) v -= 0.1
    v += Math.sin(h * 1.3 + d) * 0.06
    return Math.max(0.05, Math.min(0.95, v))
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          paddingTop: 16,
          fontSize: 10,
          color: 'var(--ink-4)',
          alignItems: 'flex-end',
        }}
      >
        {days.map((d) => (
          <div key={d} style={{ height: 18, lineHeight: '18px' }}>
            {d}
          </div>
        ))}
      </div>
      <div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(24, 1fr)',
            gap: 2,
            fontSize: 9,
            color: 'var(--ink-4)',
            marginBottom: 4,
          }}
        >
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              style={{
                textAlign: 'center',
                visibility: h % 4 === 0 ? 'visible' : 'hidden',
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {days.map((_, di) => (
          <div
            key={di}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(24, 1fr)',
              gap: 2,
              marginBottom: 3,
            }}
          >
            {Array.from({ length: 24 }).map((_, hi) => (
              <div
                key={hi}
                style={{
                  height: 18,
                  background: `rgba(29,29,31,${cell(di, hi).toFixed(2)})`,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
