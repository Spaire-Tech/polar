'use client'

import CheckCircle from '@mui/icons-material/CheckCircle'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface FlatLesson {
  id: string
  title: string
  description?: string | null
  position: number
  duration_seconds?: number | null
  thumbnail_url?: string | null
  mux_playback_id?: string | null
  mux_status?: string | null
  completed: boolean
  is_free_preview: boolean
  locked?: boolean
  locked_until?: string | null
  content_type?: string
  content?: Record<string, unknown> | null
}

interface MasterClassLessonListProps {
  lessons: FlatLesson[]
  onSelectLesson: (lesson: FlatLesson) => void
  hasAccess: boolean
}

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return ''
  const mins = Math.ceil(seconds / 60)
  return `${mins}m`
}

export const MasterClassLessonList = ({
  lessons,
  onSelectLesson,
  hasAccess,
}: MasterClassLessonListProps) => {
  const [expandedDescription, setExpandedDescription] = useState<string | null>(
    null
  )

  return (
    <div className="w-full bg-black py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 md:px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-12">
          Lessons
        </h2>

        <div className="space-y-4">
          {lessons.map((lesson) => {
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
                className={twMerge(
                  'group w-full flex gap-4 p-4 rounded-lg transition-colors',
                  isLocked
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:bg-white/5 active:bg-white/10 cursor-pointer'
                )}
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 relative w-40 aspect-video rounded overflow-hidden bg-gray-900">
                  {thumbnailSrc ? (
                    <img
                      src={thumbnailSrc}
                      alt={lesson.title}
                      className="w-full h-full object-cover group-hover:brightness-110 transition-all"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                  )}

                  {/* Duration overlay (bottom-right) */}
                  {lesson.duration_seconds && !isLocked && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
                      {formatDuration(lesson.duration_seconds)}
                    </div>
                  )}

                  {/* Play button overlay */}
                  {isPlayable && !isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                        <PlayArrow sx={{ fontSize: 28 }} className="ml-1 text-blue-600" />
                      </div>
                    </div>
                  )}

                  {/* Lock overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <LockOutlined sx={{ fontSize: 32 }} className="text-white" />
                    </div>
                  )}

                  {/* Completion indicator */}
                  {lesson.completed && !isLocked && (
                    <div className="absolute top-2 left-2">
                      <CheckCircle sx={{ fontSize: 24 }} className="text-green-500" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col items-start text-left min-w-0">
                  {/* Lesson number + title */}
                  <div className="flex items-center gap-3 mb-2 w-full">
                    {!lesson.completed && !isLocked && (
                      <CheckCircleOutlined
                        sx={{ fontSize: 20 }}
                        className="flex-shrink-0 text-gray-500"
                      />
                    )}
                    <h3 className="text-base md:text-lg font-semibold text-white">
                      {lesson.position + 1}. {lesson.title}
                    </h3>
                  </div>

                  {/* Description - line clamp to 2 lines */}
                  {lesson.description && (
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {lesson.description}
                    </p>
                  )}

                  {/* Locked message */}
                  {isLocked && (
                    <p className="text-sm text-orange-400 mt-2">
                      {lesson.locked_until
                        ? `Unlocks ${new Date(
                            lesson.locked_until
                          ).toLocaleDateString()}`
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
