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
  instructorName: string | null
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
  instructorName,
  onSelectLesson,
  hasAccess,
}: MasterClassLessonListProps) => {
  return (
    <div className="w-full bg-black pb-16 md:pb-24">
      <div className="mx-auto max-w-5xl px-6 md:px-8">
        <div className="flex flex-col">
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
              <div
                key={lesson.id}
                className={twMerge(
                  'border-t border-white/10',
                  index === 0 && 'border-t-0',
                )}
              >
                <button
                  onClick={() => !isLocked && onSelectLesson(lesson)}
                  disabled={isLocked}
                  className={twMerge(
                    'group flex w-full items-start gap-6 py-8 text-left',
                    isLocked
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer',
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-56 flex-shrink-0 overflow-hidden rounded-md bg-gray-900">
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

                    {/* Watched badge (top-left) */}
                    {lesson.completed && !isLocked && (
                      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/85 px-2 py-1 text-xs font-medium text-white">
                        <CheckOutlined sx={{ fontSize: 14 }} />
                        Watched
                      </div>
                    )}

                    {/* Duration overlay (bottom-right) */}
                    {lesson.duration_seconds && !isLocked && (
                      <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                        {formatDuration(lesson.duration_seconds)}
                      </div>
                    )}

                    {/* Play button overlay */}
                    {isPlayable && !isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                          <PlayArrow
                            sx={{ fontSize: 28 }}
                            className="ml-1 text-black"
                          />
                        </div>
                      </div>
                    )}

                    {/* Lock overlay */}
                    {isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <LockOutlined
                          sx={{ fontSize: 32 }}
                          className="text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="text-lg font-bold leading-snug text-white md:text-xl">
                      {lesson.title}
                    </h3>
                    {instructorName && (
                      <p className="mt-1 text-sm font-medium text-white">
                        {instructorName}
                      </p>
                    )}
                    {lesson.description && (
                      <p className="mt-3 text-sm leading-relaxed text-white/70">
                        {lesson.description}
                      </p>
                    )}
                    {isLocked && (
                      <p className="mt-3 text-sm text-orange-400">
                        {lesson.locked_until
                          ? `Unlocks ${new Date(
                              lesson.locked_until,
                            ).toLocaleDateString()}`
                          : 'Locked — Unlock to watch'}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
