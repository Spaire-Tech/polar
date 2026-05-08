'use client'

import { useAuth } from '@/hooks/auth'
import {
  useCourseEnrollments,
  useRevokeCourseEnrollment,
} from '@/hooks/queries/courses'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { useMemo, useState } from 'react'
import { toast } from '../../Toast/use-toast'

type CustomerRow = {
  id: string
  enrollmentId: string | null
  name: string
  email: string
  avatar_url: string | null
  role: 'Admin' | 'Student'
  joined: string | null
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCsv(rows: CustomerRow[]): void {
  const header = ['Name', 'Email', 'Role', 'Joined']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [r.name, r.email, r.role, r.joined ?? '']
        .map((v) => csvEscape(String(v)))
        .join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function CustomersTab({
  organization,
  courseId,
}: {
  organization: schemas['Organization']
  courseId: string
}) {
  const { currentUser } = useAuth()
  const [query, setQuery] = useState('')
  const { data: enrollmentsPage, isLoading } = useCourseEnrollments(courseId)
  const enrollments = enrollmentsPage?.items
  const revoke = useRevokeCourseEnrollment(courseId)

  const adminRow: CustomerRow | null = currentUser
    ? {
        id: `admin-${currentUser.id}`,
        enrollmentId: null,
        name: currentUser.email.split('@')[0],
        email: currentUser.email,
        avatar_url: currentUser.avatar_url,
        role: 'Admin',
        joined: organization.created_at ?? currentUser.created_at,
      }
    : null

  const studentRows: CustomerRow[] = (enrollments ?? []).map((e) => ({
    id: e.id,
    enrollmentId: e.id,
    name: e.customer?.name || e.customer?.email.split('@')[0] || 'Student',
    email: e.customer?.email ?? '—',
    avatar_url: e.customer?.avatar_url ?? null,
    role: 'Student',
    joined: e.enrolled_at,
  }))

  const rows = useMemo(
    () => (adminRow ? [adminRow, ...studentRows] : studentRows),
    [adminRow, studentRows],
  )

  const visibleRows = query.trim()
    ? rows.filter(
        (r) =>
          r.email.toLowerCase().includes(query.toLowerCase()) ||
          r.name.toLowerCase().includes(query.toLowerCase()),
      )
    : rows

  const handleRemove = async (row: CustomerRow) => {
    if (!row.enrollmentId) return
    if (
      !confirm(
        `Remove ${row.name} from this course? Their progress will be cleared.`,
      )
    ) {
      return
    }
    try {
      await revoke.mutateAsync(row.enrollmentId)
      toast({ title: `Removed ${row.name}` })
    } catch {
      toast({ title: 'Failed to remove student' })
    }
  }

  const handleDownloadCsv = () => {
    if (rows.length === 0) {
      toast({ title: 'No customers to export yet' })
      return
    }
    downloadCsv(rows)
    toast({ title: 'CSV downloaded' })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-gray-900">
          Customers ({rows.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            Download CSV
            <FileDownloadOutlined sx={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="relative border-b border-gray-100 px-4 py-3">
          <SearchOutlined
            className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-gray-400"
            fontSize="small"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers"
            className="focus:border-primary w-full rounded-lg border border-transparent bg-transparent py-1.5 pr-3 pl-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-[2.5fr_1fr_1.2fr_0.6fr] gap-4 px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
          <span>Name</span>
          <span>Role</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Loading customers…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {query.trim()
              ? 'No customers match your search.'
              : 'No students enrolled yet.'}
          </div>
        ) : (
          visibleRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[2.5fr_1fr_1.2fr_0.6fr] items-center gap-4 border-t border-gray-100 px-6 py-4 text-sm text-gray-900"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={row.name}
                  avatar_url={row.avatar_url}
                  className="h-10 w-10 text-sm"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-gray-900">
                    {row.name}
                  </span>
                  <span className="truncate text-xs text-gray-500">
                    {row.email}
                  </span>
                </div>
              </div>
              <span className="text-gray-700">{row.role}</span>
              <span className="text-gray-700">{formatDate(row.joined)}</span>
              <span className="flex justify-end">
                {row.role === 'Student' && row.enrollmentId && (
                  <button
                    onClick={() => handleRemove(row)}
                    disabled={revoke.isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Remove student"
                  >
                    <DeleteOutlineOutlined sx={{ fontSize: 14 }} />
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
