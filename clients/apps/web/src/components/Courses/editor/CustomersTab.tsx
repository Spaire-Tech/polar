'use client'

import {
  useCourseEnrollments,
} from '@/hooks/queries/courses'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { useState } from 'react'

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function CustomersTab({
  organization,
  courseId,
}: {
  organization: schemas['Organization']
  courseId: string
}) {
  const [query, setQuery] = useState('')
  const { data: enrollments, isLoading } = useCourseEnrollments(courseId)

  const rows = (enrollments ?? []).filter((e) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      (e.customer.email ?? '').toLowerCase().includes(q) ||
      (e.customer.name ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-gray-900">
          Students ({enrollments?.length ?? 0})
        </h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700">
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
            placeholder="Search students"
            className="focus:border-primary w-full rounded-lg border border-transparent bg-transparent py-1.5 pr-3 pl-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-[2fr_1.5fr_1fr] gap-4 px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
          <span>Student</span>
          <span>Email</span>
          <span>Enrolled</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {query ? 'No students match your search.' : 'No students enrolled yet.'}
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.enrollment_id}
              className="grid grid-cols-[2fr_1.5fr_1fr] items-center gap-4 border-t border-gray-100 px-6 py-4 text-sm text-gray-900"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={row.customer.name ?? row.customer.email ?? '?'}
                  avatar_url={null}
                  className="h-9 w-9 text-sm"
                />
                <span className="truncate font-medium text-gray-900">
                  {row.customer.name ?? row.customer.email?.split('@')[0] ?? '—'}
                </span>
              </div>
              <span className="truncate text-gray-600">
                {row.customer.email ?? '—'}
              </span>
              <span className="text-gray-500">
                {formatDate(row.enrolled_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
