'use client'

import { HlsVideo } from '@/components/Courses/HlsVideo'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import {
  useCustomerCourse,
  type CustomerLessonRead,
  type CustomerModuleRead,
} from '@/hooks/queries/courses'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { schemas } from '@spaire/client'
import { useMemo, useState } from 'react'

type FlatLesson = {
  lesson: CustomerLessonRead
  module: CustomerModuleRead
  locked: boolean
  index: number
}

function formatDuration(durationSeconds: number | null): string | null {
  if (!durationSeconds || durationSeconds <= 0) return null
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getLessonThumbnail(
  lesson: CustomerLessonRead,
  fallback: string | null,
): string | null {
  if (lesson.thumbnail_url) return lesson.thumbnail_url
  if (lesson.mux_playback_id) {
    return `https://image.mux.com/${lesson.mux_playback_id}/thumbnail.jpg?time=0`
  }
  return fallback
}

export default function CourseLandingPage({
  organization,
  courseId,
  customerSessionToken,
  initialLessonId,
}: {
  organization: schemas['CustomerOrganization']
  courseId: string
  customerSessionToken: string
  initialLessonId?: string
}) {
  const { data, isLoading } = useCustomerCourse(customerSessionToken, courseId)

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLessonId ?? null,
  )

  const flatLessons = useMemo<FlatLesson[]>(() => {
    if (!data) return []
    return data.course.modules
      .slice()
      .sort((a, b) => a.position - b.position)
      .flatMap((module) =>
        module.lessons
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((lesson, idxInModule) => ({
            lesson,
            module,
            locked: module.locked && !lesson.is_free_preview,
            index: idxInModule,
          })),
      )
      .map((item, index) => ({ ...item, index }))
  }, [data])

  const trailerLesson =
    flatLessons.find((item) => item.lesson.is_free_preview)?.lesson ??
    flatLessons[0]?.lesson

  const firstPlayableLesson =
    flatLessons.find((item) => !item.locked)?.lesson ?? trailerLesson

  const selectedLesson =
    flatLessons.find((item) => item.lesson.id === selectedLessonId)?.lesson ?? null

  const courseTitle = data?.course.title ?? 'Course'
  const courseDescription =
    data?.course.modules
      .flatMap((module) => module.lessons)
      .find((lesson) => lesson.is_free_preview)?.description ??
    'Learn through concise lessons and practical instruction.'

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    )
  }

  const heroImage =
    trailerLesson?.thumbnail_url ??
    (trailerLesson?.mux_playback_id
      ? `https://image.mux.com/${trailerLesson.mux_playback_id}/thumbnail.jpg?time=0`
      : null)

  if (selectedLesson) {
    const currentIndex = flatLessons.findIndex((l) => l.lesson.id === selectedLesson.id)
    const currentDuration = formatDuration(selectedLesson.duration_seconds)

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_420px]">
          <div className="flex min-h-0 flex-col">
            <div className="aspect-video w-full bg-black">
              {selectedLesson.mux_playback_id && selectedLesson.mux_status === 'ready' ? (
                <HlsVideo playbackId={selectedLesson.mux_playback_id} autoPlay />
              ) : (
                <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-300">
                  Video unavailable
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 bg-black px-8 py-6">
              <h1 className="text-4xl font-semibold">
                {currentIndex + 1}. {selectedLesson.title}
              </h1>
              <p className="mt-3 max-w-3xl text-xl text-zinc-300">
                {selectedLesson.description ?? 'No lesson description yet.'}
              </p>
              {currentDuration && (
                <p className="mt-2 text-sm text-zinc-400">Duration {currentDuration}</p>
              )}
              {'text' in (selectedLesson.content ?? {}) && (
                <div className="prose prose-invert mt-8 max-w-3xl">
                  <MemoizedMarkdown
                    content={String(
                      (selectedLesson.content as { text?: string }).text ?? '',
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          <aside className="border-l border-zinc-800 bg-[#0f1013] p-6">
            <button
              onClick={() => setSelectedLessonId(null)}
              className="mb-6 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Back to class
            </button>
            <p className="text-2xl font-semibold text-white">{organization.name}</p>
            <p className="mt-1 text-zinc-400">{courseTitle}</p>
            <div className="mt-6 space-y-3">
              {flatLessons.map((item) => {
                const thumbnail = getLessonThumbnail(item.lesson, heroImage)
                const duration = formatDuration(item.lesson.duration_seconds)
                const active = item.lesson.id === selectedLesson.id
                return (
                  <button
                    key={item.lesson.id}
                    onClick={() => {
                      if (item.locked) return
                      setSelectedLessonId(item.lesson.id)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                      active ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                    } ${item.locked ? 'opacity-60' : ''}`}
                  >
                    <div className="relative h-16 w-28 overflow-hidden rounded-lg bg-zinc-800">
                      {thumbnail && (
                        <img
                          src={thumbnail}
                          alt={item.lesson.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {item.locked ? 'LOCKED' : (duration ?? '--:--')}
                      </div>
                    </div>
                    <div>
                      <p className="text-lg text-white">
                        {item.index + 1}. {item.lesson.title}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black text-white">
      <section className="relative min-h-[82vh] overflow-hidden">
        {heroImage && (
          <img
            src={heroImage}
            alt={courseTitle}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10" />

        <div className="relative mx-auto flex min-h-[82vh] max-w-[1400px] items-end px-8 pb-16 pt-20">
          <div className="max-w-xl">
            <p className="font-serif text-6xl font-semibold leading-tight">{organization.name}</p>
            <div className="my-6 h-1 w-14 bg-white/80" />
            <h1 className="text-4xl font-semibold leading-tight">{courseTitle}</h1>
            <p className="mt-6 text-2xl text-zinc-300">{courseDescription}</p>
            <div className="mt-10 flex items-center gap-3">
              <button
                onClick={() => {
                  if (firstPlayableLesson) setSelectedLessonId(firstPlayableLesson.id)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black"
              >
                <PlayArrow />
                Start Class
              </button>
              <button
                onClick={() => {
                  if (trailerLesson) setSelectedLessonId(trailerLesson.id)
                }}
                className="rounded-xl bg-zinc-700 px-6 py-3 text-lg font-semibold text-white"
              >
                Trailer
              </button>
              <button className="rounded-xl bg-zinc-700 px-4 py-3 text-2xl leading-none text-white">
                +
              </button>
            </div>
          </div>

          <button className="absolute top-8 right-8 rounded-xl bg-gradient-to-r from-violet-700 to-blue-600 px-5 py-2 font-semibold text-white shadow-lg">
            ✨ Class TA
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-6">
          {flatLessons.map((item) => {
            const thumbnail = getLessonThumbnail(item.lesson, heroImage)
            const duration = formatDuration(item.lesson.duration_seconds)
            return (
              <button
                key={item.lesson.id}
                onClick={() => {
                  if (item.locked) return
                  setSelectedLessonId(item.lesson.id)
                }}
                className="flex w-full items-start gap-6 rounded-2xl p-2 text-left hover:bg-zinc-900"
              >
                <div className="relative aspect-video w-64 overflow-hidden rounded-2xl bg-zinc-800">
                  {thumbnail && (
                    <img
                      src={thumbnail}
                      alt={item.lesson.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                    {item.locked ? 'Locked' : (duration ?? '')}
                  </div>
                  {item.locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <LockOutlined />
                    </div>
                  )}
                </div>

                <div className="max-w-xl pt-1">
                  <h3 className="text-4xl font-semibold leading-tight text-white">
                    {item.index + 1}. {item.lesson.title}
                  </h3>
                  <p className="mt-2 text-2xl leading-relaxed text-zinc-300">
                    {item.lesson.description ?? 'No lesson description yet.'}
                  </p>
                  {item.locked && (
                    <p className="mt-2 text-sm font-medium uppercase tracking-wide text-zinc-400">
                      Locked — Unlock to watch
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {!data.course.has_access && (
        <div className="sticky bottom-0 border-t border-zinc-700 bg-black/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <p className="text-zinc-200">Get full class access</p>
            <button className="rounded-lg bg-white px-5 py-2 font-semibold text-black">
              Get access
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
