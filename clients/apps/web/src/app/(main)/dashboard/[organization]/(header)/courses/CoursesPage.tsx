'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CourseRead, useOrganizationCourses } from '@/hooks/queries/courses'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { List, ListItem } from '@spaire/ui/components/atoms/List'
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

function CourseCard({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const moduleCount = course.modules.length
  const lessonCount = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)

  return (
    <Link href={`/dashboard/${organization.slug}/courses/${course.id}`}>
      <ListItem className="flex flex-row items-center justify-between gap-x-6">
        <div className="flex min-w-0 grow flex-row items-center gap-x-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <AutoStoriesOutlined className="text-blue-500" fontSize="small" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-gray-900">
              {course.title ?? 'Untitled Course'}
            </span>
            <span className="text-xs text-gray-400">
              {moduleCount} module{moduleCount !== 1 ? 's' : ''} ·{' '}
              {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {course.ai_generated ? 'AI Generated' : 'Manual'}
          </span>
        </div>
      </ListItem>
    </Link>
  )
}

type SortOption = 'recent' | 'oldest' | 'title'
type FilterOption = 'all' | 'ai' | 'manual'

export default function CoursesPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { data: courses, isLoading } = useOrganizationCourses(organization.id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterOption>('all')
  const [sort, setSort] = useState<SortOption>('recent')

  const handleCreate = () => {
    router.push(`/dashboard/${organization.slug}/products/new?type=course`)
  }

  const filtered = useMemo(() => {
    if (!courses) return []
    const trimmed = query.trim().toLowerCase()
    let out = courses
    if (trimmed) {
      out = out.filter((c) =>
        (c.title ?? 'Untitled Course').toLowerCase().includes(trimmed),
      )
    }
    if (filter === 'ai') out = out.filter((c) => c.ai_generated)
    else if (filter === 'manual') out = out.filter((c) => !c.ai_generated)
    const sorted = [...out]
    if (sort === 'recent') {
      sorted.sort((a, b) =>
        (b.modified_at ?? b.created_at ?? '').localeCompare(
          a.modified_at ?? a.created_at ?? '',
        ),
      )
    } else if (sort === 'oldest') {
      sorted.sort((a, b) =>
        (a.created_at ?? '').localeCompare(b.created_at ?? ''),
      )
    } else {
      sorted.sort((a, b) =>
        (a.title ?? 'Untitled Course').localeCompare(
          b.title ?? 'Untitled Course',
        ),
      )
    }
    return sorted
  }, [courses, query, filter, sort])

  const showEmptyOriginal = !isLoading && !courses?.length
  const showNoMatches =
    !isLoading && (courses?.length ?? 0) > 0 && filtered.length === 0

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create and manage your course content
            </p>
          </div>
          <Button onClick={handleCreate} wrapperClassNames="gap-x-2">
            <AutoStoriesOutlined className="h-4 w-4" />
            <span>New Course</span>
          </Button>
        </div>

        {!showEmptyOriginal && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <SearchOutlined className="text-gray-400" sx={{ fontSize: 16 }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses…"
                className="flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="ai">AI Generated</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="recent">Recently updated</option>
              <option value="oldest">Oldest first</option>
              <option value="title">A → Z</option>
            </select>
          </div>
        )}

        {isLoading ? (
          <ShadowBoxOnMd>
            <div className="flex flex-col gap-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          </ShadowBoxOnMd>
        ) : showEmptyOriginal ? (
          <div className="flex flex-col items-center justify-center gap-6 py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <AutoStoriesOutlined className="text-blue-500" sx={{ fontSize: 32 }} />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">No courses yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Create your first course to get started
              </p>
            </div>
            <Button onClick={handleCreate}>
              Create Your First Course
            </Button>
          </div>
        ) : showNoMatches ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-gray-900">
              No courses match your filters
            </p>
            <p className="text-xs text-gray-500">
              Try a different search or clear the filter.
            </p>
          </div>
        ) : (
          <ShadowBoxOnMd>
            <List size="small">
              {filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  organization={organization}
                />
              ))}
            </List>
          </ShadowBoxOnMd>
        )}
      </div>
    </DashboardBody>
  )
}
