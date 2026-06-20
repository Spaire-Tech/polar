'use client'

/**
 * Broadcast — list of one-off emails + per-broadcast send stats, in the course
 * editor's box style. Wired to the real /v1/email-broadcasts endpoints.
 * "New broadcast" opens the actual composer in-canvas (it portals full-screen
 * and returns here on exit), so you never leave the course editor.
 */
import { ComposerApp } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/ComposerApp'
import { sanitizeEmailHtml } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/sanitize'
import {
  type BroadcastRow,
  useEmailBroadcast,
  useEmailBroadcastAnalytics,
  useEmailBroadcastSends,
  useEmailBroadcasts,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { SectionHead } from './MarketingHub'

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
function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('en-US')
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
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'failed'
          ? 'bg-red-50 text-red-600'
          : 'bg-gray-100 text-gray-600',
      )}
    >
      {STATUS_LABEL[status]}
    </span>
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
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {k}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        {v}
      </div>
      {s != null && <div className="mt-1 text-xs text-gray-500">{s}</div>}
    </div>
  )
}

export function BroadcastPanel({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const [composing, setComposing] = React.useState(false)
  const [openId, setOpenId] = React.useState<string | null>(null)

  if (composing) {
    // ComposerApp portals to <body> as a full-screen overlay; onExit unmounts
    // it and drops us back on the Broadcast list — no navigation away.
    return (
      <ComposerApp
        organization={organization}
        onExit={() => setComposing(false)}
      />
    )
  }

  if (openId) {
    return (
      <BroadcastDetail broadcastId={openId} onBack={() => setOpenId(null)} />
    )
  }

  return (
    <BroadcastList
      organization={organization}
      onOpen={(row) => {
        if (row.status === 'sent' || row.status === 'sending') {
          setOpenId(row.id)
        } else {
          // Editing an existing draft loads in the full editor.
          router.push(
            `/dashboard/${organization.slug}/email-marketing/broadcasts/${row.id}/edit`,
          )
        }
      }}
      onNew={() => setComposing(true)}
    />
  )
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-full bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-black"
    >
      {children}
    </button>
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
      <SectionHead
        title="Broadcasts"
        sub="One-off emails to your subscribers. Open a sent broadcast to see how it performed."
        action={<PrimaryButton onClick={onNew}>New broadcast</PrimaryButton>}
      />

      {q.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-8 py-14 text-center">
          <div className="text-base font-semibold text-gray-900">
            No broadcasts yet
          </div>
          <div className="mt-1 mb-4 text-sm text-gray-500">
            Write a one-off email and send it to your subscribers.
          </div>
          <PrimaryButton onClick={onNew}>New broadcast</PrimaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((row) => (
            <button
              key={row.id}
              onClick={() => onOpen(row)}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="truncate text-[15px] font-semibold text-gray-900">
                    {row.subject || 'Untitled broadcast'}
                  </span>
                  <StatusChip status={row.status} />
                </div>
                <div className="mt-1 text-[13px] text-gray-500">
                  {row.status === 'sent' && row.sent_at
                    ? `Sent ${fmtTime(row.sent_at)}`
                    : row.status === 'scheduled' && row.scheduled_at
                      ? `Scheduled ${fmtTime(row.scheduled_at)}`
                      : `Edited ${fmtTime(row.modified_at ?? row.created_at)}`}
                  {row.total_recipients > 0
                    ? ` · ${fmtNum(row.total_recipients)} recipient${
                        row.total_recipients === 1 ? '' : 's'
                      }`
                    : ''}
                </div>
              </div>
              {row.analytics && row.status === 'sent' && (
                <div className="flex shrink-0 items-center gap-7">
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-gray-900 tabular-nums">
                      {pct(row.analytics.open_rate)}
                    </div>
                    <div className="text-[11px] text-gray-400">opens</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-gray-900 tabular-nums">
                      {pct(row.analytics.click_rate)}
                    </div>
                    <div className="text-[11px] text-gray-400">clicks</div>
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

function BroadcastDetail({
  broadcastId,
  onBack,
}: {
  broadcastId: string
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
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        ‹ Broadcasts
      </button>
      <SectionHead
        title={broadcast?.subject || 'Broadcast'}
        sub={broadcast?.sent_at ? `Sent ${fmtTime(broadcast.sent_at)}` : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          k="Recipients"
          v={fmtNum(a?.total_recipients)}
          s={`${fmtNum(a?.delivered)} delivered`}
        />
        <Tile
          k="Open rate"
          v={pct(a?.open_rate)}
          s={`${fmtNum(a?.opened)} opens`}
        />
        <Tile
          k="Click rate"
          v={pct(a?.click_rate)}
          s={`${fmtNum(a?.clicked)} clicks`}
        />
        <Tile
          k="Unsubscribes"
          v={fmtNum(a?.unsubscribed)}
          s={`${fmtNum(a?.bounced)} bounced`}
        />
      </div>

      {broadcast?.content_html && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-3 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
            Content preview
          </div>
          <div
            className="max-h-[420px] overflow-y-auto px-6 py-6 text-sm leading-relaxed text-gray-900"
            // Authored HTML, run through the shared sanitizer (same as the
            // dashboard preview).
            dangerouslySetInnerHTML={{
              __html: sanitizeEmailHtml(broadcast.content_html),
            }}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <span className="text-[13px] font-semibold text-gray-900">
            Recipients
          </span>
          <span className="text-[12px] text-gray-400">
            {fmtNum(totalSends)} total
          </span>
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
              <th className="px-5 py-2.5 font-semibold">Subscriber</th>
              <th className="px-5 py-2.5 font-semibold">Status</th>
              <th className="px-5 py-2.5 font-semibold">Sent</th>
              <th className="px-5 py-2.5 font-semibold">Opened</th>
              <th className="px-5 py-2.5 font-semibold">Clicked</th>
            </tr>
          </thead>
          <tbody>
            {sends.map((s) => (
              <tr
                key={s.id}
                className="border-t border-gray-100 text-[13px] text-gray-600"
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">
                    {s.subscriber_name || s.subscriber_email}
                  </div>
                  {s.subscriber_name && (
                    <div className="text-xs text-gray-400">
                      {s.subscriber_email}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 capitalize">{s.status}</td>
                <td className="px-5 py-3">{fmtTime(s.sent_at)}</td>
                <td className="px-5 py-3">
                  {s.opened_at
                    ? fmtTime(s.opened_at) +
                      (s.open_count > 1 ? ` · ${s.open_count}×` : '')
                    : '—'}
                </td>
                <td className="px-5 py-3">
                  {s.clicked_at
                    ? fmtTime(s.clicked_at) +
                      (s.click_count > 1 ? ` · ${s.click_count}×` : '')
                    : '—'}
                </td>
              </tr>
            ))}
            {sends.length === 0 && !sendsQ.isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-5 text-[13px] text-gray-400"
                >
                  No recipients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {maxPage > 1 && (
          <div className="flex items-center justify-end gap-4 border-t border-gray-100 px-5 py-3 text-[12px] text-gray-500">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {maxPage}
            </span>
            <button
              disabled={page >= maxPage}
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              className="rounded-full px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
