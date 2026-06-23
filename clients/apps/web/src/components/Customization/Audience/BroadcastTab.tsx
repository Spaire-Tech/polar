'use client'

import { toast } from '@/components/Toast/use-toast'
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
import { useCallback, useState } from 'react'
import './audience.css'
import {
  Icon,
  KebabItem,
  KebabMenu,
  LiquidSeg,
  useDebouncedValue,
} from './shared'

const SUB =
  'Send a single email to your whole audience or any segment. Compose, preview, and schedule.'

const PAGE_SIZE = 20

type Seg = 'all' | 'sent' | 'sched' | 'draft'
const SEG_STATUS: Record<Seg, string | undefined> = {
  all: undefined,
  sent: 'sent',
  sched: 'scheduled',
  draft: 'draft',
}

const formatSentAt = (b: BroadcastRow): string => {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  if (b.status === 'scheduled' && b.scheduled_at)
    return `Scheduled for ${new Date(b.scheduled_at).toLocaleString(undefined, opts)}`
  if (b.sent_at) return new Date(b.sent_at).toLocaleString(undefined, opts)
  if (b.status === 'draft') return 'Draft'
  return '—'
}

const statusLabel = (s: BroadcastRow['status']): string =>
  s === 'sent'
    ? 'Sent'
    : s === 'sending'
      ? 'Sending…'
      : s === 'scheduled'
        ? 'Scheduled'
        : s === 'draft'
          ? 'Draft'
          : s === 'failed'
            ? 'Failed'
            : 'Pending'

