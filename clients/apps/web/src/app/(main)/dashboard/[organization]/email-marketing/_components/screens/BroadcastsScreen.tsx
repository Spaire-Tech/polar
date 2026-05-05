import { useState } from 'react'
import { Broadcast, BROADCASTS } from '../data'
import { Icon } from '../Icon'
import { MetricTile, Stat } from '../shared'

const FILTERS = ['All', 'Sent', 'Scheduled', 'Drafts'] as const
type Filter = (typeof FILTERS)[number]

export const BroadcastsScreen = ({ onNew }: { onNew: () => void }) => {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const list = BROADCASTS.filter((b) => {
    const matches = !query || b.name.toLowerCase().includes(query.toLowerCase())
    const f =
      filter === 'All' ||
      (filter === 'Sent' && b.status === 'sent') ||
      (filter === 'Scheduled' && b.status === 'scheduled') ||
      (filter === 'Drafts' && b.status === 'draft')
    return matches && f
  })

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
            One-time campaigns
          </div>
          <h1 className="h-display">Broadcasts</h1>
          <p
            className="muted"
            style={{ fontSize: 15, marginTop: 12, maxWidth: 520 }}
          >
            Send a single email to your whole audience or any segment. Compose,
            preview, and schedule.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary">
            <Icon name="calendar" size={15} />
            Schedule
          </button>
          <button className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" size={15} />
            New broadcast
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 56,
        }}
      >
        <MetricTile
          value="142,419"
          label="Emails sent"
          delta="+12.4%"
          deltaLabel="last 30 days"
        />
        <MetricTile
          value="48.9%"
          label="Avg. open rate"
          delta="+2.1pt"
          deltaLabel="vs industry 21%"
        />
        <MetricTile
          value="14.3%"
          label="Avg. click rate"
          delta="+0.8pt"
          deltaLabel="vs last month"
        />
        <MetricTile
          value="0.18%"
          label="Avg. unsub rate"
          delta="−0.03pt"
          deltaLabel="vs last month"
          down
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon
            name="search"
            size={16}
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-4)',
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 42, height: 44 }}
            placeholder="Search broadcasts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`tab ${filter === f ? 'tab-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map((b) => (
          <BroadcastRow key={b.id} b={b} />
        ))}
      </div>
    </div>
  )
}

const BroadcastRow = ({ b }: { b: Broadcast }) => {
  const openRate =
    b.opens != null ? ((b.opens / b.recipients) * 100).toFixed(1) : null
  const clickRate =
    b.clicks != null ? ((b.clicks / b.recipients) * 100).toFixed(1) : null

  return (
    <div
      className="card"
      style={{
        padding: 24,
        display: 'grid',
        gridTemplateColumns: '1fr 200px 120px 120px 120px 40px',
        gap: 24,
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--line-2)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--line)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          {b.status === 'sent' && (
            <span className="chip chip-success">
              <Icon name="check" size={11} />
              Sent
            </span>
          )}
          {b.status === 'scheduled' && (
            <span className="chip chip-info">
              <Icon name="clock" size={11} />
              Scheduled
            </span>
          )}
          {b.status === 'draft' && (
            <span className="chip">
              <Icon name="edit" size={11} />
              Draft
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {b.name}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {b.sentAt}
        </div>
      </div>
      <Stat
        label="Recipients"
        value={b.recipients ? b.recipients.toLocaleString() : '—'}
      />
      <Stat
        label="Opens"
        value={openRate ? `${openRate}%` : '—'}
        sub={b.opens ? b.opens.toLocaleString() : null}
      />
      <Stat
        label="Clicks"
        value={clickRate ? `${clickRate}%` : '—'}
        sub={b.clicks ? b.clicks.toLocaleString() : null}
      />
      <Stat label="Unsubs" value={b.unsubs != null ? b.unsubs : '—'} />
      <button className="btn-ghost" style={{ padding: 8, borderRadius: 8 }}>
        <Icon name="more" size={16} />
      </button>
    </div>
  )
}
