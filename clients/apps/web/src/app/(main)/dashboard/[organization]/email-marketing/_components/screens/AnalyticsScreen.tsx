import { useEmailBroadcasts } from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useState } from 'react'
import {
  DEVICES,
  ENGAGEMENT_SERIES,
  SUBSCRIBER_GROWTH,
  TOP_LINKS,
} from '../data'
import { Icon } from '../Icon'
import { MetricTile } from '../shared'

export const AnalyticsScreen = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [range, setRange] = useState<'7d' | '14d' | '30d' | '90d'>('14d')

  // Top broadcasts uses real data; Engagement / Devices / Top links are still
  // sample series until those analytics endpoints land (Phase 4).
  const broadcastsQuery = useEmailBroadcasts(organization.id, {
    status: 'sent',
    page: 1,
    limit: 50,
  })
  const sentBroadcasts = broadcastsQuery.data?.items ?? []

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
          value="142,419"
          label="Emails sent"
          delta="+12.4%"
          deltaLabel="vs prior 14d"
        />
        <MetricTile
          value="48.9%"
          label="Open rate"
          delta="+2.1pt"
          deltaLabel="vs prior 14d"
        />
        <MetricTile
          value="14.3%"
          label="Click rate"
          delta="+0.8pt"
          deltaLabel="vs prior 14d"
        />
        <MetricTile
          value="$24,182"
          label="Attributed revenue"
          delta="+18.6%"
          deltaLabel="vs prior 14d"
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
          <LineChart data={ENGAGEMENT_SERIES} />
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
              4,287
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--green)',
              }}
            >
              +131
            </span>
          </div>
          <AreaChart data={SUBSCRIBER_GROWTH} />
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
              last 14 days
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TOP_LINKS.map((l, i) => (
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
                  {l.ctr}%
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
            {DEVICES.map((d, i) => (
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
  data: { d: string; open: number; click: number }[]
}) => {
  const W = 720
  const H = 220
  const P = 24
  const xs = data.map((_, i) => P + (i / (data.length - 1)) * (W - 2 * P))
  const max = 70
  const yOpen = data.map((d) => H - P - (d.open / max) * (H - 2 * P))
  const yClick = data.map((d) => H - P - (d.click / max) * (H - 2 * P))

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
              {data[i].d}
            </text>
          ),
      )}
    </svg>
  )
}

const AreaChart = ({ data }: { data: { d: string; v: number }[] }) => {
  const W = 320
  const H = 140
  const P = 4
  const min = Math.min(...data.map((d) => d.v)) - 10
  const max = Math.max(...data.map((d) => d.v))
  const xs = data.map((_, i) => P + (i / (data.length - 1)) * (W - 2 * P))
  const ys = data.map((d) => H - P - ((d.v - min) / (max - min)) * (H - 2 * P))
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
