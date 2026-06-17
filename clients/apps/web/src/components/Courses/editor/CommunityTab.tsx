'use client'

import { type CourseRead } from '@/hooks/queries/courses'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type Props = {
  course: CourseRead
  organizationSlug: string
}

// The community surface is now a full-page console ("Community Hub - Creator")
// at /dashboard/{org}/courses/{courseId}/community — it carries its own nav,
// hero, and tabs. Entering the editor's Community tab redirects there. This
// replaces the old v5 CommunityPreview embed.
export function CommunityTab({ course, organizationSlug }: Props) {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/dashboard/${organizationSlug}/courses/${course.id}/community`)
  }, [router, organizationSlug, course.id])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  )
}
