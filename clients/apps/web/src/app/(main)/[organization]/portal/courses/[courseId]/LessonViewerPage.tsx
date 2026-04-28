'use client'

import {
  useCustomerCourse,
  useMarkLessonComplete,
  type CustomerCourseDetail,
  type CustomerLessonRead,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MasterClassHero } from './MasterClassHero'
import { MasterClassLessonList, type FlatLesson } from './MasterClassLessonList'
import { MasterClassLessonViewer } from './MasterClassLessonViewer'

interface LessonViewerPageProps {
  organization: schemas['CustomerOrganization']
  courseId: string
  customerSessionToken: string
  initialLessonId?: string
}

const LessonViewerPage = ({
  organization,
  courseId,
  customerSessionToken,
  initialLessonId,
}: LessonViewerPageProps) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data, isLoading, error } = useCustomerCourse(
    customerSessionToken,
    courseId,
  )
  const markComplete = useMarkLessonComplete(customerSessionToken, courseId)

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLessonId ?? null,
  )

  // Flatten lessons from modules into a single array
  const flatLessons: FlatLesson[] = data?.course.lessons ??
    data?.course.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        ...l,
        locked: m.locked,
        locked_until: m.locked_until,
      }))
    ) ??
    []

  const currentLesson = flatLessons.find((l) => l.id === selectedLessonId) ?? null
  const firstIncomplete = flatLessons.find((l) => !l.completed) ?? flatLessons[0]
  const progress = data?.progress
  const hasStarted = progress && progress.completed_lessons > 0
  const isComplete =
    progress && progress.total_lessons > 0 && progress.completion_percent === 100

  const handleSelectLesson = (lesson: FlatLesson) => {
    setSelectedLessonId(lesson.id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lesson', lesson.id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleBack = () => {
    setSelectedLessonId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('lesson')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleMarkComplete = () => {
    if (!currentLesson || currentLesson.completed) return
    markComplete.mutate(currentLesson.id)
  }

  const handleStartClass = () => {
    if (firstIncomplete) {
      handleSelectLesson(firstIncomplete)
    }
  }

  const handleTrailer = () => {
    const trailer = flatLessons.find((l) => l.is_free_preview)
    if (trailer) {
      handleSelectLesson(trailer)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="rounded-xl bg-red-900/30 p-6 text-red-400 max-w-md">
          Could not load course. You may not have access.
        </div>
      </div>
    )
  }

  // Show lesson viewer if a lesson is selected
  if (currentLesson) {
    return (
      <MasterClassLessonViewer
        lesson={{
          id: currentLesson.id,
          title: currentLesson.title,
          content_type: currentLesson.content_type,
          duration_seconds: currentLesson.duration_seconds,
          thumbnail_url: currentLesson.thumbnail_url,
          mux_playback_id: currentLesson.mux_playback_id,
          mux_status: currentLesson.mux_status,
          completed: currentLesson.completed,
          content: currentLesson.content,
        }}
        lessonIndex={flatLessons.findIndex((l) => l.id === currentLesson.id)}
        totalLessons={flatLessons.length}
        lessons={flatLessons.map((l) => ({
          id: l.id,
          title: l.title,
          position: l.position,
          completed: l.completed,
          duration_seconds: l.duration_seconds,
          thumbnail_url: l.thumbnail_url,
          mux_playback_id: l.mux_playback_id,
        }))}
        courseTitle={data.course.title}
        isPending={markComplete.isPending}
        onBack={handleBack}
        onSelectLesson={(lessonId) => {
          const lesson = flatLessons.find((l) => l.id === lessonId)
          if (lesson) handleSelectLesson(lesson)
        }}
        onMarkComplete={handleMarkComplete}
        token={customerSessionToken}
        courseId={courseId}
      />
    )
  }

  // Show landing page (hero + lesson list)
  return (
    <div className="w-full bg-black">
      <MasterClassHero
        courseTitle={data.course.title}
        organizationName={organization.name}
        description={data.course.title ? 'Course description' : null}
        thumbnailUrl={data.course.title ? undefined : null}
        isStarted={hasStarted ?? false}
        totalLessons={progress?.total_lessons ?? flatLessons.length}
        completionPercent={progress?.completion_percent ?? 0}
        onStart={handleStartClass}
        onTrailer={handleTrailer}
      />

      <MasterClassLessonList
        lessons={flatLessons}
        onSelectLesson={handleSelectLesson}
        hasAccess={true}
      />
    </div>
  )
}

export default LessonViewerPage
