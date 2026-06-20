'use client'

/**
 * Broadcast — list of one-off emails + per-broadcast send stats, scoped to the
 * org. Wired to the real `/v1/email-broadcasts` endpoints (same data and send
 * logic as the dashboard). Composing/editing opens the actual broadcast editor.
 */
import {
  type BroadcastRow,
  useEmailBroadcast,
  useEmailBroadcastAnalytics,
  useEmailBroadcastSends,
  useEmailBroadcasts,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { sanitizeEmailHtml } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/sanitize'

const PAGE_SIZE = 20

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}
function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

const STATUS_LABEL: Record<BroadcastRow['status'], string> = {
  draft: 'Draft',
  pending_approval: 'In review',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  scheduled: 'Scheduled',
}

function StatusChip({ status }: { status: BroadcastRow['status'] }) {
  const tone =
    status === 'sent'
      ? 'ok'
      : status === 'failed'
        ? 'bad'
        : status === 'scheduled' || status === 'sending'
          ? 'live'
          : 'muted'
  return <span className={`mk-chip mk-chip-${tone}`}>{STATUS_LABEL[status]}</span>
}

export function BroadcastPanel({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const [openId, setOpenId] = React.useState<string | null>(null)

  if (openId) {
    return (
      <BroadcastDetail
        broadcastId={openId}
        orgSlug={organization.slug}
        onBack={() => setOpenId(null)}
      />
    )
  }

  return (
    <BroadcastList
      organization={organization}
      onOpen={(row) => {
        // Drafts/scheduled jump straight into the actual editor; sent ones show
        // their send stats here.
        if (row.status === 'sent' || row.status === 'sending') {
          setOpenId(row.id)
        } else {
          router.push(
            `/dashboard/${organization.slug}/email-marketing/broadcasts/${row.id}/edit`,
          )
        }
      }}
      onNew={() =>
        router.push(
          `/dashboard/${organization.slug}/email-marketing/broadcasts/new`,
        )
      }
    />
  )
}

function BroadcastList({
  organization,
  onOpen,
  onNew,
}: {
  organization: schemas['Organization']
  onOpen: (row: BroadcastRow) => void
  onNew: () => void
}) {
  const q = useEmailBroadcasts(organization.id, { limit: 50 })
  const items = q.data?.items ?? []

  return (
    <div>
      <div className="mk-head">
        <div>
          <div className="mk-h">Broadcasts</div>
          <div className="mk-sub">
            One-off emails to your subscribers. Open a sent broadcast to see how
            it performed.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          New broadcast
        </button>
      </div>

      {q.isLoading ? (
        <div className="mk-skeleton" />
      ) : items.length === 0 ? (
        <div className="card mk-empty">
          <div className="mk-empty-t">No broadcasts yet</div>
          <div className="mk-empty-s">
            Write a one-off email and send it to your subscribers.
          </div>
          <button className="btn btn-primary" onClick={onNew}>
            New broadcast
          </button>
        </div>
      ) : (
        <div className="mk-list">
          {items.map((row) => (
            <button key={row.id} className="card mk-bc" onClick={() => onOpen(row)}>
              <div className="mk-bc-main">
                <div className="mk-bc-top">
                  <span className="mk-bc-subject">
                    {row.subject || 'Untitled broadcast'}
                  </span>
                  <StatusChip status={row.status} />
                </div>
                <div className="mk-bc-meta">
                  {row.status === 'sent' && row.sent_at
                    ? `Sent ${fmtTime(row.sent_at)}`
                    : row.status === 'scheduled' && row.scheduled_at
                      ? `Scheduled ${fmtTime(row.scheduled_at)}`
                      : `Edited ${fmtTime(row.modified_at ?? row.created_at)}`}
                  {row.total_recipients > 0 && (
                    <>
                      <span className="mk-dot">·</span>
                      {fmtNum(row.total_recipients)} recipient
                      {row.total_recipients === 1 ? '' : 's'}
                    </>
                  )}
                </div>
              </div>
              {row.analytics && row.status === 'sent' && (
                <div className="mk-bc-stats">
                  <div className="mk-bc-stat">
                    <b>{pct(row.analytics.open_rate)}</b>
                    <span>opens</span>
                  </div>
                  <div className="mk-bc-stat">
                    <b>{pct(row.analytics.click_rate)}</b>
                    <span>clicks</span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({
  k,
  v,
  s,
}: {
  k: string
  v: React.ReactNode
  s?: React.ReactNode
}) {
  return (
    <div className="card mk-tile">
      <div className="mk-tile-k">{k}</div>
      <div className="mk-tile-v">{v}</div>
      {s != null && <div className="mk-tile-s">{s}</div>}
    </div>
  )
}

function BroadcastDetail({
  broadcastId,
  orgSlug,
  onBack,
}: {
  broadcastId: string
  orgSlug: string
  onBack: () => void
}) {
  const bc = useEmailBroadcast(broadcastId)
  const an = useEmailBroadcastAnalytics(broadcastId)
  const [page, setPage] = React.useState(1)
  const sendsQ = useEmailBroadcastSends(broadcastId, { page, limit: PAGE_SIZE })

  const broadcast = bc.data as BroadcastRow | undefined
  const a = an.data
  const sends = sendsQ.data?.items ?? []
  const totalSends = sendsQ.data?.pagination?.total_count ?? 0
  const maxPage = Math.max(1, Math.ceil(totalSends / PAGE_SIZE))

  return (
    <div>
      <button className="mk-back" onClick={onBack}>
        ‹ Broadcasts
      </button>
      <div className="mk-head">
        <div>
          <div className="mk-h">
            {broadcast?.subject || 'Broadcast'}
          </div>
          <div className="mk-sub">
            {broadcast?.sent_at ? `Sent ${fmtTime(broadcast.sent_at)}` : null}
          </div>
        </div>
      </div>

      <div className="mk-tiles mk-tiles-4">
        <Tile
          k="Recipients"
          v={fmtNum(a?.total_recipients ?? 0)}
          s={`${fmtNum(a?.delivered ?? 0)} delivered`}
        />
        <Tile
          k="Open rate"
          v={pct(a?.open_rate)}
          s={`${fmtNum(a?.opened ?? 0)} opens`}
        />
        <Tile
          k="Click rate"
          v={pct(a?.click_rate)}
          s={`${fmtNum(a?.clicked ?? 0)} clicks`}
        />
        <Tile
          k="Unsubscribes"
          v={fmtNum(a?.unsubscribed ?? 0)}
          s={`${fmtNum(a?.bounced ?? 0)} bounced`}
        />
      </div>

      {broadcast?.content_html && (
        <div className="card mk-preview">
          <div className="mk-preview-h">Content preview</div>
          <div
            className="mk-preview-body"
            // Email HTML is creator-authored and run through the shared
            // sanitizer, identical to the dashboard preview.
            dangerouslySetInnerHTML={{
              __html: sanitizeEmailHtml(broadcast.content_html),
            }}
          />
        </div>
      )}

      <div className="mk-table-wrap">
        <div className="mk-table-h">
          Recipients <span className="mk-t3">{fmtNum(totalSends)} total</span>
        </div>
        <table className="mk-table">
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Opened</th>
              <th>Clicked</th>
            </tr>
          </thead>
          <tbody>
            {sends.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="mk-sub-name">
                    {s.subscriber_name || s.subscriber_email}
                  </div>
                  {s.subscriber_name && (
                    <div className="mk-sub-email">{s.subscriber_email}</div>
                  )}
                </td>
                <td className="mk-cap">{s.status}</td>
                <td>{fmtTime(s.sent_at)}</td>
                <td>
                  {s.opened_at
                    ? fmtTime(s.opened_at) +
                      (s.open_count > 1 ? ` · ${s.open_count}×` : '')
                    : '—'}
                </td>
                <td>
                  {s.clicked_at
                    ? fmtTime(s.clicked_at) +
                      (s.click_count > 1 ? ` · ${s.click_count}×` : '')
                    : '—'}
                </td>
              </tr>
            ))}
            {sends.length === 0 && !sendsQ.isLoading && (
              <tr>
                <td colSpan={5} className="mk-t3" style={{ padding: '18px 16px' }}>
                  No recipients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {maxPage > 1 && (
          <div className="mk-pager">
            <button
              className="btn btn-quiet btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="mk-t3">
              Page {page} of {maxPage}
            </span>
            <button
              className="btn btn-quiet btn-sm"
              disabled={page >= maxPage}
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <a
        className="mk-edit-link"
        href={`/dashboard/${orgSlug}/email-marketing/broadcasts/${broadcastId}`}
      >
        Open full report ›
      </a>
    </div>
  )
}