export function BroadcastTab({
  organization,
  dark,
  onLeave,
}: {
  organization: schemas['Organization']
  dark: boolean
  // Guarded navigation out of the editor — confirms unpublished Space
  // edits before routing to the existing broadcast composer / detail.
  onLeave: (path: string) => void
}) {
  const orgId = organization.id
  const base = `/dashboard/${organization.slug}/email-marketing/broadcasts`

  const [query, setQuery] = useState('')
  const [seg, setSeg] = useState<Seg>('all')
  const [page, setPage] = useState(1)

  const debouncedQuery = useDebouncedValue(query, 300)

  const broadcastsQuery = useEmailBroadcasts(orgId, {
    status: SEG_STATUS[seg],
    q: debouncedQuery.trim() || undefined,
    page,
    limit: PAGE_SIZE,
    include_analytics: true,
  })
  const aggregateQuery = useBroadcastAggregateAnalytics(orgId, {
    comparePrior: false,
  })
  const subStatsQuery = useEmailSubscriberStats(orgId)

  const duplicateMutation = useDuplicateEmailBroadcast()
  const cancelMutation = useCancelScheduledEmailBroadcast()
  const archiveMutation = useArchiveEmailBroadcast()

  const items = broadcastsQuery.data?.items ?? []
  const totalCount = broadcastsQuery.data?.pagination.total_count ?? 0
  const maxPage = broadcastsQuery.data?.pagination.max_page ?? 1
  const aggregate = aggregateQuery.data?.current
  const subStats = subStatsQuery.data

  const onSearch = useCallback((v: string) => {
    setQuery(v)
    setPage(1)
  }, [])

  const onSeg = useCallback((s: Seg) => {
    setSeg(s)
    setPage(1)
  }, [])

  const runMutation = async (
    mutation: { mutateAsync: (id: string) => Promise<unknown> },
    id: string,
    failed: string,
  ) => {
    try {
      await mutation.mutateAsync(id)
    } catch (err) {
      toast({
        title: failed,
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  const openRow = (b: BroadcastRow) => {
    // Drafts + scheduled open in the existing composer; sent broadcasts
    // open in the existing analytics detail.
    const editable = b.status === 'draft' || b.status === 'scheduled'
    onLeave(editable ? `${base}/${b.id}/edit` : `${base}/${b.id}`)
  }

  const pctOrDash = (v: number | null | undefined, digits = 1) =>
    v == null ? null : v.toFixed(digits)

  const openRate = pctOrDash(aggregate?.open_rate)
  const clickRate = pctOrDash(aggregate?.click_rate)
  const unsubRate = pctOrDash(aggregate?.unsub_rate, 2)
  const sentCount = aggregate?.total_sent ?? 0

  return (
    <div className={'aud' + (dark ? ' dark' : '')}>
      <div className="a-content">
        <div className="a-head">
          <div>
            <h1 className="a-h1">Broadcasts</h1>
            <p className="a-sub">{SUB}</p>
          </div>
          <div className="a-acts">
            <button
              className="a-btn a-btn-accent"
              onClick={() => onLeave(`${base}/new`)}
            >
              <Icon n="plus" w={15} />
              New broadcast
            </button>
          </div>
        </div>

        <div className="a-metrics">
          <div className="a-metric">
            <div className="ml">Emails sent</div>
            <div className="mv">{sentCount.toLocaleString()}</div>
            <div className="md">all time</div>
          </div>
          <div className="a-metric">
            <div className="ml">Avg. open rate</div>
            <div className={'mv' + (openRate == null ? ' muted' : '')}>
              {openRate == null ? (
                '—'
              ) : (
                <>
                  {openRate}
                  <span className="unit">%</span>
                </>
              )}
            </div>
            <div className="md">across {sentCount.toLocaleString()} sent</div>
          </div>
          <div className="a-metric">
            <div className="ml">Avg. click rate</div>
            <div className={'mv' + (clickRate == null ? ' muted' : '')}>
              {clickRate == null ? (
                '—'
              ) : (
                <>
                  {clickRate}
                  <span className="unit">%</span>
                </>
              )}
            </div>
            <div className="md">across {sentCount.toLocaleString()} sent</div>
          </div>
          <div className="a-metric">
            <div className="ml">Avg. unsub rate</div>
            <div className="mv">
              {unsubRate ?? '0.00'}
              <span className="unit">%</span>
            </div>
            <div className="md">
              <b>{subStats?.unsubs_30d ?? 0}</b> unsubs / 30d
            </div>
          </div>
        </div>

        <div className="a-tools">
          <div className="a-search">
            <Icon n="search" w={16} />
            <input
              placeholder="Search broadcasts…"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <div className="sp" />
          <LiquidSeg<Seg>
            value={seg}
            onChange={onSeg}
            options={[
              ['all', 'All'],
              ['sent', 'Sent'],
              ['sched', 'Scheduled'],
              ['draft', 'Drafts'],
            ]}
          />
        </div>

        <div className="a-bc">
          {broadcastsQuery.isLoading && items.length === 0 && (
            <div
              className="a-foot"
              style={{ justifyContent: 'center', minHeight: 88 }}
            >
              Loading…
            </div>
          )}
          {!broadcastsQuery.isLoading && items.length === 0 && (
            <div
              className="a-foot"
              style={{ justifyContent: 'center', minHeight: 88 }}
            >
              No broadcasts {seg !== 'all' ? `with this status` : 'yet'}.
            </div>
          )}

          {items.map((b) => {
            const editable = b.status === 'draft' || b.status === 'scheduled'
            const a = b.analytics
            const recipients = a?.recipients ?? b.total_recipients
            const menu: KebabItem[] = []
            if (editable)
              menu.push({ label: 'Edit', onClick: () => onLeave(`${base}/${b.id}/edit`) })
            if (b.status === 'sent')
              menu.push({ label: 'View report', onClick: () => onLeave(`${base}/${b.id}`) })
            menu.push({
              label: 'Duplicate',
              onClick: () => runMutation(duplicateMutation, b.id, 'Could not duplicate'),
            })
            if (b.status === 'scheduled')
              menu.push({
                label: 'Cancel schedule',
                onClick: () =>
                  runMutation(cancelMutation, b.id, 'Could not cancel schedule'),
              })
            menu.push({
              label: 'Archive',
              destructive: true,
              onClick: () => {
                if (window.confirm(`Archive "${b.subject || 'this broadcast'}"?`))
                  runMutation(archiveMutation, b.id, 'Could not archive')
              },
            })
            return (
              <div
                className="a-bc-row"
                key={b.id}
                onClick={() => openRow(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openRow(b)
                  }
                }}
              >
                <div className="a-bc-main">
                  <div className="a-bc-subject">{b.subject}</div>
                  <div className="a-bc-meta">
                    <span
                      className={'a-status' + (b.status === 'sent' ? '' : ' off')}
                    >
                      <span className="sd" />
                      {statusLabel(b.status)}
                    </span>
                    <span className="sep">·</span>
                    <span className="when">
                      <Icon n="clock" w={13} />
                      {formatSentAt(b)}
                    </span>
                  </div>
                </div>
                <div className="a-bc-stats">
                  <div className="a-bc-stat">
                    <span className="v">
                      {recipients ? recipients.toLocaleString() : '—'}
                    </span>
                    <span className="l">Recipients</span>
                  </div>
                  <div className="a-bc-stat">
                    <span className="v">
                      {a ? `${a.open_rate.toFixed(1)}%` : '—'}
                    </span>
                    <span className="l">Opens</span>
                  </div>
                  <div className="a-bc-stat">
                    <span className="v">
                      {a ? `${a.click_rate.toFixed(1)}%` : '—'}
                    </span>
                    <span className="l">Clicks</span>
                  </div>
                  <div className="a-bc-stat">
                    <span className="v">{a ? a.unsubs : '—'}</span>
                    <span className="l">Unsubs</span>
                  </div>
                  <KebabMenu items={menu} />
                </div>
              </div>
            )
          })}

          <div className="a-foot">
            <span>
              Showing {items.length} of {totalCount.toLocaleString()} broadcasts
            </span>
            <span className="pg">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon n="chevL" w={15} />
              </button>
              <button
                disabled={page >= maxPage}
                onClick={() => setPage((p) => p + 1)}
              >
                <Icon n="chevR" w={15} />
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
