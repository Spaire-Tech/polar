'use client'

import {
  useCustomerCourse,
  useMarkLessonComplete,
  type CustomerCourseDetail,
  type CustomerLessonRead,
  type CustomerModuleRead,
  type LessonAttachment,
} from '@/hooks/queries/courses'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { HlsVideo } from '@/components/Courses/HlsVideo'
import { QuizPlayer } from '@/components/Courses/QuizPlayer'
import { CommentThread } from './CommentThread'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  const isComplete = progress.total_lessons > 0 && progress.completion_percent === 100

  const firstName = data.customer_name
    ? data.customer_name.split(' ')[0]
    : null

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-10">
      <Link
        href={backHref}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700"
      >
        <ArrowBackOutlined fontSize="small" />
        My Courses
      </Link>

      {/* Completion celebration */}
      {isComplete && (
        <div className="mb-8 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border border-blue-100">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <EmojiEventsOutlined className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Course complete!</p>
            <p className="text-sm text-gray-500">
              You've finished every lesson. Great work.
            </p>
          </div>
        </div>
      )}

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
              className={twMerge(
                'h-full rounded-full transition-all duration-500',
                isComplete ? 'bg-green-500' : 'bg-blue-500',
              )}
              style={{ width: `${progress.completion_percent}%` }}
            />
          </div>
        </div>
      )}

      {firstIncomplete && !isComplete && (
        <button
          onClick={() => onStartLesson(firstIncomplete)}
          className="mb-10 inline-flex items-center gap-x-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          {hasStarted ? 'Continue' : 'Start course'}
          <ArrowForwardOutlined fontSize="small" />
        </button>
      )}

      {isComplete && allLessons.length > 0 && (
        <button
          onClick={() => onStartLesson(allLessons[0])}
          className="mb-10 inline-flex items-center gap-x-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Review course
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

  useEffect(() => {
    setPlaying(false)
  }, [lesson.id])

  const thumbnailSrc =
    lesson.thumbnail_url ??
    (lesson.mux_playback_id
      ? `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
      : null)

  if (lesson.mux_playback_id && lesson.mux_status === 'ready') {
    if (playing) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <HlsVideo
            playbackId={lesson.mux_playback_id}
            poster={thumbnailSrc}
            autoPlay
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

  if (lesson.content_type === 'video' && lesson.mux_playback_id) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100">
        {thumbnailSrc && (
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="h-full w-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm text-gray-500">Video processing…</span>
        </div>
      </div>
    )
  }

  if (thumbnailSrc) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-900">
        <img
          src={thumbnailSrc}
          alt={lesson.title}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return null
}

const NextLessonPrompt = ({
  nextLesson,
  onNext,
}: {
  nextLesson: CustomerLessonRead
  onNext: () => void
}) => (
  <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Up next
      </p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">
        {nextLesson.title}
      </p>
    </div>
    <button
      onClick={onNext}
      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
    >
      Next lesson
      <ArrowForwardOutlined fontSize="small" />
    </button>
  </div>
)

const LessonViewer = ({
  lesson,
  lessonIndex,
  totalLessons,
  nextLesson,
  isPending,
  justCompleted,
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
  nextLesson: CustomerLessonRead | null
  isPending: boolean
  justCompleted: boolean
  onBack: () => void
  onPrev: () => void
  onNext: () => void
  onMarkComplete: () => void
  courseId: string
  token: string
}) => {
  const isQuiz = lesson.content_type === 'quiz'
  const hasThumbnailOrVideo =
    !isQuiz && (lesson.thumbnail_url !== null || lesson.mux_playback_id !== null)
  const textContent = isQuiz ? '' : lesson.content?.text ?? ''
  const attachments = (lesson.content?.attachments as LessonAttachment[] | undefined) ?? []

  return (
    <div className="mx-auto max-w-3xl py-6 sm:py-8">
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-x-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowBackOutlined fontSize="small" />
          <span className="hidden sm:inline">Back to course</span>
          <span className="sm:hidden">Back</span>
        </button>

        <div className="flex items-center gap-x-2">
          <span className="text-sm text-gray-400">
            <span className="hidden sm:inline">Lesson </span>
            {lessonIndex + 1} / {totalLessons}
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{lesson.title}</h1>
        <button
          onClick={onMarkComplete}
          disabled={lesson.completed || isPending}
          className={twMerge(
            'flex shrink-0 items-center gap-x-1.5 self-start rounded-xl px-4 py-2 text-sm font-medium transition-colors',
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
        <div className="mb-8 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:rounded-xl prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <MemoizedMarkdown content={textContent} />
        </div>
      )}

      {/* Quiz */}
      {isQuiz && (
        <div className="mb-8">
          <QuizPlayer
            lesson={lesson}
            token={token}
            courseId={courseId}
            onPassed={onMarkComplete}
          />
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Downloads
          </h3>
          <div className="flex flex-col gap-2">
            {attachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <AttachFileOutlined
                  sx={{ fontSize: 18 }}
                  className="text-gray-400"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {a.filename}
                  </p>
                  <p className="text-xs text-gray-400">{formatBytes(a.size)}</p>
                </div>
                <DownloadOutlined
                  sx={{ fontSize: 18 }}
                  className="text-gray-400 group-hover:text-gray-700"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Next lesson prompt (shows after marking complete) */}
      {justCompleted && nextLesson && (
        <div className="mb-8">
          <NextLessonPrompt nextLesson={nextLesson} onNext={onNext} />
        </div>
      )}

      {/* Comment thread */}
      <div className="mt-6 border-t border-gray-100 pt-8">
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
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)

  const allLessons =
    data?.course.modules.flatMap((m) => (m.locked ? [] : m.lessons)) ?? []

  const currentLesson =
    allLessons.find((l) => l.id === selectedLessonId) ?? null
  const lessonIndex = currentLesson
    ? allLessons.findIndex((l) => l.id === currentLesson.id)
    : -1
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < allLessons.length - 1
      ? allLessons[lessonIndex + 1]
      : null

  const handleSelectLesson = (lesson: CustomerLessonRead) => {
    setSelectedLessonId(lesson.id)
    setJustCompletedId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lesson', lesson.id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleBack = () => {
    setSelectedLessonId(null)
    setJustCompletedId(null)
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
    if (!currentLesson || currentLesson.completed) return
    markComplete.mutate(currentLesson.id, {
      onSuccess: () => setJustCompletedId(currentLesson.id),
    })
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
        nextLesson={nextLesson}
        isPending={markComplete.isPending}
        justCompleted={justCompletedId === currentLesson.id}
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default LessonViewerPage
