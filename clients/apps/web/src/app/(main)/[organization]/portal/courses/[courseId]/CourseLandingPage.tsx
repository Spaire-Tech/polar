'use client'

import { HlsVideo } from '@/components/Courses/HlsVideo'
import {
  CustomerLessonRead,
  useCustomerCourse,
  useMarkLessonComplete,
} from '@/hooks/queries/courses'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import BookmarkBorderOutlined from '@mui/icons-material/BookmarkBorderOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import IosShareOutlined from '@mui/icons-material/IosShareOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlayArrow from '@mui/icons-material/PlayArrow'
import { schemas } from '@spaire/client'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type ViewerProps = {
  organization: schemas['CustomerOrganization']
  courseId: string
  customerSessionToken: string
  initialLessonId?: string
}

type FlatLesson = CustomerLessonRead & {
  index: number
  locked: boolean
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function lessonDescription(lesson: CustomerLessonRead): string {
  const c = lesson.content as { description?: string } | null
  return c?.description ?? ''
}

export default function CourseLandingPage({
  organization,
  courseId,
  customerSessionToken,
  initialLessonId,
}: ViewerProps) {
  const { data, isLoading } = useCustomerCourse(customerSessionToken, courseId)
  const markComplete = useMarkLessonComplete(customerSessionToken, courseId)

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLessonId ?? null,
  )
  const [rightTab, setRightTab] = useState<'lessons' | 'notes'>('lessons')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const lessons: FlatLesson[] = useMemo(() => {
    const out: FlatLesson[] = []
    let idx = 0
    for (const m of data?.course.modules ?? []) {
      for (const l of m.lessons) {
        out.push({ ...l, index: idx, locked: m.locked })
        idx += 1
      }
    }
    return out
  }, [data])

  const totalCount = lessons.length
  const trailer = lessons.find((l) => l.is_free_preview) ?? lessons[0]
  const selected = selectedLessonId
    ? lessons.find((l) => l.id === selectedLessonId)
    : null

  const handleSelect = (lesson: FlatLesson) => {
    if (lesson.locked) return
    setSelectedLessonId(lesson.id)
  }

  const handleStartClass = () => {
    const first = lessons.find((l) => !l.locked) ?? trailer
    if (first) setSelectedLessonId(first.id)
  }

  const handleTrailer = () => {
    if (trailer) setSelectedLessonId(trailer.id)
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Loading…
      </div>
    )
  }

  const courseTitle = data.course.title ?? 'Untitled course'
  const orgName = organization.name
  const courseDescription =
    (data.course as unknown as { description?: string | null }).description ??
    ''

  // ── Lesson player view ──────────────────────────────────────────────────
  if (selected) {
    return (
      <LessonViewer
        organization={organization}
        courseTitle={courseTitle}
        lesson={selected}
        lessons={lessons}
        rightTab={rightTab}
        onChangeRightTab={setRightTab}
        notes={notes[selected.id] ?? ''}
        onChangeNotes={(v) =>
          setNotes((prev) => ({ ...prev, [selected.id]: v }))
        }
        onSelectLesson={handleSelect}
        onBack={() => setSelectedLessonId(null)}
        onMarkComplete={() => markComplete.mutate(selected.id)}
      />
    )
  }

  // ── Landing view ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <TopBar />

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-neutral-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col justify-center px-6 py-24 lg:px-12">
          <div className="max-w-xl">
            <p className="font-serif text-3xl leading-tight tracking-tight text-white sm:text-4xl">
              {orgName}
            </p>
            <div className="my-6 h-px w-10 bg-neutral-500" />
            <h1 className="text-xl leading-snug font-semibold text-white sm:text-2xl">
              {courseTitle}
            </h1>
            {courseDescription && (
              <p className="mt-5 text-sm leading-relaxed text-neutral-300 sm:text-base">
                {courseDescription}
              </p>
            )}
            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={handleStartClass}
                className="flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200"
              >
                <PlayArrow sx={{ fontSize: 18 }} />
                Start Class
              </button>
              {trailer && (
                <button
                  onClick={handleTrailer}
                  className="flex items-center gap-2 rounded-md bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
                >
                  Trailer
                </button>
              )}
              <button
                aria-label="Bookmark"
                className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Lessons */}
      <section className="mx-auto max-w-3xl px-6 pt-12 pb-24">
        <div className="flex flex-col gap-6">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onSelect={() => handleSelect(lesson)}
            />
          ))}
        </div>
        {totalCount === 0 && (
          <p className="text-center text-sm text-neutral-500">
            No lessons yet.
          </p>
        )}
      </section>
    </div>
  )
}

