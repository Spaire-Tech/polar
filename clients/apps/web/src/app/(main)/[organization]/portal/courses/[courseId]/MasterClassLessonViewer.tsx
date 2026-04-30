'use client'

import { HlsVideo } from '@/components/Courses/HlsVideo'
import { QuizPlayer } from '@/components/Courses/QuizPlayer'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { useLessonNote, useUpsertLessonNote } from '@/hooks/queries/courses'
import Bookmark from '@mui/icons-material/Bookmark'
import BookmarkBorderOutlined from '@mui/icons-material/BookmarkBorderOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import IosShareOutlined from '@mui/icons-material/IosShareOutlined'
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CommentThread } from './CommentThread'

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
  // 'portal' = signed-in customer, full toolbar (Share + Class Guide + Bookmark)
  // 'landing' = public preview, only Share is shown
  mode?: 'portal' | 'landing'
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

const fontStack = "'Poppins', var(--font-poppins), system-ui, sans-serif"

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
  isPending: _isPending,
  onBack,
  onSelectLesson,
  onMarkComplete,
  token,
  courseId,
  mode = 'portal',
}: MasterClassLessonViewerProps) => {
  const [playing, setPlaying] = useState(false)
  const [activeTab, setActiveTab] = useState<'lessons' | 'notes'>('lessons')
  const [noteText, setNoteText] = useState('')
  const [bookmarked, setBookmarked] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
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

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1800)
    } catch {
      // ignore
    }
  }

  const handleBookmark = () => {
    setBookmarked((b) => !b)
    if (!lesson.completed && !bookmarked) {
      onMarkComplete()
    }
  }

  const thumbnailSrc =
    lesson.thumbnail_url ||
    (lesson.mux_playback_id
      ? `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
      : null)

  const isQuiz = lesson.content_type === 'quiz'
  const textContent = isQuiz ? '' : ((lesson.content as any)?.text ?? '')
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
          className="group relative block w-full bg-black"
          style={{ aspectRatio: '16/9' }}
        >
          {thumbnailSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailSrc}
              alt={lesson.title}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: lesson.thumbnail_object_position ?? '50% 50%',
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex items-center justify-center rounded-full transition-transform group-hover:scale-105"
              style={{
                width: 72,
                height: 72,
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                paddingLeft: 4,
              }}
            >
              <PlayArrow sx={{ fontSize: 30, color: '#000' }} />
            </div>
          </div>
        </button>
      )
    }

    if (thumbnailSrc) {
      return (
        <div
          className="relative w-full bg-black"
          style={{ aspectRatio: '16/9' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailSrc}
            alt={lesson.title}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: lesson.thumbnail_object_position ?? '50% 50%',
            }}
          />
        </div>
      )
    }

    return <div className="w-full bg-black" style={{ aspectRatio: '16/9' }} />
  }

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: '#ffffff',
        color: 'oklch(0.18 0.008 280)',
        fontFamily: fontStack,
        letterSpacing: '-0.005em',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* Slim top bar — back button + lesson counter only (no Spaire branding) */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid oklch(0.945 0.003 280)',
        }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{ maxWidth: 1440, padding: '14px 28px' }}
        >
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-colors"
            style={{
              padding: '8px 14px 8px 10px',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 500,
              color: 'oklch(0.32 0.008 280)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'oklch(0.95 0.003 280)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <KeyboardArrowLeft sx={{ fontSize: 20 }} />
            Back to Course
          </button>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'oklch(0.52 0.008 280)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lessonIndex + 1} of {totalLessons}
          </span>
        </div>
      </header>

      <main
        className="mx-auto"
        style={{
          maxWidth: 1440,
          padding: '24px 28px 64px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 28,
            alignItems: 'start',
          }}
          className="lesson-grid"
        >
          {/* LEFT: video + meta + content + comments */}
          <div
            style={{
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Video frame */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                background: '#000',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow:
                  '0 1px 2px oklch(0 0 0 / 0.05), 0 12px 32px oklch(0 0 0 / 0.08)',
              }}
            >
              {renderVideoArea()}
            </div>

            {/* Meta row: title + actions */}
            <div
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'flex-start',
                paddingTop: 4,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: 'oklch(0.55 0.20 265)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Lesson {lessonIndex + 1} of {totalLessons}
                </div>
                <h1
                  style={{
                    fontFamily: fontStack,
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                    color: 'oklch(0.18 0.008 280)',
                    lineHeight: 1.2,
                    textWrap: 'pretty' as any,
                  }}
                >
                  {lesson.title}
                </h1>
                {courseDescription && (
                  <p
                    style={{
                      fontSize: 14,
                      color: 'oklch(0.52 0.008 280)',
                      lineHeight: 1.6,
                      margin: 0,
                      maxWidth: 620,
                      textWrap: 'pretty' as any,
                      fontWeight: 400,
                    }}
                  >
                    {courseDescription}
                  </p>
                )}
              </div>

              {/* Actions: Share | Class Guide | Bookmark (last two only in portal mode) */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <ActionBtn
                  icon={<IosShareOutlined sx={{ fontSize: 16 }} />}
                  label={shareCopied ? 'Link copied' : 'Share'}
                  onClick={handleShare}
                />
                {mode === 'portal' && (
                  <>
                    {firstAttachment ? (
                      <a
                        href={firstAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        <ActionBtn
                          icon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                          label="Class Guide"
                        />
                      </a>
                    ) : (
                      <ActionBtn
                        icon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                        label="Class Guide"
                        disabled
                      />
                    )}
                    <ActionBtn
                      icon={
                        bookmarked ? (
                          <Bookmark sx={{ fontSize: 16 }} />
                        ) : (
                          <BookmarkBorderOutlined sx={{ fontSize: 16 }} />
                        )
                      }
                      label={bookmarked ? 'Saved' : 'Bookmark'}
                      active={bookmarked}
                      onClick={handleBookmark}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Lesson body content (markdown / quiz) */}
            {(textContent || isQuiz) && (
              <div style={{ marginTop: 12 }}>
                {textContent && !isQuiz && (
                  <div
                    className="prose max-w-none"
                    style={{
                      fontFamily: fontStack,
                      color: 'oklch(0.32 0.008 280)',
                    }}
                  >
                    <MemoizedMarkdown content={textContent} />
                  </div>
                )}
                {isQuiz && (
                  <QuizPlayer
                    lesson={lesson as any}
                    token={token}
                    courseId={courseId}
                    onPassed={onMarkComplete}
                  />
                )}
              </div>
            )}

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: 'oklch(0.92 0.003 280)',
                margin: '12px 0 0',
              }}
            />

            {/* Comments */}
            <CommentThread
              token={token}
              courseId={courseId}
              lessonId={lesson.id}
            />
          </div>

          {/* RIGHT: sidebar */}
          <aside
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'sticky',
              top: 80,
              height: 'fit-content',
              maxHeight: 'calc(100vh - 96px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                flex: 1,
              }}
            >
              {/* Header card with instructor + tabs */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid oklch(0.92 0.003 280)',
                  borderTopLeftRadius: 14,
                  borderTopRightRadius: 14,
                  borderBottom: 'none',
                  padding: '18px 18px 0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background:
                        'linear-gradient(135deg, oklch(0.55 0.20 265), oklch(0.62 0.16 285))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 13,
                      boxShadow: 'inset 0 0 0 1px oklch(1 0 0 / 0.12)',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {instructorAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={instructorAvatarUrl}
                        alt={instructorName ?? ''}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      (instructorName ?? '?').slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'oklch(0.18 0.008 280)',
                      }}
                    >
                      {instructorName}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'oklch(0.52 0.008 280)',
                        marginTop: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {courseTitle}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    borderBottom: '1px solid oklch(0.92 0.003 280)',
                    margin: '0 -18px',
                    padding: '0 18px',
                  }}
                >
                  {(['lessons', 'notes'] as const).map((tab) => {
                    const isActive = activeTab === tab
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          position: 'relative',
                          padding: '10px 0',
                          marginRight: 18,
                          color: isActive
                            ? 'oklch(0.18 0.008 280)'
                            : 'oklch(0.52 0.008 280)',
                          fontSize: 13,
                          fontWeight: 500,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: fontStack,
                        }}
                      >
                        {tab === 'lessons' ? 'All Lessons' : 'My Notes'}
                        {isActive && (
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: -1,
                              height: 2,
                              background: 'oklch(0.55 0.20 265)',
                              borderRadius: 2,
                            }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Body */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid oklch(0.92 0.003 280)',
                  borderTop: 'none',
                  borderBottomLeftRadius: 14,
                  borderBottomRightRadius: 14,
                  overflow: 'hidden',
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow:
                    '0 1px 2px oklch(0 0 0 / 0.04), 0 4px 16px oklch(0 0 0 / 0.06)',
                  maxHeight: 'calc(100vh - 220px)',
                }}
              >
                {activeTab === 'lessons' ? (
                  <div
                    style={{
                      overflowY: 'auto',
                      padding: '16px 18px 18px',
                      flex: 1,
                    }}
                  >
                    {courseDescription && (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'oklch(0.32 0.008 280)',
                          lineHeight: 1.5,
                          marginBottom: 4,
                          textWrap: 'pretty' as any,
                        }}
                      >
                        {courseDescription}
                      </div>
                    )}
                    <div
                      style={{ fontSize: 12, color: 'oklch(0.66 0.006 280)' }}
                    >
                      {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                      {totalDurationSeconds > 0 &&
                        ` · ${formatTotalDuration(totalDurationSeconds)}`}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        marginTop: 14,
                      }}
                    >
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
                            className="group"
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              padding: 8,
                              borderRadius: 10,
                              textAlign: 'left',
                              transition: 'background 120ms ease',
                              width: '100%',
                              background: isActive
                                ? 'oklch(0.975 0.002 280)'
                                : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontFamily: fontStack,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive)
                                e.currentTarget.style.background =
                                  'oklch(0.975 0.002 280)'
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive)
                                e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <div
                              style={{
                                position: 'relative',
                                width: 104,
                                height: 62,
                                flexShrink: 0,
                                borderRadius: 8,
                                overflow: 'hidden',
                                background: '#1c1c1c',
                                boxShadow: '0 1px 2px oklch(0 0 0 / 0.08)',
                              }}
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
                              ) : null}
                              {isActive && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                  }}
                                >
                                  <PlayArrow sx={{ fontSize: 18 }} />
                                </div>
                              )}
                              {l.duration_seconds ? (
                                <span
                                  style={{
                                    position: 'absolute',
                                    right: 4,
                                    bottom: 4,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    color: 'white',
                                    background: 'rgba(0,0,0,0.75)',
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  {formatDuration(l.duration_seconds)}
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                                paddingTop: 2,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 500,
                                  lineHeight: 1.35,
                                  textWrap: 'pretty' as any,
                                  color: isActive
                                    ? 'oklch(0.55 0.20 265)'
                                    : 'oklch(0.18 0.008 280)',
                                }}
                              >
                                {idx + 1}. {l.title}
                              </div>
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'oklch(0.66 0.006 280)',
                                }}
                              >
                                {isActive
                                  ? 'Now playing'
                                  : l.completed
                                    ? 'Watched'
                                    : 'Up next'}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      overflowY: 'auto',
                      padding: '16px 18px 18px',
                      flex: 1,
                    }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'oklch(0.55 0.20 265)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 4,
                        }}
                      >
                        Lesson {lessonIndex + 1}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'oklch(0.18 0.008 280)',
                          lineHeight: 1.3,
                        }}
                      >
                        {lesson.title}
                      </div>
                    </div>

                    <textarea
                      value={noteText}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      placeholder="Type your notes here…"
                      rows={12}
                      style={{
                        width: '100%',
                        background: 'oklch(0.975 0.002 280)',
                        border: '1px solid oklch(0.92 0.003 280)',
                        borderRadius: 10,
                        padding: 12,
                        outline: 'none',
                        resize: 'vertical',
                        fontSize: 13,
                        color: 'oklch(0.18 0.008 280)',
                        lineHeight: 1.6,
                        fontFamily: fontStack,
                      }}
                    />

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: 'oklch(0.66 0.006 280)',
                      }}
                    >
                      {upsertNote.isPending ? 'Saving…' : 'Auto-saved'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const baseBg = active ? 'oklch(0.55 0.20 265 / 0.10)' : '#ffffff'
  const baseColor = active
    ? 'oklch(0.55 0.20 265)'
    : disabled
      ? 'oklch(0.66 0.006 280)'
      : 'oklch(0.18 0.008 280)'
  const baseBorder = active ? 'transparent' : 'oklch(0.92 0.003 280)'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={twMerge(
        'inline-flex items-center gap-2 transition-all',
        disabled && 'cursor-not-allowed',
      )}
      style={{
        padding: '10px 16px',
        borderRadius: 999,
        background: baseBg,
        color: baseColor,
        border: `1px solid ${baseBorder}`,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: fontStack,
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'oklch(0.975 0.002 280)'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = '#ffffff'
        }
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
