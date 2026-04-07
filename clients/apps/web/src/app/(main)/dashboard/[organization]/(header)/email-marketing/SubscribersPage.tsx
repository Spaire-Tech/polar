'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateEmailSubscriber,
  useEmailSubscribers,
  useEmailSubscriberStats,
  useUpdateEmailSubscriber,
} from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import { useCallback, useState } from 'react'

export default function SubscribersPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')

  const subscribersQuery = useEmailSubscribers(organization.id, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    limit: 20,
  })
  const statsQuery = useEmailSubscriberStats(organization.id)
  const createSubscriber = useCreateEmailSubscriber(organization.id)
  const updateSubscriber = useUpdateEmailSubscriber()

  const stats = statsQuery.data
  const subscribers = subscribersQuery.data

  const handleAdd = useCallback(async () => {
    if (!newEmail.trim()) return
    await createSubscriber.mutateAsync({
      email: newEmail.trim(),
      name: newName.trim() || undefined,
    })
    setNewEmail('')
    setNewName('')
    setShowAddForm(false)
  }, [newEmail, newName, createSubscriber])

  const handleArchive = useCallback(
    async (subscriberId: string) => {
      await updateSubscriber.mutateAsync({
        subscriberId,
        body: { status: 'archived' },
      })
    },
    [updateSubscriber],
  )

  return (
    <DashboardBody title="Subscribers">
      <div className="flex flex-col gap-y-8">
        {/* Stats cards — only show when there are subscribers */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} color="text-green-600" />
            <StatCard
              label="Unsubscribed"
              value={stats.unsubscribed}
              color="text-gray-400"
            />
            <StatCard label="Invalid" value={stats.invalid} color="text-red-400" />
          </div>
        )}

        {/* Controls — only show when there are subscribers */}
        {subscribers?.items && subscribers.items.length > 0 && (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-row items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-row gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  window.open(
                    `/api/v1/email-subscribers/export?organization_id=${organization.id}`,
                    '_blank',
                  )
                }}
              >
                <FileDownloadOutlined className="mr-1" fontSize="small" />
                Export CSV
              </Button>
              <Button onClick={() => setShowAddForm(true)}>
                <AddOutlined className="mr-1" fontSize="small" />
                Add subscriber
              </Button>
            </div>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-row items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-gray-500">Email</label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="subscriber@example.com"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-gray-500">Name (optional)</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <Button onClick={handleAdd} loading={createSubscriber.isPending}>
              Add
            </Button>
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        )}

        {/* Subscriber list */}
        {subscribers?.items && subscribers.items.length > 0 ? (
          <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200">
            {/* Header row */}
            <div className="dark:bg-spaire-900 flex flex-row items-center gap-4 rounded-t-2xl bg-gray-50 px-6 py-3 text-xs font-medium text-gray-500">
              <div className="flex-1">Email</div>
              <div className="w-32">Name</div>
              <div className="w-28">Source</div>
              <div className="w-24">Status</div>
              <div className="w-20" />
            </div>

            {subscribers.items.map((sub: any) => (
              <div
                key={sub.id}
                className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex flex-1 flex-row items-center gap-3">
                  <div className="dark:bg-spaire-700 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <PersonOutlined className="text-gray-400" fontSize="small" />
                  </div>
                  <span className="text-sm">{sub.email}</span>
                </div>
                <div className="w-32 truncate text-sm text-gray-500">
                  {sub.name || '—'}
                </div>
                <div className="w-28">
                  <SourceBadge source={sub.source} />
                </div>
                <div className="w-24">
                  <StatusBadge status={sub.status} />
                </div>
                <div className="w-20 text-right">
                  {sub.status === 'active' && (
                    <button
                      onClick={() => handleArchive(sub.id)}
                      className="text-xs text-gray-400 transition-colors hover:text-red-500"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
            <div style={{ isolation: 'isolate' }} className="relative h-[88px] w-[88px]">
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-0 left-0 h-14 w-14 rounded-full bg-cyan-300" />
              <div style={{ mixBlendMode: 'multiply' }} className="absolute bottom-0 right-0 h-14 w-14 rounded-full bg-blue-300" />
            </div>
            <div className="flex max-w-lg flex-col gap-3">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Your subscribers, all in one place
              </h2>
              <p className="dark:text-spaire-400 text-gray-500">
                Subscribers are added automatically when people subscribe via your
                Space or make a purchase. You can also add them manually.
              </p>
            </div>
            <Button size="lg" onClick={() => setShowAddForm(true)} className="gap-2">
              <AddOutlined fontSize="small" />
              Add subscriber
            </Button>
          </div>
        )}

        {/* Pagination */}
        {subscribers?.pagination && subscribers.pagination.total_count > 20 && (
          <div className="flex flex-row items-center justify-between">
            <p className="text-sm text-gray-500">
              {subscribers.pagination.total_count} subscribers
            </p>
            <div className="flex flex-row gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  !subscribers.pagination.max_page ||
                  page >= subscribers.pagination.max_page
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardBody>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4">
      <span className="dark:text-spaire-400 text-xs text-gray-500">{label}</span>
      <span className={`text-2xl font-semibold ${color ?? ''}`}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    unsubscribed: 'bg-gray-100 text-gray-500 dark:bg-spaire-700 dark:text-spaire-400',
    archived: 'bg-gray-100 text-gray-400 dark:bg-spaire-700 dark:text-spaire-500',
    invalid: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  }

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.active}`}
    >
      {status}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    space_signup: 'Space',
    purchase: 'Purchase',
    manual: 'Manual',
    import: 'Import',
  }

  return (
    <span className="dark:text-spaire-400 text-xs text-gray-500">
      {labels[source] ?? source}
    </span>
  )
}
