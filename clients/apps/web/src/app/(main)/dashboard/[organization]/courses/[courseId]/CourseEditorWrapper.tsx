'use client'

import ProgramEditor from '@/components/Coaching/editor/ProgramEditor'
import CourseEditor from '@/components/Courses/CourseEditor'
import { useCourseById } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useSearchParams } from 'next/navigation'

export default function CourseEditorWrapper({
  organization,
  courseId,
}: {
  organization: schemas['Organization']
  courseId: string
}) {
  const { data: course, isLoading, error } = useCourseById(courseId)
  const searchParams = useSearchParams()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-500">Course not found.</p>
      </div>
    )
  }

  // Coaching programs render the new ProgramEditor in normal use, BUT
  // when a deep link sets ?lesson=... (clicked from the Modules tab),
  // fall through to the original CourseEditor — it has the full lesson
  // detail surface (video upload, content editor, thumbnails) which
  // hasn't been ported into the new design yet. Coaching-friendly
  // labelling on the course editor is a small follow-up.
  if (
    course.program_format === 'coaching' &&
    !searchParams.get('lesson')
  ) {
    return <ProgramEditor organization={organization} course={course} />
  }

  return (
    <CourseEditor
      organization={organization}
      courseId={courseId}
      initialCourse={course}
    />
  )
}
