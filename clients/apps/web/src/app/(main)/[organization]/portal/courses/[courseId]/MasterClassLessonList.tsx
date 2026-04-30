'use client'

import CheckOutlined from '@mui/icons-material/CheckOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { twMerge } from 'tailwind-merge'

export interface FlatLesson {
  id: string
  title: string
  description?: string | null
  position: number
  duration_seconds?: number | null
  thumbnail_url?: string | null
  thumbnail_object_position?: string | null
  mux_playback_id?: string | null
  mux_status?: string | null
  completed: boolean
  is_free_preview: boolean
  locked?: boolean
  locked_until?: string | null
  content_type: string
  content: Record<string, unknown> | null
}

interface MasterClassLessonListProps {
  lessons: FlatLesson[]
  instructorName?: string | null
  onSelectLesson: (lesson: FlatLesson) => void
  hasAccess: boolean
}

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return ''
  const totalSeconds = Math.floor(seconds)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

export const MasterClassLessonList = ({
  lessons,
  onSelectLesson,
  hasAccess,
}: MasterClassLessonListProps) => {
  return (
    <div className="w-full bg-black" style={{ paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 860,
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: 40,
          paddingRight: 40,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {lessons.map((lesson, index) => {
            const thumbnailSrc =
              lesson.thumbnail_url ||
              (lesson.mux_playback_id
                ? `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
                : null)

            const isLocked = lesson.locked && !hasAccess
            const isPlayable =
              !isLocked &&
              (lesson.mux_playback_id ||
                lesson.thumbnail_url ||
                lesson.is_free_preview)

            return (
              <button
                key={lesson.id}
                onClick={() => !isLocked && onSelectLesson(lesson)}
                disabled={isLocked}
                className="group flex w-full items-start text-left"
                style={{
                  gap: 32,
                  paddingTop: index === 0 ? 0 : 44,
                  paddingBottom: 44,
                  borderBottom: index === lessons.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                {/* Thumbnail */}
                <div
                  className="relative flex-shrink-0 overflow-hidden bg-gray-900"
                  style={{
                    width: 320,
                    aspectRatio: '16 / 9',
                    borderRadius: 12,
                  }}
                >
                  {thumbnailSrc ? (
                    <img
                      src={thumbnailSrc}
                      alt={lesson.title}
                      className="h-full w-full object-cover transition-all group-hover:brightness-110"
                      style={{
                        objectPosition:
                          lesson.thumbnail_object_position ?? '50% 50%',
                      }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-gray-800 to-gray-900" />
                  )}

                  {/* Watched pill (top-left) */}
                  {lesson.completed && !isLocked && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: '#fff',
                        color: '#000',
                        paddingLeft: 10,
                        paddingRight: 12,
                        paddingTop: 4,
                        paddingBottom: 4,
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <CheckOutlined sx={{ fontSize: 13 }} />
                      Watched
                    </div>
                  )}

                  {/* Duration (bottom-right) */}
                  {lesson.duration_seconds && !isLocked && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        background: 'rgba(0,0,0,0.82)',
                        color: '#fff',
                        paddingLeft: 7,
                        paddingRight: 7,
                        paddingTop: 3,
                        paddingBottom: 3,
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {formatDuration(lesson.duration_seconds)}
                    </div>
                  )}

                  {/* Red progress bar at bottom for completed lessons */}
                  {lesson.completed && !isLocked && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 3,
                        background: '#e63946',
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 12,
                      }}
                    />
                  )}

                  {/* Play overlay on hover */}
                  {isPlayable && !isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                        <PlayArrow sx={{ fontSize: 28 }} className="ml-1 text-black" />
                      </div>
                    </div>
                  )}

                  {/* Lock overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <LockOutlined sx={{ fontSize: 32 }} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minWidth: 0,
                    paddingTop: 6,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 21,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      color: '#fff',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {lesson.position}. {lesson.title}
                  </h3>
                  {lesson.description && (
                    <p
                      style={{
                        marginTop: 10,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {lesson.description}
                    </p>
                  )}
                  {isLocked && (
                    <p style={{ marginTop: 10, fontSize: 13, color: '#fb923c' }}>
                      {lesson.locked_until
                        ? `Unlocks ${new Date(lesson.locked_until).toLocaleDateString()}`
                        : 'Locked — Unlock to watch'}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
