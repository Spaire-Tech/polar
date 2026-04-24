'use client'

import {
  useCustomerCourses,
  type CustomerCourseEnrollment,
} from '@/hooks/queries/courses'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const CourseCard = ({
  enrollment,
  organizationSlug,
  token,
}: {
  enrollment: CustomerCourseEnrollment
  organizationSlug: string
  token: string
}) => {
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams.toString())
  const href = `/${organizationSlug}/portal/courses/${enrollment.course.id}?${params.toString()}`

  return (
    <Link
      href={href}
      className="flex flex-col gap-y-3 rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-x-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <AutoStoriesOutlined fontSize="small" />
        </div>
        <h3 className="font-medium text-gray-900">
          {enrollment.course.title ?? 'Untitled Course'}
        </h3>
      </div>
      <div className="flex gap-x-4 text-sm text-gray-500">
        <span>{enrollment.course.module_count} modules</span>
        <span>·</span>
        <span>{enrollment.course.lesson_count} lessons</span>
      </div>
    </Link>
  )
}

const CoursesPage = ({
  organization,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  customerSessionToken: string
}) => {
  const { data: enrollments, isLoading } = useCustomerCourses(
    customerSessionToken,
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-gray-100"
          />
        ))}
      </div>
    )
  }

  if (!enrollments?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
          <AutoStoriesOutlined />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No courses yet</h3>
        <p className="mt-1 text-gray-500">
          Courses you have access to will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-6">
      <h2 className="text-2xl font-medium">My Courses</h2>
      <div className="flex flex-col gap-y-4">
        {enrollments.map((enrollment) => (
          <CourseCard
            key={enrollment.enrollment_id}
            enrollment={enrollment}
            organizationSlug={organization.slug}
            token={customerSessionToken}
          />
        ))}
      </div>
    </div>
  )
}

export default CoursesPage
