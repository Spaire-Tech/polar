'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEmailBroadcasts } from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export default function BroadcastsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const broadcastsQuery = useEmailBroadcasts(organization.id, {
    page: 1,
    limit: 50,
  })

  const broadcasts = broadcastsQuery.data
  const items = broadcasts?.items ?? []

  // Compute aggregate stats from all broadcasts
  const aggregateStats = useMemo(() => {
    let totalSent = 0
    let totalOpened = 0
    let totalClicked = 0
    let totalDelivered = 0
    let totalUnsubscribed = 0

    for (const b of items as any[]) {
      const recipients = b.total_recipients ?? 0
      totalSent += recipients
      // These fields come from analytics if available
      if (b.delivered) totalDelivered += b.delivered
      if (b.opened) totalOpened += b.opened
      if (b.clicked) totalClicked += b.clicked
      if (b.unsubscribed) totalUnsubscribed += b.unsubscribed
    }

    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0

    return { totalSent, openRate, clickRate, totalUnsubscribed }
  }, [items])

  // Filter by search
  const filteredItems = items.filter((b: any) => {
    if (!searchQuery.trim()) return true
    return b.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const hasBroadcasts = items.length > 0

  return (
    <DashboardBody title="Broadcasts">
      <div className="flex flex-col gap-y-6">
        {/* Aggregate stat cards */}
        {hasBroadcasts && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              value={aggregateStats.totalSent.toLocaleString()}
              label="Emails sent"
              accent="bg-blue-500"
            />
            <StatCard
              value={`${aggregateStats.openRate.toFixed(1)}%`}
              label="Avg. open rate"
              accent="bg-emerald-500"
            />
            <StatCard
              value={`${aggregateStats.clickRate.toFixed(1)}%`}
              label="Avg. click rate"
              accent="bg-violet-500"
            />
            <StatCard
              value={aggregateStats.totalUnsubscribed.toLocaleString()}
              label="Unsubscribes"
              accent="bg-gray-400"
            />
          </div>
        )}

        {/* Divider */}
        {hasBroadcasts && (
          <div className=" border-t border-gray-200" />
        )}

        {/* Search + Add */}
        {hasBroadcasts && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className=" flex flex-1 flex-row items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <SearchOutlined className=" text-gray-400" fontSize="small" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search broadcasts by name..."
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none "
              />
            </div>
            <Link href={`/dashboard/${organization.slug}/email-marketing/broadcasts/new`}>
              <Button size="sm">
                <AddOutlined fontSize="small" />
              </Button>
            </Link>
          </div>
        )}

        {/* Broadcast table */}
        {hasBroadcasts ? (
          <div className=" flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
            {/* Header */}
            <div className=" hidden flex-row items-center gap-4 bg-gray-50 px-6 py-3 text-xs font-medium text-gray-500 md:flex">
              <div className="flex-1">Name</div>
              <div className="w-40">Status</div>
              <div className="w-24 text-right">Recipients</div>
              <div className="w-20 text-right">Opens</div>
              <div className="w-20 text-right">Clicks</div>
              <div className="w-20 text-right">Unsubs</div>
              <div className="w-8" />
            </div>

            {filteredItems.map((broadcast: any) => (
              <Link
                key={broadcast.id}
                href={`/dashboard/${organization.slug}/email-marketing/broadcasts/${broadcast.id}`}
                className=" flex flex-row items-center gap-4 px-6 py-3.5 transition-colors hover:bg-gray-50"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">
                    {broadcast.subject}
                  </span>
                </div>
                <div className="hidden w-40 md:block">
                  <BroadcastStatusCell broadcast={broadcast} />
                </div>
                <div className=" hidden w-24 text-right text-sm md:block">
                  {broadcast.total_recipients > 0
                    ? broadcast.total_recipients.toLocaleString()
                    : '—'}
                </div>
                <div className=" hidden w-20 text-right text-sm text-gray-500 md:block">
                  —
                </div>
                <div className=" hidden w-20 text-right text-sm text-gray-500 md:block">
                  —
                </div>
                <div className=" hidden w-20 text-right text-sm text-gray-500 md:block">
                  —
                </div>
                <div className="w-8">
                  <MoreHorizOutlined className="text-gray-400" fontSize="small" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
            <div style={{ isolation: 'isolate' }} className="relative h-14 w-24">
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-0 left-0 h-14 w-14 rounded-full bg-violet-300" />
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-0 right-0 h-14 w-14 rounded-full bg-pink-300" />
            </div>
            <div className="flex max-w-lg flex-col gap-3">
              <h2 className="text-3xl font-bold text-gray-900">
                Reach your audience with broadcasts
              </h2>
              <p className=" text-gray-500">
                Send one-off email campaigns to your subscribers. Share updates,
                announce new products, or keep your audience engaged.
              </p>
            </div>
            <Link href={`/dashboard/${organization.slug}/email-marketing/broadcasts/new`}>
              <Button size="lg" className="gap-2">
                <AddOutlined fontSize="small" />
                New broadcast
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardBody>
  )
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string
  label: string
  accent: string
}) {
  return (
    <div className=" relative flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5">
      <div className={`absolute top-5 left-5 h-10 w-1 rounded-full ${accent}`} />
      <span className="pl-4 text-3xl font-bold text-gray-900">
        {value}
      </span>
      <span className=" pl-4 text-sm text-gray-500">
        {label}
      </span>
    </div>
  )
}

function BroadcastStatusCell({ broadcast }: { broadcast: any }) {
  if (broadcast.status === 'sent' && broadcast.sent_at) {
    return (
      <div className="flex flex-row items-center gap-1.5">
        <CheckCircleOutlined className="text-emerald-500" style={{ fontSize: 16 }} />
        <span className=" text-sm text-gray-500">
          Sent{' '}
          {new Date(broadcast.sent_at).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    )
  }

  return <BroadcastStatusBadge status={broadcast.status} />
}

function BroadcastStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 ',
    sending: 'bg-blue-50 text-blue-600 ',
    sent: 'bg-green-50 text-green-700 ',
    failed: 'bg-red-50 text-red-600 ',
    scheduled: 'bg-yellow-50 text-yellow-700 ',
    pending_approval: 'bg-orange-50 text-orange-600 ',
  }

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}
    >
      {status === 'pending_approval' ? 'Pending' : status}
    </span>
  )
}
