'use client'

import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { HlsVideo } from '@/components/Courses/HlsVideo'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { QuizPlayer } from '@/components/Courses/QuizPlayer'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'

export interface MasterClassLessonViewerProps {
  lesson: {
    id: string
    title: string
    content_type: string
    duration_seconds?: number | null
    thumbnail_url?: string | null
    mux_playback_id?: string | null
    mux_status?: string | null
    completed: boolean
    content?: Record<string, unknown> | null
  }
  lessonIndex: number
  totalLessons: number
  lessons: Array<{
    id: string
    title: string
    position: number
    completed: boolean
    duration_seconds?: number | null
    thumbnail_url?: string | null
    mux_playback_id?: string | null
  }>
  courseTitle: string | null
  isPending: boolean
  onBack: () => void
  onSelectLesson: (lessonId: string) => void
  onMarkComplete: () => void
  token: string
  courseId: string
}

export const MasterClassLessonViewer = ({
  lesson,
  lessonIndex,
  totalLessons,
  lessons,
  courseTitle,
  isPending,
  onBack,
  onSelectLesson,
  onMarkComplete,
  token,
  courseId,
}: MasterClassLessonViewerProps) => {
  const [playing, setPlaying] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    setPlaying(false)
  }, [lesson.id])

  const thumbnailSrc =
    lesson.thumbnail_url ||
    (lesson.mux_playback_id
      ? `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
      : null)

  const isQuiz = lesson.content_type === 'quiz'
  const textContent = isQuiz ? '' : (lesson.content as any)?.text ?? ''
  const attachments = (lesson.content as any)?.attachments ?? []

  const renderVideoArea = () => {
    if (lesson.mux_playback_id && lesson.mux_status === 'ready') {
      if (playing) {
        return (
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
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
          className="group relative aspect-video w-full overflow-hidden rounded-xl bg-gray-900"
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
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-900">
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

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Mobile sidebar toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 hover:bg-white/10 rounded"
      >
        <ExpandMoreOutlined
          sx={{ fontSize: 24 }}
          className={twMerge(
            'transition-transform',
            sidebarOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Main player area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Back button + nav */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowBackOutlined sx={{ fontSize: 20 }} />
            <span className="hidden sm:inline text-sm">Back to Course</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {lessonIndex + 1} / {totalLessons}
          </div>
        </div>

        {/* Video + content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {renderVideoArea()}

            <div className="mt-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <h1 className="text-2xl md:text-3xl font-bold">{lesson.title}</h1>
                <button
                  onClick={onMarkComplete}
                  disabled={lesson.completed || isPending}
                  className={twMerge(
                    'flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    lesson.completed
                      ? 'bg-green-900/30 text-green-400 cursor-default'
                      : 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-50'
                  )}
                >
                  {lesson.completed ? (
                    <>
                      <CheckCircle sx={{ fontSize: 18 }} />
                      Completed
                    </>
                  ) : (
                    <>
                      <CheckCircleOutlined sx={{ fontSize: 18 }} />
                      {isPending ? 'Saving…' : 'Mark complete'}
                    </>
                  )}
                </button>
              </div>

              {/* Text content */}
              {textContent && !isQuiz && (
                <div className="prose prose-invert max-w-none mb-8">
                  <MemoizedMarkdown content={textContent} />
                </div>
              )}

              {/* Quiz */}
              {isQuiz && (
                <div className="mb-8">
                  <QuizPlayer
                    lesson={lesson as any}
                    token={token}
                    courseId={courseId}
                    onPassed={onMarkComplete}
                  />
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-3 text-lg font-semibold">Downloads</h3>
                  <div className="flex flex-col gap-2">
                    {attachments.map((a: any) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 hover:border-white/20 hover:bg-white/5 transition-colors"
                      >
                        <AttachFileOutlined
                          sx={{ fontSize: 18 }}
                          className="text-gray-400"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">
                            {a.filename}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatBytes(a.size)}
                          </p>
                        </div>
                        <DownloadOutlined
                          sx={{ fontSize: 18 }}
                          className="text-gray-400 group-hover:text-gray-300"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - lesson list */}
      <div
        className={twMerge(
          'w-80 border-l border-white/10 flex flex-col bg-black/50 backdrop-blur-sm transition-all duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full fixed right-0 top-0 h-full md:static'
        )}
      >
        <div className="p-4 md:p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold mb-2">{courseTitle}</h2>
          <p className="text-xs text-gray-400">{lessons.length} lessons</p>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-3 space-y-1">
            {lessons.map((l, idx) => (
              <button
                key={l.id}
                onClick={() => {
                  onSelectLesson(l.id)
                  setSidebarOpen(false)
                }}
                className={twMerge(
                  'w-full text-left p-3 rounded-lg transition-colors text-sm',
                  lesson.id === l.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <div className="flex items-start gap-2">
                  {l.completed ? (
                    <CheckCircle
                      sx={{ fontSize: 16 }}
                      className="flex-shrink-0 mt-0.5 text-green-500"
                    />
                  ) : (
                    <CheckCircleOutlined
                      sx={{ fontSize: 16 }}
                      className="flex-shrink-0 mt-0.5 text-gray-600"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{idx + 1}. {l.title}</p>
                    {l.duration_seconds && (
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.ceil(l.duration_seconds / 60)}m
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
