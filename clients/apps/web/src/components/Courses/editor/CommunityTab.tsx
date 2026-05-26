'use client'

import { CommunityPreview } from '@/components/Community/CommunityPreview'
import { type CourseRead } from '@/hooks/queries/courses'

type Props = {
  course: CourseRead
  organizationSlug: string
}

// Full-page community surface inside the course editor.  Threads the
// org slug so the preview can deep-link into the live customer-portal
// community.
export function CommunityTab({ course, organizationSlug }: Props) {
  return (
    <div className="h-full w-full">
      <CommunityPreview
        courseId={course.id}
        courseTitle={course.title ?? undefined}
        organizationSlug={organizationSlug}
        discussionsKind={course.format === 'series' ? 'episode' : 'module'}
        lessons={
          course.format === 'series'
            ? course.modules.flatMap((m) =>
                (m.lessons ?? []).map((l) => ({
                  id: l.id,
                  label: l.title,
                })),
              )
            : course.modules.map((m) => ({ id: m.id, label: m.title }))
        }
      />
    </div>
  )
}
