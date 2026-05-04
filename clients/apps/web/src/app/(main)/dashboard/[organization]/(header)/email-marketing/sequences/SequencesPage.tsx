'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useDeleteEmailSequence,
  useEmailSequences,
  useUpdateEmailSequence,
} from '@/hooks/queries/emailMarketing'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import MoreHorizOutlined from '@mui/icons-material/MoreHorizOutlined'
import PauseOutlined from '@mui/icons-material/PauseOutlined'
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useState } from 'react'

const TRIGGER_LABELS: Record<string, string> = {
  on_subscribe: 'On subscribe',
  on_purchase: 'On purchase',
  on_subscription_created: 'On subscription created',
  on_subscription_cancelled: 'On subscription cancelled',
  on_form_submit: 'On form submit',
  manual: 'Manual',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}
    >
      {status}
    </span>
  )
}

function SequenceRow({
  sequence,
  base,
}: {
  sequence: any
  base: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const updateSequence = useUpdateEmailSequence()
  const deleteSequence = useDeleteEmailSequence()

  const toggleStatus = () => {
    const newStatus =
      sequence.status === 'active'
        ? 'paused'
        : sequence.status === 'paused'
          ? 'active'
          : 'active'
    updateSequence.mutate({ sequenceId: sequence.id, status: newStatus })
  }

  const handleDelete = () => {
    if (confirm(`Delete "${sequence.name}"? This cannot be undone.`)) {
      deleteSequence.mutate(sequence.id)
    }
    setMenuOpen(false)
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
        <MailOutlined fontSize="small" />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`${base}/${sequence.id}`}
          className="block truncate font-medium text-gray-900 hover:text-blue-600"
        >
          {sequence.name}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
          <span>{TRIGGER_LABELS[sequence.trigger_type] ?? sequence.trigger_type}</span>
          <span>·</span>
          <span>{sequence.step_count ?? 0} steps</span>
          <span>·</span>
          <span>{sequence.enrollment_count ?? 0} enrolled</span>
        </div>
      </div>
      <StatusBadge status={sequence.status} />
      <div className="relative">
        <button
          onClick={toggleStatus}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title={sequence.status === 'active' ? 'Pause' : 'Activate'}
        >
          {sequence.status === 'active' ? (
            <PauseOutlined fontSize="small" />
          ) : (
            <PlayArrowOutlined fontSize="small" />
          )}
        </button>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <MoreHorizOutlined fontSize="small" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            <Link
              href={`${base}/${sequence.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <DeleteOutlined fontSize="small" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SequencesPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const sequencesQuery = useEmailSequences(organization.id, { page: 1, limit: 50 })
  const sequences = sequencesQuery.data?.items ?? []
  const base = `/dashboard/${organization.slug}/email-marketing/sequences`

  return (
    <DashboardBody title="Sequences">
      <div className="flex flex-col gap-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Automated email series triggered by subscriber actions.
          </p>
          <Link href={`${base}/new`}>
            <Button>
              <AddOutlined fontSize="small" className="mr-1" />
              New Sequence
            </Button>
          </Link>
        </div>

        {/* Loading */}
        {sequencesQuery.isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!sequencesQuery.isLoading && sequences.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-center">
            <MailOutlined
              className="mb-3 text-gray-300"
              style={{ fontSize: 40 }}
            />
            <p className="font-medium text-gray-700">No sequences yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first automated email sequence to nurture subscribers.
            </p>
            <Link href={`${base}/new`} className="mt-4">
              <Button>
                <AddOutlined fontSize="small" className="mr-1" />
                New Sequence
              </Button>
            </Link>
          </div>
        )}

        {/* List */}
        {sequences.length > 0 && (
          <div className="flex flex-col gap-3">
            {sequences.map((seq: any) => (
              <SequenceRow key={seq.id} sequence={seq} base={base} />
            ))}
          </div>
        )}
      </div>
    </DashboardBody>
  )
}
