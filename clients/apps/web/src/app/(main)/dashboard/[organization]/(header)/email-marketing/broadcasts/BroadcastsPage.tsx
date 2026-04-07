'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEmailBroadcasts } from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'

export default function BroadcastsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const broadcastsQuery = useEmailBroadcasts(organization.id, {
    page: 1,
    limit: 50,
  })

  const broadcasts = broadcastsQuery.data

  return (
    <DashboardBody title="Broadcasts">
      <div className="flex flex-col gap-y-8">
        {broadcasts?.items && broadcasts.items.length > 0 ? (
          <>
            {/* Controls */}
            <div className="flex flex-row items-center justify-between">
              <p className="dark:text-spaire-400 text-sm text-gray-500">
                Send one-off email campaigns to your subscribers.
              </p>
              <Link href={`/dashboard/${organization.slug}/email-marketing/broadcasts/new`}>
                <Button>
                  <AddOutlined className="mr-1" fontSize="small" />
                  New broadcast
                </Button>
              </Link>
            </div>

            {/* Broadcast list */}
            <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200">
              {/* Header */}
              <div className="dark:bg-spaire-900 flex flex-row items-center gap-4 rounded-t-2xl bg-gray-50 px-6 py-3 text-xs font-medium text-gray-500">
                <div className="flex-1">Subject</div>
                <div className="w-28">Status</div>
                <div className="w-28">Recipients</div>
                <div className="w-36">Created</div>
              </div>

              {broadcasts.items.map((broadcast: any) => (
                <Link
                  key={broadcast.id}
                  href={`/dashboard/${organization.slug}/email-marketing/broadcasts/${broadcast.id}`}
                  className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{broadcast.subject}</span>
                    <span className="dark:text-spaire-500 text-xs text-gray-400">
                      From: {broadcast.sender_name}
                    </span>
                  </div>
                  <div className="w-28">
                    <BroadcastStatusBadge status={broadcast.status} />
                  </div>
                  <div className="w-28 text-sm text-gray-500">
                    {broadcast.total_recipients > 0
                      ? broadcast.total_recipients.toLocaleString()
                      : '—'}
                  </div>
                  <div className="dark:text-spaire-400 w-36 text-sm text-gray-500">
                    {new Date(broadcast.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
            <div style={{ isolation: 'isolate' }} className="relative h-14 w-24">
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-0 left-0 h-14 w-14 rounded-full bg-violet-300" />
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-0 right-0 h-14 w-14 rounded-full bg-pink-300" />
            </div>
            <div className="flex max-w-lg flex-col gap-3">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Reach your audience with broadcasts
              </h2>
              <p className="dark:text-spaire-400 text-gray-500">
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

function BroadcastStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-spaire-700 dark:text-spaire-300',
    sending: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    sent: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    failed: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    scheduled: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
    pending_approval: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  }

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}
    >
      {status === 'pending_approval' ? 'Pending' : status}
    </span>
  )
}