// ── Top bar ────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4 lg:px-12">
      <div className="flex items-center gap-3 text-white/70">
        <button
          aria-label="Mute"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
        >
          <span className="text-sm">×</span>
        </button>
        <button
          aria-label="Play"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
        >
          <PlayArrow sx={{ fontSize: 18 }} />
        </button>
        <button
          aria-label="Share"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
        >
          <IosShareOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>
    </div>
  )
}

// ── Lesson card (landing list) ────────────────────────────────────────────

function LessonCard({
  lesson,
  onSelect,
}: {
  lesson: FlatLesson
  onSelect: () => void
}) {
  const duration = formatDuration(lesson.duration_seconds)
  const description = lessonDescription(lesson)

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={lesson.locked}
      className="group flex flex-col gap-4 text-left sm:flex-row"
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-neutral-800 sm:w-64">
        {lesson.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnail_url}
            alt=""
            className={twMerge(
              'h-full w-full object-cover transition-opacity',
              lesson.locked && 'opacity-40',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <PlayArrow sx={{ fontSize: 32 }} />
          </div>
        )}
        {lesson.locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/40 text-white">
            <LockOutlined sx={{ fontSize: 22 }} />
          </div>
        )}
        {duration && !lesson.locked && (
          <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-sm font-semibold text-white">
          {lesson.index + 1}. {lesson.title}
        </p>
        {description && (
          <p className="text-sm leading-relaxed text-neutral-400">
            {description}
          </p>
        )}
        {lesson.locked && (
          <p className="text-xs font-medium text-neutral-500">
            Unlock to watch
          </p>
        )}
      </div>
    </button>
  )
}

// ── Lesson viewer ──────────────────────────────────────────────────────────

