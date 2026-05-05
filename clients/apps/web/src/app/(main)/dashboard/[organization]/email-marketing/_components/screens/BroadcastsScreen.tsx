import {
  BroadcastRow,
  useArchiveEmailBroadcast,
  useBroadcastAggregateAnalytics,
  useCancelScheduledEmailBroadcast,
  useDuplicateEmailBroadcast,
  useEmailBroadcasts,
  useEmailSubscriberStats,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useState } from 'react'
import { ActionMenu } from '../ActionMenu'
import { Icon } from '../Icon'
import { MetricTile, Stat } from '../shared'

const FILTERS = [
  { id: 'All', api: undefined },
  { id: 'Sent', api: 'sent' },
  { id: 'Scheduled', api: 'scheduled' },
  { id: 'Drafts', api: 'draft' },
] as const
type Filter = (typeof FILTERS)[number]['id']

const PAGE_SIZE = 20

const formatSentAt = (b: BroadcastRow) => {
  if (b.status === 'scheduled' && b.scheduled_at)
    return `Scheduled for ${new Date(b.scheduled_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  if (b.sent_at)
    return new Date(b.sent_at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  if (b.status === 'draft') return 'Draft'
  return '—'
}

export const BroadcastsScreen = ({
  organization,
  onNew,
  onOpen,
  onEdit,
}: {
  organization: schemas['Organization']
  onNew: () => void
  onOpen: (broadcastId: string) => void
  onEdit: (broadcastId: string) => void
}) => {
  const orgId = organization.id
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const [page, setPage] = useState(1)

  const apiStatus = FILTERS.find((f) => f.id === filter)?.api

  const broadcastsQuery = useEmailBroadcasts(orgId, {
    status: apiStatus,
    q: query.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  })
  const aggregateQuery = useBroadcastAggregateAnalytics(orgId)
  const subStatsQuery = useEmailSubscriberStats(orgId)

  const duplicateMutation = useDuplicateEmailBroadcast()
  const cancelMutation = useCancelScheduledEmailBroadcast()
  const archiveMutation = useArchiveEmailBroadcast()

  const items = broadcastsQuery.data?.items ?? []
  const totalCount = broadcastsQuery.data?.pagination.total_count ?? 0
  const maxPage = broadcastsQuery.data?.pagination.max_page ?? 1
  const aggregate = aggregateQuery.data
  const subStats = subStatsQuery.data

  const onArchive = (b: BroadcastRow) => {
    if (window.confirm(`Archive "${b.subject}"?`)) archiveMutation.mutate(b.id)
  }

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
          label="Avg. open rate"
          delta={aggregate ? `${aggregate.opened.toLocaleString()}` : undefined}
          deltaLabel="opens"
          subtle
        />
        <MetricTile
          value={`${(aggregate?.click_rate ?? 0).toFixed(1)}%`}
          label="Avg. click rate"
          delta={
            aggregate ? `${aggregate.clicked.toLocaleString()}` : undefined
          }
          deltaLabel="clicks"
          subtle
        />
        <MetricTile
          value={
            aggregate && aggregate.total_sent
              ? `${((aggregate.unsubscribed / aggregate.total_sent) * 100).toFixed(2)}%`
              : '0%'
          }
          label="Avg. unsub rate"
          delta={
            subStats ? `${subStats.unsubs_30d.toLocaleString()}` : undefined
          }
          deltaLabel="unsubs / 30d"
          subtle
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
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`tab ${filter === f.id ? 'tab-active' : ''}`}
              onClick={() => {
                setFilter(f.id)
                setPage(1)
              }}
            >
              {f.id}
            </button>
          ))}
        </div>
      </div>

      {broadcastsQuery.isLoading && items.length === 0 && (
        <div
          className="card"
          style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}
        >
          Loading…
        </div>
      )}

      {!broadcastsQuery.isLoading && items.length === 0 && (
        <div
          className="card"
          style={{ padding: 56, textAlign: 'center', color: 'var(--ink-3)' }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>
            No broadcasts {filter !== 'All' ? `with status ${filter}` : 'yet'}.
          </div>
          <button
            className="btn btn-primary"
            onClick={onNew}
            style={{ marginTop: 18 }}
          >
            <Icon name="plus" size={14} />
            Create your first broadcast
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((b) => {
          const editable = b.status === 'draft' || b.status === 'scheduled'
          return (
            <BroadcastListRow
              key={b.id}
              b={b}
              // Drafts and scheduled broadcasts open in the composer; sent
              // broadcasts open in the analytics detail view.
              onOpen={() => (editable ? onEdit(b.id) : onOpen(b.id))}
              onEdit={() => onEdit(b.id)}
              onDuplicate={() => duplicateMutation.mutate(b.id)}
              onCancelSchedule={() => cancelMutation.mutate(b.id)}
              onArchive={() => onArchive(b)}
              onViewReport={editable ? undefined : () => onOpen(b.id)}
            />
          )
        })}
      </div>

      {totalCount > PAGE_SIZE && (
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
          <div>
            Page {page} of {maxPage} · {totalCount.toLocaleString()} broadcasts
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.4 : 1 }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= maxPage}
              style={{ opacity: page >= maxPage ? 0.4 : 1 }}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const BroadcastListRow = ({
  b,
  onOpen,
  onEdit,
  onDuplicate,
  onCancelSchedule,
  onArchive,
  onViewReport,
}: {
  b: BroadcastRow
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onCancelSchedule: () => void
  onArchive: () => void
  onViewReport?: () => void
}) => {
  const editable = b.status === 'draft' || b.status === 'scheduled'
  const a = b.analytics
  const recipients = a?.recipients ?? b.total_recipients

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
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
          {b.status === 'sending' && (
            <span className="chip chip-info">
              <Icon name="send" size={11} />
              Sending…
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
          {b.status === 'failed' && (
            <span className="chip chip-error">
              <Icon name="x-circle" size={11} />
              Failed
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
          {b.subject}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
          {formatSentAt(b)}
        </div>
      </div>
      <Stat
        label="Recipients"
        value={recipients ? recipients.toLocaleString() : '—'}
      />
      <Stat
        label="Opens"
        value={a ? `${a.open_rate.toFixed(1)}%` : '—'}
        sub={a && a.opens ? a.opens.toLocaleString() : null}
      />
      <Stat
        label="Clicks"
        value={a ? `${a.click_rate.toFixed(1)}%` : '—'}
        sub={a && a.clicks ? a.clicks.toLocaleString() : null}
      />
      <Stat label="Unsubs" value={a ? a.unsubs : '—'} />
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu
          items={[
            {
              label: 'Edit',
              icon: 'edit',
              hidden: !editable,
              onClick: onEdit,
            },
            {
              label: 'View report',
              icon: 'chart',
              hidden: !onViewReport,
              onClick: () => onViewReport?.(),
            },
            { label: 'Duplicate', icon: 'copy', onClick: onDuplicate },
            {
              label: 'Cancel schedule',
              icon: 'x-circle',
              hidden: b.status !== 'scheduled',
              onClick: onCancelSchedule,
            },
            {
              label: 'Archive',
              icon: 'trash',
              destructive: true,
              onClick: onArchive,
            },
          ]}
        />
      </div>
    </div>
  )
}
