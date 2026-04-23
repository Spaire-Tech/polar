'use client'

import CourseEditor from '@/components/Courses/CourseEditor'
import { useCourseByProduct } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'

export default function CourseEditorWrapper({
  organization,
  productId,
}: {
  organization: schemas['Organization']
  productId: string
}) {
  const { data: course, isLoading, error } = useCourseByProduct(productId)

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

  return (
    <CourseEditor
      organization={organization}
      productId={productId}
      initialCourse={course}
    />
  )
}
