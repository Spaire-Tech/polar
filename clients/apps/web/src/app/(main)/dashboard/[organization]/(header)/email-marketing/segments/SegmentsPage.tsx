'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateEmailSegment,
  useDeleteEmailSegment,
  useEmailSegments,
} from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CategoryOutlined from '@mui/icons-material/CategoryOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
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

export default function SegmentsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const segmentsQuery = useEmailSegments(organization.id)
  const createSegment = useCreateEmailSegment(organization.id)
  const deleteSegment = useDeleteEmailSegment()

  const segments = segmentsQuery.data as any[] | undefined

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('manual')

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    const slug = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    await createSegment.mutateAsync({
      name: newName.trim(),
      slug,
      type: newType,
    })
    setNewName('')
    setShowCreateForm(false)
  }, [newName, newType, createSegment])

  const handleDelete = useCallback(
    async (segmentId: string) => {
      if (!confirm('Delete this segment? This cannot be undone.')) return
      await deleteSegment.mutateAsync(segmentId)
    },
    [deleteSegment],
  )

  return (
    <DashboardBody title="Segments">
      <div className="flex flex-col gap-y-8">
        {/* Create form */}
        {showCreateForm && (
          <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-row items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-gray-500">Segment name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VIP Customers"
              />
            </div>
            <div className="flex w-40 flex-col gap-1">
              <label className="text-xs text-gray-500">Type</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="product">Product buyers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCreate}
              loading={createSegment.isPending}
              disabled={!newName.trim()}
            >
              Create
            </Button>
            <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
          </div>
        )}

        {segments && segments.length > 0 ? (
          <>
            {/* Controls */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="dark:text-spaire-400 text-sm text-gray-500">
                Organize subscribers into segments for targeted broadcasts.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <AddOutlined className="mr-1" fontSize="small" />
                New segment
              </Button>
            </div>

            {/* Segment list */}
            <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200">
              {/* Header */}
              <div className="dark:bg-spaire-900 flex flex-row items-center gap-4 rounded-t-2xl bg-gray-50 px-6 py-3 text-xs font-medium text-gray-500">
                <div className="flex-1">Name</div>
                <div className="w-28">Type</div>
                <div className="w-28 text-right">Subscribers</div>
                <div className="w-16" />
              </div>

              {segments.map((segment: any) => (
                <div
                  key={segment.id}
                  className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex flex-1 flex-row items-center gap-3">
                    {segment.is_system ? (
                      <LockOutlined
                        className="dark:text-spaire-500 text-gray-400"
                        fontSize="small"
                      />
                    ) : (
                      <CategoryOutlined
                        className="dark:text-spaire-500 text-gray-400"
                        fontSize="small"
                      />
                    )}
                    <span className="text-sm font-medium">{segment.name}</span>
                  </div>
                  <div className="w-28">
                    <SegmentTypeBadge type={segment.type} />
                  </div>
                  <div className="dark:text-spaire-300 w-28 text-right text-sm">
                    {segment.subscriber_count.toLocaleString()}
                  </div>
                  <div className="w-16 text-right">
                    {!segment.is_system && (
                      <button
                        onClick={() => handleDelete(segment.id)}
                        className="text-gray-400 transition-colors hover:text-red-500"
                      >
                        <DeleteOutlined fontSize="small" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : !showCreateForm ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
            <div style={{ isolation: 'isolate' }} className="relative h-[88px] w-[88px]">
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-0 left-0 h-14 w-14 rounded-2xl bg-orange-300" />
              <div style={{ mixBlendMode: 'multiply' }} className="absolute bottom-0 right-0 h-14 w-14 rounded-full bg-yellow-300" />
            </div>
            <div className="flex max-w-lg flex-col gap-3">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Organize subscribers into segments
              </h2>
              <p className="dark:text-spaire-400 text-gray-500">
                Segments let you target specific groups of subscribers for your
                broadcasts — all subscribers, customers, or custom lists.
              </p>
            </div>
            <Button size="lg" onClick={() => setShowCreateForm(true)} className="gap-2">
              <AddOutlined fontSize="small" />
              New segment
            </Button>
          </div>
        ) : null}
      </div>
    </DashboardBody>
  )
}

function SegmentTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    all: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    customers:
      'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    product:
      'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
    manual: 'bg-gray-100 text-gray-600 dark:bg-spaire-700 dark:text-spaire-300',
    archived:
      'bg-gray-100 text-gray-400 dark:bg-spaire-700 dark:text-spaire-500',
  }

  const labels: Record<string, string> = {
    all: 'All',
    customers: 'Customers',
    repeating_customers: 'Repeat',
    product: 'Product',
    manual: 'Manual',
    archived: 'Archived',
  }

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[type] ?? styles.manual}`}
    >
      {labels[type] ?? type}
    </span>
  )
}
