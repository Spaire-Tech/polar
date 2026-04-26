'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CourseRead, useOrganizationCourses } from '@/hooks/queries/courses'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { List, ListItem } from '@spaire/ui/components/atoms/List'
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

export default function CoursesPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { data: courses, isLoading } = useOrganizationCourses(organization.id)

  const handleCreate = () => {
    router.push(`/dashboard/${organization.slug}/products/new?type=course`)
  }

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

        {isLoading ? (
          <ShadowBoxOnMd>
            <div className="flex flex-col gap-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          </ShadowBoxOnMd>
        ) : !courses?.length ? (
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
        ) : (
          <ShadowBoxOnMd>
            <List size="small">
              {courses.map((course) => (
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
