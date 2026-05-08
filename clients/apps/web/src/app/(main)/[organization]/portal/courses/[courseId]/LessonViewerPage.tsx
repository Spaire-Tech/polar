'use client'

import {
  useCustomerCourse,
  useMarkLessonComplete,
  type CustomerLessonRead,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CoursePortalView } from './CoursePortalView'
import { MasterClassLessonViewer } from './MasterClassLessonViewer'

interface FlatLesson {
  id: string
  title: string
  description?: string | null
  position: number
  duration_seconds?: number | null
  thumbnail_url?: string | null
  thumbnail_object_position?: string | null
  mux_playback_id?: string | null
  mux_playback_url?: string | null
  mux_status?: string | null
  completed: boolean
  is_free_preview: boolean
  locked?: boolean
  locked_until?: string | null
  content_type: string
  content: Record<string, unknown> | null
  comments_mode?: 'visible' | 'hidden' | 'locked'
}

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

  // Source of truth: ?lesson= in the URL. Keeps browser back/forward in sync
  // with the rendered lesson — previously a router.replace built the URL but
  // the React state ignored later searchParams changes, so back-navigation
  // appeared to do nothing while the URL kept drifting.
  const lessonParam = searchParams.get('lesson')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    lessonParam ?? initialLessonId ?? null,
  )

  useEffect(() => {
    const next = searchParams.get('lesson')
    setSelectedLessonId(next)
  }, [searchParams])

  // Flatten lessons from modules into a single array (or use flat lessons if available)
  const flatLessons: FlatLesson[] = data
    ? ((data.course.lessons as FlatLesson[] | undefined) ??
      data.course.modules.flatMap((m) =>
        m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description ?? null,
          position: l.position,
          duration_seconds: l.duration_seconds,
          thumbnail_url: l.thumbnail_url,
          thumbnail_object_position: l.thumbnail_object_position ?? null,
          mux_playback_id: l.mux_playback_id,
          mux_status: l.mux_status,
          completed: l.completed,
          is_free_preview: l.is_free_preview,
          locked: m.locked,
          locked_until: m.locked_until,
          content_type: l.content_type ?? 'text',
          content: l.content ?? null,
        })),
      ))
    : []

  const currentLesson =
    flatLessons.find((l) => l.id === selectedLessonId) ?? null

  const handleSelectLesson = (lesson: FlatLesson) => {
    setSelectedLessonId(lesson.id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lesson', lesson.id)
    // push (not replace) so the browser back button returns to the
    // previous lesson / the course overview instead of blowing past it.
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleBack = () => {
    setSelectedLessonId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('lesson')
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleMarkComplete = () => {
    if (!currentLesson || currentLesson.completed) return
    markComplete.mutate(currentLesson.id)
  }

  const handleSelectCustomerLesson = (lesson: CustomerLessonRead) => {
    const flat = flatLessons.find((l) => l.id === lesson.id)
    if (flat) handleSelectLesson(flat)
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
      <div className="flex min-h-screen items-center justify-center bg-black p-6">
        <div className="max-w-md rounded-xl bg-red-900/30 p-6 text-red-400">
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
          thumbnail_object_position: currentLesson.thumbnail_object_position,
          mux_playback_id: currentLesson.mux_playback_id,
          mux_status: currentLesson.mux_status,
          mux_playback_url: currentLesson.mux_playback_url,
          completed: currentLesson.completed,
          content: currentLesson.content,
          comments_mode: currentLesson.comments_mode,
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
          thumbnail_object_position: l.thumbnail_object_position,
          mux_playback_id: l.mux_playback_id,
        }))}
        courseTitle={data.course.title}
        courseDescription={data.course.description}
        instructorName={data.course.instructor_name ?? organization.name}
        instructorAvatarUrl={organization.avatar_url ?? null}
        totalDurationSeconds={flatLessons.reduce(
          (s, l) => s + (l.duration_seconds ?? 0),
          0,
        )}
        isPending={markComplete.isPending}
        onBack={handleBack}
        onSelectLesson={(lessonId) => {
          const lesson = flatLessons.find((l) => l.id === lessonId)
          if (lesson) handleSelectLesson(lesson)
        }}
        onMarkComplete={handleMarkComplete}
        token={customerSessionToken}
        courseId={courseId}
        organizationSlug={organization.slug}
        customerName={data.customer_name ?? null}
      />
    )
  }

  // No lesson selected — render the redesigned course portal (cinematic
  // hero, Apple-TV-style module rows, achievements + instructor).
  return (
    <CoursePortalView
      data={data}
      organizationName={organization.name}
      onSelectLesson={handleSelectCustomerLesson}
    />
  )
}

export default LessonViewerPage
