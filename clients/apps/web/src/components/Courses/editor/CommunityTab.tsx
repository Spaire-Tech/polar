'use client'

import { CommunityPreview } from '@/components/Community/CommunityPreview'
import { type CourseRead } from '@/hooks/queries/courses'

type Props = {
  course: CourseRead
}

// Full-page community surface inside the course editor. The split-pane
// settings panel that used to live here has moved into the community
// itself as a `settings` tab (rendered when LeftRail.view === 'settings').
// CommunityPreview already gates everything on the host identity, so the
// editor route just hands it the course context and lets it own the page.
export function CommunityTab({ course }: Props) {
  return (
    <div className="h-full w-full">
      <CommunityPreview
        courseId={course.id}
        courseTitle={course.title ?? undefined}
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
