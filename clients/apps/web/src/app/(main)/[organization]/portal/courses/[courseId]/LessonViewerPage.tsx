'use client'

import {
  useCustomerCourse,
  useMarkLessonComplete,
  type CustomerCourseDetail,
  type CustomerLessonRead,
  type CustomerModuleRead,
} from '@/hooks/queries/courses'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { CommentThread } from './CommentThread'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// --- Course overview ---

const ModuleRowOverview = ({
  module,
  onSelectLesson,
}: {
  module: CustomerModuleRead
  onSelectLesson: (lesson: CustomerLessonRead) => void
}) => {
  const completedCount = module.lessons.filter((l) => l.completed).length
  const [open, setOpen] = useState(false)

  if (module.locked) {
    const label = module.locked_until
      ? `Unlocks ${new Date(module.locked_until).toLocaleDateString()}`
      : 'Locked'
    return (
      <div className="border-b border-gray-100 last:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 text-sm">
          <div className="flex items-center gap-x-3 text-gray-400">
            <LockOutlined sx={{ fontSize: 16 }} />
            <span className="font-medium">{module.title}</span>
          </div>
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-x-3">
          <ExpandMoreOutlined
            fontSize="small"
            className={twMerge(
              'flex-none text-gray-400 transition-transform',
              open && 'rotate-180',
            )}
          />
          <div>
            <p className="text-sm font-medium text-gray-900">{module.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {completedCount}/{module.lessons.length} completed
            </p>
          </div>
        </div>
      </button>
      {open && (
        <div className="pb-2">
          {module.lessons.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson)}
              className="flex w-full items-center gap-x-3 px-5 py-2.5 text-left text-sm hover:bg-gray-50"
            >
              {lesson.completed ? (
                <CheckCircle sx={{ fontSize: 18 }} className="flex-none text-blue-500" />
              ) : (
                <CheckCircleOutlined sx={{ fontSize: 18 }} className="flex-none text-gray-300" />
              )}
              <span className="flex-1 text-gray-700">{lesson.title}</span>
              {lesson.duration_seconds && (
                <span className="text-xs text-gray-400">
                  {Math.ceil(lesson.duration_seconds / 60)}m
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const CourseOverview = ({
  data,
  backHref,
  onStartLesson,
}: {
  data: CustomerCourseDetail
  backHref: string
  onStartLesson: (lesson: CustomerLessonRead) => void
}) => {
  const allLessons = data.course.modules.flatMap((m) =>
    m.locked ? [] : m.lessons,
  )
  const firstIncomplete = allLessons.find((l) => !l.completed) ?? allLessons[0]
  const progress = data.progress
  const hasStarted = progress.completed_lessons > 0

  const firstName = data.customer_name
    ? data.customer_name.split(' ')[0]
    : null

  return (
    <div className="mx-auto max-w-2xl py-10 px-4">
      <Link
        href={backHref}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700"
      >
        <ArrowBackOutlined fontSize="small" />
        My Courses
      </Link>

      <div className="mb-2">
        <h1 className="text-3xl font-semibold text-gray-900">
          Welcome{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-1.5 text-gray-500">{data.course.title}</p>
      </div>

      {progress.total_lessons > 0 && (
        <div className="mt-6 mb-8">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
            <span>
              {progress.completed_lessons} of {progress.total_lessons} lessons
              completed
            </span>
            <span className="font-medium text-gray-700">
              {progress.completion_percent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress.completion_percent}%` }}
            />
          </div>
        </div>
      )}

      {firstIncomplete && (
        <button
          onClick={() => onStartLesson(firstIncomplete)}
          className="mb-10 inline-flex items-center gap-x-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          {hasStarted ? 'Continue' : 'Start course'}
          <ArrowForwardOutlined fontSize="small" />
        </button>
      )}

      <h2 className="mb-3 text-base font-semibold text-gray-900">
        Course content
      </h2>
      <div className="overflow-hidden rounded-2xl border border-gray-200">
        {data.course.modules.map((module) => (
          <ModuleRowOverview
            key={module.id}
            module={module}
            onSelectLesson={onStartLesson}
          />
        ))}
      </div>
    </div>
  )
}

// --- Lesson viewer ---

const VideoArea = ({ lesson }: { lesson: CustomerLessonRead }) => {
  const [playing, setPlaying] = useState(false)

  const thumbnailSrc =
    lesson.thumbnail_url ??
    (lesson.mux_playback_id
      ? `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
      : null)

  if (lesson.mux_playback_id && lesson.mux_status === 'ready') {
    if (playing) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <video
            autoPlay
            controls
            className="h-full w-full"
            src={`https://stream.mux.com/${lesson.mux_playback_id}.m3u8`}
          />
        </div>
      )
    }
    return (
      <button
        onClick={() => setPlaying(true)}
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-900"
      >
        {thumbnailSrc && (
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="h-full w-full object-cover opacity-80 group-hover:opacity-90 transition-opacity"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-105">
            <PlayArrow sx={{ fontSize: 36 }} className="ml-1 text-blue-600" />
          </div>
        </div>
      </button>
    )
  }

  if (thumbnailSrc) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-900">
        <img
          src={thumbnailSrc}
          alt={lesson.title}
          className="h-full w-full object-cover opacity-70"
        />
        {lesson.content_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/60 px-4 py-2 text-sm text-white">
              Video processing…
            </span>
          </div>
        )}
      </div>
    )
  }

  return null
}

const LessonViewer = ({
  lesson,
  lessonIndex,
  totalLessons,
  isPending,
  onBack,
  onPrev,
  onNext,
  onMarkComplete,
  courseId,
  token,
}: {
  lesson: CustomerLessonRead
  lessonIndex: number
  totalLessons: number
  isPending: boolean
  onBack: () => void
  onPrev: () => void
  onNext: () => void
  onMarkComplete: () => void
  courseId: string
  token: string
}) => {
  const hasThumbnailOrVideo =
    lesson.thumbnail_url ||
    (lesson.mux_playback_id !== null)
  const textContent = lesson.content?.text ?? ''

  return (
    <div className="mx-auto max-w-3xl py-8 px-4">
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-x-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowBackOutlined fontSize="small" />
          Back to course
        </button>

        <div className="flex items-center gap-x-2">
          <span className="text-sm text-gray-400">
            Lesson {lessonIndex + 1} of {totalLessons}
          </span>
          <button
            onClick={onPrev}
            disabled={lessonIndex === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
          >
            <ArrowBackOutlined fontSize="small" />
          </button>
          <button
            onClick={onNext}
            disabled={lessonIndex === totalLessons - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
          >
            <ArrowForwardOutlined fontSize="small" />
          </button>
        </div>
      </div>

      {/* Video / thumbnail */}
      {hasThumbnailOrVideo && (
        <div className="mb-8">
          <VideoArea lesson={lesson} />
        </div>
      )}

      {/* Lesson header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{lesson.title}</h1>
        <button
          onClick={onMarkComplete}
          disabled={lesson.completed || isPending}
          className={twMerge(
            'flex shrink-0 items-center gap-x-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            lesson.completed
              ? 'bg-green-50 text-green-700 cursor-default'
              : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50',
          )}
        >
          {lesson.completed ? (
            <>
              <CheckCircle sx={{ fontSize: 16 }} />
              Completed
            </>
          ) : (
            <>
              <CheckCircleOutlined sx={{ fontSize: 16 }} />
              {isPending ? 'Saving…' : 'Mark complete'}
            </>
          )}
        </button>
      </div>

      {/* Text content */}
      {textContent.trim() && (
        <div className="mb-10 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:rounded-xl prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <MemoizedMarkdown content={textContent} />
        </div>
      )}

      {/* Comment thread */}
      <div className="mt-10 border-t border-gray-100 pt-8">
        <CommentThread
          token={token}
          courseId={courseId}
          lessonId={lesson.id}
        />
      </div>
    </div>
  )
}

// --- Page orchestrator ---

const LessonViewerPage = ({
  organization,
  courseId,
  customerSessionToken,
  initialLessonId,
}: {
  organization: schemas['CustomerOrganization']
  courseId: string
  customerSessionToken: string
  initialLessonId?: string
}) => {
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

  const allLessons =
    data?.course.modules.flatMap((m) => (m.locked ? [] : m.lessons)) ?? []

  const currentLesson =
    allLessons.find((l) => l.id === selectedLessonId) ?? null
  const lessonIndex = currentLesson
    ? allLessons.findIndex((l) => l.id === currentLesson.id)
    : -1

  const handleSelectLesson = (lesson: CustomerLessonRead) => {
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

  const handlePrev = () => {
    if (lessonIndex > 0) handleSelectLesson(allLessons[lessonIndex - 1])
  }

  const handleNext = () => {
    if (lessonIndex < allLessons.length - 1)
      handleSelectLesson(allLessons[lessonIndex + 1])
  }

  const handleMarkComplete = () => {
    if (currentLesson) markComplete.mutate(currentLesson.id)
  }

  const backHref = `/${organization.slug}/portal/courses?${searchParams.toString()}`

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-red-600">
        Could not load course. You may not have access.
      </div>
    )
  }

  if (currentLesson) {
    return (
      <LessonViewer
        lesson={currentLesson}
        lessonIndex={lessonIndex}
        totalLessons={allLessons.length}
        isPending={markComplete.isPending}
        onBack={handleBack}
        onPrev={handlePrev}
        onNext={handleNext}
        onMarkComplete={handleMarkComplete}
        courseId={courseId}
        token={customerSessionToken}
      />
    )
  }

  return (
    <CourseOverview
      data={data}
      backHref={backHref}
      onStartLesson={handleSelectLesson}
    />
  )
}

export default LessonViewerPage
