'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerURL } from '@/utils/api'
import {
  useCreateEmailSubscriber,
  useEmailSubscribers,
  useEmailSubscriberStats,
  useUpdateEmailSubscriber,
} from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
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
import { useCallback, useRef, useState } from 'react'

export default function SubscribersPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Filter by search query on client side
  const filteredItems = subscribers?.items?.filter((sub: any) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      sub.email?.toLowerCase().includes(q) ||
      sub.name?.toLowerCase().includes(q)
    )
  })

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

  const handleExport = useCallback(() => {
    const url = getServerURL(
      `/v1/email-subscribers/export?organization_id=${organization.id}`,
    )
    window.open(url, '_blank')
  }, [organization.id])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImporting(true)
      try {
        const text = await file.text()
        const lines = text.split('\n').filter((l) => l.trim())
        // Skip header row if it looks like one
        const startIdx =
          lines[0]?.toLowerCase().includes('email') ? 1 : 0
        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
          const email = cols[0]
          const name = cols[1] || undefined
          if (email && email.includes('@')) {
            await createSubscriber.mutateAsync({ email, name })
          }
        }
      } finally {
        setImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [createSubscriber],
  )

  const getInitial = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase()
    if (email) return email.charAt(0).toUpperCase()
    return '?'
  }

  const avatarColors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-amber-500',
    'bg-rose-500',
  ]

  const getAvatarColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return avatarColors[Math.abs(hash) % avatarColors.length]
  }

  const hasSubscribers = subscribers?.items && subscribers.items.length > 0
  const hasStats = stats && stats.total > 0

  return (
    <DashboardBody title="Subscribers">
      <div className="flex flex-col gap-y-6">
        {/* Analytics stat cards */}
        {hasStats && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="dark:border-spaire-700 dark:bg-spaire-900 relative flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="absolute top-5 left-5 h-10 w-1 rounded-full bg-blue-500" />
              <span className="pl-4 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.total.toLocaleString()}
              </span>
              <span className="dark:text-spaire-400 pl-4 text-sm text-gray-500">
                Total subscribers
              </span>
            </div>
            <div className="dark:border-spaire-700 dark:bg-spaire-900 relative flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="absolute top-5 left-5 h-10 w-1 rounded-full bg-emerald-500" />
              <span className="pl-4 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.active.toLocaleString()}
              </span>
              <span className="dark:text-spaire-400 pl-4 text-sm text-gray-500">
                Active subscribers
              </span>
            </div>
            <div className="dark:border-spaire-700 dark:bg-spaire-900 relative flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="absolute top-5 left-5 h-10 w-1 rounded-full bg-gray-400" />
              <span className="pl-4 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.unsubscribed.toLocaleString()}
              </span>
              <span className="dark:text-spaire-400 pl-4 text-sm text-gray-500">
                Unsubscribes
              </span>
            </div>
          </div>
        )}

        {/* Divider */}
        {hasStats && (
          <div className="dark:border-spaire-700 border-t border-gray-200" />
        )}

        {/* Search + Filter + Actions bar */}
        {hasSubscribers && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="dark:border-spaire-700 flex flex-1 flex-row items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:bg-transparent">
              <SearchOutlined className="dark:text-spaire-500 text-gray-400" fontSize="small" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subscribers by name or email..."
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-gray-500"
              />
            </div>
            <div className="flex flex-row items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Subscribers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subscribers</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
              >
                <FileDownloadOutlined fontSize="small" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleImportClick}
                loading={importing}
              >
                <FileUploadOutlined fontSize="small" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <AddOutlined fontSize="small" />
              </Button>
            </div>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-end">
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

        {/* Subscriber table */}
        {hasSubscribers ? (
          <>
            <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
              {/* Header */}
              <div className="dark:bg-spaire-900 hidden flex-row items-center gap-4 bg-gray-50 px-6 py-3 text-xs font-medium text-gray-500 md:flex">
                <div className="flex-1">Name</div>
                <div className="w-32">Subscribed</div>
                <div className="w-24">Source</div>
                <div className="w-24">Status</div>
                <div className="w-8" />
              </div>

              {(filteredItems ?? []).map((sub: any) => (
                <div
                  key={sub.id}
                  className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-3.5 hover:bg-gray-50"
                >
                  <div className="flex flex-1 flex-row items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColor(sub.email)}`}
                    >
                      {getInitial(sub.name, sub.email)}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {sub.name || sub.email}
                      </span>
                      {sub.name && (
                        <span className="dark:text-spaire-500 truncate text-xs text-gray-400">
                          {sub.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dark:text-spaire-400 hidden w-32 text-sm text-gray-500 md:block">
                    {sub.created_at
                      ? new Date(sub.created_at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </div>
                  <div className="hidden w-24 md:block">
                    <SourceBadge source={sub.source} />
                  </div>
                  <div className="hidden w-24 md:block">
                    <StatusBadge status={sub.status} />
                  </div>
                  <div className="w-8">
                    {sub.status === 'active' && (
                      <button
                        onClick={() => handleArchive(sub.id)}
                        className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <MoreHorizOutlined fontSize="small" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {subscribers?.pagination && subscribers.pagination.total_count > 20 && (
              <div className="flex flex-row items-center justify-between">
                <p className="dark:text-spaire-400 text-sm text-gray-500">
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
          </>
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
            <div className="flex flex-row gap-3">
              <Button size="lg" onClick={() => setShowAddForm(true)} className="gap-2">
                <AddOutlined fontSize="small" />
                Add subscriber
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={handleImportClick}
                className="gap-2"
              >
                <FileUploadOutlined fontSize="small" />
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardBody>
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
