'use client'

import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import BookmarkBorderOutlined from '@mui/icons-material/BookmarkBorderOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import IosShareOutlined from '@mui/icons-material/IosShareOutlined'
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { HlsVideo } from '@/components/Courses/HlsVideo'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { QuizPlayer } from '@/components/Courses/QuizPlayer'
import {
  useLessonNote,
  useUpsertLessonNote,
} from '@/hooks/queries/courses'

export interface MasterClassLessonViewerProps {
  lesson: {
    id: string
    title: string
    content_type: string
    duration_seconds?: number | null
    thumbnail_url?: string | null
    thumbnail_object_position?: string | null
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
    thumbnail_object_position?: string | null
    mux_playback_id?: string | null
  }>
  courseTitle: string | null
  courseDescription: string | null
  instructorName: string | null
  instructorAvatarUrl: string | null
  totalDurationSeconds: number
  isPending: boolean
  onBack: () => void
  onSelectLesson: (lessonId: string) => void
  onMarkComplete: () => void
  token: string
  courseId: string
}

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

const formatTotalDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}

export const MasterClassLessonViewer = ({
  lesson,
  lessonIndex,
  totalLessons,
  lessons,
  courseTitle,
  courseDescription,
  instructorName,
  instructorAvatarUrl,
  totalDurationSeconds,
  isPending,
  onBack,
  onSelectLesson,
  onMarkComplete,
  token,
  courseId,
}: MasterClassLessonViewerProps) => {
  const [playing, setPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState<'lessons' | 'notes'>('lessons')
  const [noteText, setNoteText] = useState('')
  const [showAllNotes, setShowAllNotes] = useState(false)
  const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: savedNote } = useLessonNote(token, courseId, lesson.id)
  const upsertNote = useUpsertLessonNote(token, courseId, lesson.id)

  useEffect(() => {
    setPlaying(false)
    setNoteText('')
  }, [lesson.id])

  useEffect(() => {
    if (savedNote !== undefined) {
      setNoteText(savedNote?.content ?? '')
    }
  }, [savedNote, lesson.id])

  const handleNoteChange = (text: string) => {
    setNoteText(text)
    if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current)
    noteDebounceRef.current = setTimeout(() => {
      upsertNote.mutate(text)
    }, 800)
  }

  const thumbnailSrc =
    lesson.thumbnail_url ||
    (lesson.mux_playback_id
      ? `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
      : null)

  const isQuiz = lesson.content_type === 'quiz'
  const textContent = isQuiz ? '' : (lesson.content as any)?.text ?? ''
  const attachments: any[] = (lesson.content as any)?.attachments ?? []
  const firstAttachment = attachments[0] ?? null

  const renderVideoArea = () => {
    if (lesson.mux_playback_id && lesson.mux_status === 'ready') {
      if (playing) {
        return (
          <div className="w-full bg-black" style={{ aspectRatio: '16/9' }}>
            <HlsVideo
              playbackId={lesson.mux_playback_id}
              poster={thumbnailSrc ?? undefined}
              autoPlay
            />
          </div>
        )
      }
      return (
        <button
          onClick={() => setPlaying(true)}
          className="group relative w-full bg-gray-900"
          style={{ aspectRatio: '16/9', display: 'block' }}
        >
          {thumbnailSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailSrc}
              alt={lesson.title}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: lesson.thumbnail_object_position ?? '50% 50%' }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform group-hover:scale-105">
              <PlayArrow sx={{ fontSize: 30 }} className="ml-0.5 text-blue-600" />
            </div>
          </div>
        </button>
      )
    }

    if (thumbnailSrc) {
      return (
        <div className="relative w-full bg-gray-900" style={{ aspectRatio: '16/9' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: lesson.thumbnail_object_position ?? '50% 50%' }}
          />
        </div>
      )
    }

    return (
      <div className="w-full bg-gray-900" style={{ aspectRatio: '16/9' }} />
    )
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#0a0a0a', color: '#fff' }}
    >
      {/* ── Left: player area ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex flex-shrink-0 items-center justify-between"
          style={{
            padding: '0 24px',
            height: 52,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,0.55)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')
            }
          >
            <ArrowBackOutlined sx={{ fontSize: 18 }} />
            Back to Course
          </button>
          <span
            className="text-sm"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {lessonIndex + 1} / {totalLessons}
          </span>
        </div>

        {/* Video */}
        {renderVideoArea()}

        {/* Below video: title + actions */}
        <div className="flex-1 overflow-auto">
          <div style={{ padding: '20px 28px 32px' }}>
            <h1
              className="font-bold"
              style={{ fontSize: 20, lineHeight: 1.35, marginBottom: 6 }}
            >
              {lesson.title}
            </h1>

            {textContent && !isQuiz && (
              <div
                className="prose prose-invert max-w-none"
                style={{ marginTop: 16, marginBottom: 24 }}
              >
                <MemoizedMarkdown content={textContent} />
              </div>
            )}

            {isQuiz && (
              <div style={{ marginTop: 16, marginBottom: 24 }}>
                <QuizPlayer
                  lesson={lesson as any}
                  token={token}
                  courseId={courseId}
                  onPassed={onMarkComplete}
                />
              </div>
            )}

            {/* Action bar: Share | Class Guide | Bookmark */}
            <div
              className="flex items-center gap-2"
              style={{ marginTop: 20 }}
            >
              <ActionButton icon={<IosShareOutlined sx={{ fontSize: 18 }} />} label="Share" />
              {firstAttachment ? (
                <a
                  href={firstAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <ActionButton
                    icon={<DownloadOutlined sx={{ fontSize: 18 }} />}
                    label="Class Guide"
                  />
                </a>
              ) : (
                <ActionButton
                  icon={<MenuBookOutlined sx={{ fontSize: 18 }} />}
                  label="Class Guide"
                  disabled
                />
              )}
              <ActionButton icon={<BookmarkBorderOutlined sx={{ fontSize: 18 }} />} label="Bookmark" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: sidebar ──────────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0 flex-col"
        style={{
          width: 340,
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          background: '#0a0a0a',
        }}
      >
        {/* Sidebar header card */}
        <div
          style={{
            padding: '14px 16px',
            background: '#1a1a1a',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                background: '#333',
              }}
            >
              {instructorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={instructorAvatarUrl}
                  alt={instructorName ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-sm font-semibold"
                  style={{ color: '#fff' }}
                >
                  {(instructorName ?? '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p
                className="font-semibold"
                style={{ fontSize: 14, color: '#fff', lineHeight: 1.2 }}
              >
                {instructorName}
              </p>
              <p
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}
              >
                {courseTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex flex-shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#1a1a1a',
          }}
        >
          {(['lessons', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '11px 0',
                fontSize: 13,
                fontWeight: 500,
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #e63946' : '2px solid transparent',
                transition: 'color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'lessons' ? 'All Lessons' : 'My Notes'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'lessons' ? (
            <div>
              {/* Course stats */}
              <div style={{ padding: '14px 16px 8px' }}>
                {courseDescription && (
                  <p
                    style={{
                      fontSize: 12.5,
                      color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    {courseDescription}
                  </p>
                )}
                <p
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                  {totalDurationSeconds > 0 &&
                    ` • ${formatTotalDuration(totalDurationSeconds)}`}
                </p>
              </div>

              {/* Lesson list */}
              {lessons.map((l, idx) => {
                const isActive = lesson.id === l.id
                const thumb =
                  l.thumbnail_url ||
                  (l.mux_playback_id
                    ? `https://image.mux.com/${l.mux_playback_id}/thumbnail.jpg?time=0`
                    : null)

                return (
                  <button
                    key={l.id}
                    onClick={() => onSelectLesson(l.id)}
                    className="flex w-full items-start gap-3 text-left transition-colors"
                    style={{
                      padding: '10px 14px',
                      background: isActive
                        ? 'rgba(255,255,255,0.06)'
                        : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        e.currentTarget.style.background =
                          'rgba(255,255,255,0.03)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative flex-shrink-0 overflow-hidden rounded"
                      style={{ width: 110, aspectRatio: '16/9', background: '#1c1c1c' }}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={l.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{
                            objectPosition:
                              l.thumbnail_object_position ?? '50% 50%',
                          }}
                        />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                      {isActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
                            <PlayArrow sx={{ fontSize: 14 }} className="ml-px text-black" />
                          </div>
                        </div>
                      )}
                      {l.duration_seconds ? (
                        <div
                          className="absolute bottom-1 right-1 rounded px-1 text-white"
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            background: 'rgba(0,0,0,0.8)',
                          }}
                        >
                          {formatDuration(l.duration_seconds)}
                        </div>
                      ) : null}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0" style={{ paddingTop: 2 }}>
                      <p
                        className={twMerge(
                          'text-xs font-medium leading-snug',
                          isActive ? 'text-white' : 'text-white/55',
                        )}
                      >
                        {idx + 1}. {l.title}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Notes tab */
            <div style={{ padding: '14px 16px' }}>
              {/* Show all notes toggle */}
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 16 }}
              >
                <label
                  className="flex cursor-pointer items-center gap-2"
                  style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}
                >
                  <input
                    type="checkbox"
                    checked={showAllNotes}
                    onChange={(e) => setShowAllNotes(e.target.checked)}
                    style={{ accentColor: '#e63946' }}
                  />
                  Show all notes
                </label>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.25)', cursor: 'help' }} title="Notes are saved automatically">
                  ⓘ
                </span>
              </div>

              {/* Current lesson indicator */}
              <div style={{ marginBottom: 10 }}>
                <div
                  className="flex items-center gap-1.5"
                  style={{ marginBottom: 4 }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#e63946',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}
                  >
                    Watching Now
                  </span>
                </div>
                <p
                  className="font-semibold"
                  style={{ fontSize: 13, color: '#fff', lineHeight: 1.3 }}
                >
                  {lesson.title}
                </p>
              </div>

              {/* Note textarea */}
              <textarea
                value={noteText}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Type your notes here..."
                rows={8}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: 13,
                  color: noteText ? '#fff' : 'rgba(255,255,255,0.25)',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg transition-colors"
      style={{
        padding: '9px 18px',
        background: 'rgba(255,255,255,0.08)',
        border: 'none',
        color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.background = 'rgba(255,255,255,0.13)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
