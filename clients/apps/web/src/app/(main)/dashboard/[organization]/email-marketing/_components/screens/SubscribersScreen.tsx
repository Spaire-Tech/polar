import { useState } from 'react'
import { SUBSCRIBERS } from '../data'
import { Icon } from '../Icon'
import { MetricTile } from '../shared'

const FILTERS = ['All', 'Active', 'Unsubscribed', 'Archived'] as const
type Filter = (typeof FILTERS)[number]

export const SubscribersScreen = () => {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const list = SUBSCRIBERS.filter((s) => {
    const q = query.toLowerCase()
    const matches =
      !query ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    const f =
      filter === 'All' ||
      (filter === 'Active' && s.status === 'active') ||
      (filter === 'Unsubscribed' && s.status === 'unsub') ||
      (filter === 'Archived' && s.status === 'archived')
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
            Audience
          </div>
          <h1 className="h-display">Subscribers</h1>
          <p
            className="muted"
            style={{ fontSize: 15, marginTop: 12, maxWidth: 520 }}
          >
            Everyone who&apos;s opted in to hear from you. Segment, search, and
            grow your list.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary">
            <Icon name="upload" size={15} />
            Import
          </button>
          <button className="btn btn-secondary">
            <Icon name="download" size={15} />
            Export
          </button>
          <button className="btn btn-primary">
            <Icon name="plus" size={15} />
            Add subscriber
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
          value="4,287"
          label="Total subscribers"
          delta="+131"
          deltaLabel="last 14 days"
        />
        <MetricTile
          value="4,142"
          label="Active"
          delta="96.6%"
          deltaLabel="of list"
          subtle
        />
        <MetricTile
          value="+24"
          label="Avg. daily growth"
          delta="+18%"
          deltaLabel="vs last month"
        />
        <MetricTile
          value="0.18%"
          label="Unsub rate"
          delta="−0.04%"
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
            placeholder="Search by name, email, or source…"
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

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 24 }}>Subscriber</th>
              <th>Source</th>
              <th>Subscribed</th>
              <th>Status</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td style={{ paddingLeft: 24 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div className="avatar" style={{ background: s.color }}>
                      {s.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: 'var(--ink)',
                        }}
                      >
                        {s.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--ink-3)',
                          marginTop: 2,
                        }}
                      >
                        {s.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{s.source}</td>
                <td>{s.subscribed}</td>
                <td>
                  {s.status === 'active' && (
                    <span className="chip chip-success">
                      <span className="dot" />
                      Active
                    </span>
                  )}
                  {s.status === 'unsub' && (
                    <span className="chip">
                      <span
                        className="dot"
                        style={{ background: 'var(--ink-4)' }}
                      />
                      Unsubscribed
                    </span>
                  )}
                  {s.status === 'archived' && (
                    <span className="chip">
                      <span
                        className="dot"
                        style={{ background: 'var(--ink-4)' }}
                      />
                      Archived
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="btn-ghost"
                    style={{ padding: 8, borderRadius: 8 }}
                  >
                    <Icon name="more" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          fontSize: 12.5,
          color: 'var(--ink-3)',
        }}
      >
        <div>Showing {list.length} of 4,287 subscribers</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm">Previous</button>
          <button className="btn btn-ghost btn-sm">Next</button>
        </div>
      </div>
    </div>
  )
}
