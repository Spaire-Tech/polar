import { useState } from 'react'
import { SEQUENCES, Template, TEMPLATES } from '../data'
import { Icon } from '../Icon'
import { MetricTile, Stat } from '../shared'

export const SequencesScreen = ({ onNew }: { onNew: () => void }) => {
  const [view, setView] = useState<'mine' | 'templates'>('mine')

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
            Automations
          </div>
          <h1 className="h-display">Sequences</h1>
          <p
            className="muted"
            style={{ fontSize: 15, marginTop: 12, maxWidth: 560 }}
          >
            Automated email series triggered by what subscribers do — joining
            your list, buying a course, finishing a lesson.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary">
            <Icon name="grid" size={15} />
            Browse templates
          </button>
          <button className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" size={15} />
            New sequence
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
          value="4"
          label="Active sequences"
          delta="6,272"
          deltaLabel="enrolled across all"
          subtle
        />
        <MetricTile
          value="58.2%"
          label="Avg. open rate"
          delta="+9.3pt"
          deltaLabel="vs broadcast avg"
        />
        <MetricTile
          value="76%"
          label="Avg. completion"
          delta="+4pt"
          deltaLabel="vs last month"
        />
        <MetricTile
          value="$24,182"
          label="Attributed revenue"
          delta="+18.6%"
          deltaLabel="last 30 days"
        />
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button
          className={`tab ${view === 'mine' ? 'tab-active' : ''}`}
          onClick={() => setView('mine')}
        >
          Your sequences
        </button>
        <button
          className={`tab ${view === 'templates' ? 'tab-active' : ''}`}
          onClick={() => setView('templates')}
        >
          Templates
        </button>
      </div>

      {view === 'mine' ? <MySequences /> : <TemplateGallery onNew={onNew} />}
    </div>
  )
}

const MySequences = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {SEQUENCES.map((s) => (
      <div
        key={s.id}
        className="card"
        style={{
          padding: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 140px 140px 140px 140px 40px',
          gap: 24,
          alignItems: 'center',
          cursor: 'pointer',
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
            {s.active ? (
              <span className="chip chip-success">
                <span className="dot" />
                Active
              </span>
            ) : (
              <span className="chip">
                <span className="dot" style={{ background: 'var(--ink-4)' }} />
                Paused
              </span>
            )}
            <span className="chip">{s.trigger}</span>
            <span className="chip">{s.steps} emails</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {s.name}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
            {s.description}
          </div>
        </div>
        <Stat label="Enrolled" value={s.enrolled.toLocaleString()} />
        <Stat label="Completion" value={`${s.completion}%`} />
        <Stat label="Open rate" value={`${s.openRate}%`} />
        <Stat label="Status" value={s.active ? 'Running' : 'Paused'} />
        <button className="btn-ghost" style={{ padding: 8, borderRadius: 8 }}>
          <Icon name="more" size={16} />
        </button>
      </div>
    ))}
  </div>
)

const TemplateGallery = ({ onNew }: { onNew: () => void }) => (
  <div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 20,
        background: 'var(--bg-soft)',
        borderRadius: 14,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--ink)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="sparkles" size={16} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
          Start from a proven sequence
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
          Copy in pre-written, structurally tight templates and edit the parts
          that matter.
        </div>
      </div>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
      }}
    >
      {TEMPLATES.map((t) => (
        <TemplateCard key={t.id} t={t} onUse={onNew} />
      ))}
    </div>
  </div>
)

const TemplateCard = ({ t, onUse }: { t: Template; onUse: () => void }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 20,
        transition: 'all 0.18s',
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? 'var(--shadow-md)' : 'none',
        borderColor: hover ? 'var(--line-2)' : 'var(--line)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 220,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: t.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon name={t.icon} size={17} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--ink)',
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }}
      >
        {t.name}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--ink-3)',
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        {t.description}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--line)',
          fontSize: 11.5,
          color: 'var(--ink-3)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
            {t.emails}
          </strong>{' '}
          emails
        </span>
        <span>
          <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
            {t.days}
          </strong>{' '}
          days
        </span>
        <span
          style={{
            marginLeft: 'auto',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontWeight: 500,
          }}
          onClick={onUse}
        >
          Use
          <Icon name="arrow-right" size={11} />
        </span>
      </div>
    </div>
  )
}
