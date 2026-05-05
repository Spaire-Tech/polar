'use client'

import { useCourseEnrollments } from '@/hooks/queries/courses'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { useMemo, useState } from 'react'

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function CustomersTab({
  organization: _organization,
  courseId,
}: {
  organization: schemas['Organization']
  courseId: string
}) {
  const [query, setQuery] = useState('')
  const { data: enrollments, isLoading } = useCourseEnrollments(courseId)

  const rows = useMemo(() => {
    return (enrollments ?? []).map((e) => {
      const display = e.customer.name?.trim() || e.customer.email.split('@')[0]
      return {
        id: e.id,
        name: display,
        email: e.customer.email,
        joined: e.enrolled_at,
      }
    })
  }, [enrollments])

  const visibleRows = query.trim()
    ? rows.filter(
        (r) =>
          r.email.toLowerCase().includes(query.toLowerCase()) ||
          r.name.toLowerCase().includes(query.toLowerCase()),
      )
    : rows

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-gray-900">
          Customers ({rows.length})
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
            placeholder="Search customers"
            className="focus:border-primary w-full rounded-lg border border-transparent bg-transparent py-1.5 pr-3 pl-8 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-[2.5fr_2fr_1.4fr] gap-4 px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
          <span>Name</span>
          <span>Email</span>
          <span>Enrolled</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Loading customers…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {rows.length === 0
              ? 'No customers yet. Customers who purchase this course will appear here.'
              : 'No customers match your search.'}
          </div>
        ) : (
          visibleRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[2.5fr_2fr_1.4fr] items-center gap-4 border-t border-gray-100 px-6 py-4 text-sm text-gray-900"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={row.name}
                  avatar_url={null}
                  className="h-10 w-10 text-sm"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-gray-900">
                    {row.name}
                  </span>
                </div>
              </div>
              <span className="truncate text-gray-700">{row.email}</span>
              <span className="text-gray-700">{formatDate(row.joined)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
