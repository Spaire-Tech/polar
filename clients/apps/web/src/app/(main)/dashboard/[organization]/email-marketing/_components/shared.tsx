import { ReactNode } from 'react'
import { Icon } from './Icon'

export const MetricTile = ({
  value,
  label,
  delta,
  deltaLabel,
  down,
  subtle,
}: {
  value: string
  label: string
  delta?: string
  deltaLabel?: string
  down?: boolean
  subtle?: boolean
}) => (
  <div className="card" style={{ padding: 28 }}>
    <div className="metric-label" style={{ marginTop: 0, marginBottom: 18 }}>
      {label}
    </div>
    <div className="metric-value">{value}</div>
    {delta && (
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: subtle ? 'var(--ink-3)' : 'var(--green)',
        }}
      >
        {!subtle && (
          <Icon name={down ? 'trending-down' : 'trending-up'} size={13} />
        )}
        <span style={{ fontWeight: 500 }}>{delta}</span>
        {deltaLabel && (
          <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>
            {deltaLabel}
          </span>
        )}
      </div>
    )}
  </div>
)

export const Stat = ({
  label,
  value,
  sub,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
}) => (
  <div>
    <div
      style={{
        fontSize: 11,
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 17,
        fontWeight: 600,
        color: 'var(--ink)',
        letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
        {sub}
      </div>
    )}
  </div>
)

export const KV = ({ k, v }: { k: string; v: ReactNode }) => (
  <div>
    <div
      style={{
        fontSize: 11,
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 3,
      }}
    >
      {k}
    </div>
    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
      {v}
    </div>
  </div>
)

export const Toggle = ({
  on,
  onChange,
}: {
  on: boolean
  onChange: (next: boolean) => void
}) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    style={{
      width: 44,
      height: 26,
      borderRadius: 13,
      background: on ? 'var(--ink)' : 'var(--line-2)',
      position: 'relative',
      transition: 'background 0.18s',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 3,
        left: on ? 21 : 3,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.18s',
      }}
    />
  </button>
)

export const Section = ({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: ReactNode
}) => (
  <div style={{ marginBottom: 36 }}>
    <h2 className="h2" style={{ marginBottom: 6 }}>
      {title}
    </h2>
    {sub ? (
      <p
        className="muted"
        style={{ fontSize: 14, marginBottom: 24, marginTop: 0 }}
      >
        {sub}
      </p>
    ) : (
      <div style={{ height: 24 }} />
    )}
    {children}
  </div>
)