function LessonViewer({
  organization,
  courseTitle,
  lesson,
  lessons,
  rightTab,
  onChangeRightTab,
  notes,
  onChangeNotes,
  onSelectLesson,
  onBack,
  onMarkComplete,
}: {
  organization: schemas['CustomerOrganization']
  courseTitle: string
  lesson: FlatLesson
  lessons: FlatLesson[]
  rightTab: 'lessons' | 'notes'
  onChangeRightTab: (t: 'lessons' | 'notes') => void
  notes: string
  onChangeNotes: (v: string) => void
  onSelectLesson: (l: FlatLesson) => void
  onBack: () => void
  onMarkComplete: () => void
}) {
  const total = lessons.length
  const currentIdx = lessons.findIndex((l) => l.id === lesson.id)
  const prev = currentIdx > 0 ? lessons[currentIdx - 1] : null
  const next = currentIdx < total - 1 ? lessons[currentIdx + 1] : null
  const description = lessonDescription(lesson)
  const attachments =
    (lesson.content?.attachments as
      | { id: string; filename: string; url: string }[]
      | undefined) ?? []

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 lg:px-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowBackOutlined sx={{ fontSize: 16 }} />
          Back to course
        </button>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span>
            Lesson {currentIdx + 1} / {total}
          </span>
          <button
            onClick={() => prev && onSelectLesson(prev)}
            disabled={!prev}
            aria-label="Previous lesson"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
          >
            <ArrowBackOutlined sx={{ fontSize: 16 }} />
          </button>
          <button
            onClick={() => next && onSelectLesson(next)}
            disabled={!next}
            aria-label="Next lesson"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
          >
            <ArrowForwardOutlined sx={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 pb-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-10">
        {/* Player column */}
        <div className="flex flex-col gap-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            {lesson.mux_playback_id ? (
              <HlsVideo
                playbackId={lesson.mux_playback_id}
                poster={lesson.thumbnail_url}
              />
            ) : lesson.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lesson.thumbnail_url}
                alt=""
                className="h-full w-full object-cover opacity-60"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-700">
                <PlayArrow sx={{ fontSize: 64 }} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-white">
                  {lesson.index + 1}. {lesson.title}
                </h1>
                {description && (
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                    {description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PillButton icon={<IosShareOutlined sx={{ fontSize: 16 }} />}>
                  Share
                </PillButton>
                <PillButton
                  icon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                  active={attachments.length > 0}
                >
                  Class Resources
                </PillButton>
                <PillButton
                  icon={<BookmarkBorderOutlined sx={{ fontSize: 16 }} />}
                >
                  Bookmark
                </PillButton>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
                {attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-neutral-200 hover:text-white"
                  >
                    <DownloadOutlined sx={{ fontSize: 14 }} />
                    {a.filename}
                  </a>
                ))}
              </div>
            )}

            {!lesson.completed && (
              <div>
                <button
                  onClick={onMarkComplete}
                  className="flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                >
                  <CheckCircleOutlined sx={{ fontSize: 16 }} />
                  Mark as complete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-4 rounded-xl bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {organization.name}
              </p>
              <p className="truncate text-xs text-neutral-400">{courseTitle}</p>
            </div>
            <button
              aria-label="Collapse"
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <CloseOutlined sx={{ fontSize: 14 }} />
            </button>
          </div>

          <div className="flex items-center gap-6 border-b border-white/10 pb-2">
            <button
              onClick={() => onChangeRightTab('lessons')}
              className={twMerge(
                'pb-2 text-sm font-medium transition-colors',
                rightTab === 'lessons'
                  ? 'border-b-2 border-rose-500 text-white'
                  : 'text-neutral-500 hover:text-neutral-300',
              )}
            >
              All Lessons
            </button>
            <button
              onClick={() => onChangeRightTab('notes')}
              className={twMerge(
                'pb-2 text-sm font-medium transition-colors',
                rightTab === 'notes'
                  ? 'border-b-2 border-rose-500 text-white'
                  : 'text-neutral-500 hover:text-neutral-300',
              )}
            >
              My Notes
            </button>
          </div>

          {rightTab === 'lessons' ? (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
              {lessons.map((l) => {
                const dur = formatDuration(l.duration_seconds)
                const active = l.id === lesson.id
                return (
                  <button
                    key={l.id}
                    onClick={() => !l.locked && onSelectLesson(l)}
                    disabled={l.locked}
                    className={twMerge(
                      'flex gap-3 text-left',
                      l.locked && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                      {l.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-600">
                          <PlayArrow sx={{ fontSize: 18 }} />
                        </div>
                      )}
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <PlayArrow
                            sx={{ fontSize: 22 }}
                            className="text-white"
                          />
                        </div>
                      )}
                      {dur && (
                        <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                          {dur}
                        </span>
                      )}
                    </div>
                    <p
                      className={twMerge(
                        'flex-1 text-sm leading-snug',
                        active
                          ? 'font-semibold text-white'
                          : 'text-neutral-300',
                      )}
                    >
                      {l.index + 1}. {l.title}
                    </p>
                  </button>
                )
              })}
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => onChangeNotes(e.target.value)}
              placeholder="Take notes for this lesson…"
              className="min-h-[40vh] w-full resize-none rounded-md border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function PillButton({
  icon,
  children,
  active,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={twMerge(
        'flex flex-col items-center gap-1 rounded-md px-3 py-2 text-[11px] font-medium transition-colors',
        active
          ? 'bg-white/10 text-white'
          : 'text-neutral-300 hover:bg-white/10 hover:text-white',
      )}
    >
      {icon}
      {children}
    </button>
  )
}
