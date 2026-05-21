'use client'

// Series-only "Episode Sample" sub-hero. The creator picks one episode and a
// window inside it (start_seconds + duration_seconds), and that slice
// auto-plays on scroll as a frame below the main hero. When the slice ends
// (or the viewer pauses), a paywall overlay slides up with an enroll CTA.
//
// Three concerns colocated:
//   - <SeriesSampleBlock>      public-facing block (intersection trigger,
//                              fade-in, end overlay, replay)
//   - <SampleHlsPlayer>        muted HLS playback clipped to a [start, end]
//                              window, no controls
//   - <SampleSettingsPopover>  editor-only inline popover: episode picker,
//                              start time scrubber, duration slider,
//                              enable toggle. Saves directly via
//                              useUpdateCourse — separate from the editor's
//                              text/media override stack.

import { Sheet, SheetContent } from '@spaire/ui/components/ui/sheet'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useUpdateCourse } from '@/hooks/queries/courses'
import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useIsMobile } from '@/utils/mobile'
import { useEditor } from './EditorContext'

const MIN_DURATION_SEC = 5
const MAX_DURATION_SEC = 180
const DEFAULT_DURATION_SEC = 25

const FONT_VAR = 'var(--font-poppins), system-ui, sans-serif'
const HEADING_VAR = 'var(--font-poppins), system-ui, sans-serif'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Look up a lesson by id across both the dashboard shape (where
// course.modules[].lessons is populated) and the public landing shape
// (where modules carry only id/title and the lessons live exclusively in
// flatLessons). Falling back through both keeps this component agnostic
// about which surface it's rendering on.
function findLesson(
  course: CourseRead,
  flatLessons: CourseLessonRead[],
  lessonId: string | null | undefined,
): CourseLessonRead | null {
  if (!lessonId) return null
  for (const module of course.modules) {
    for (const lesson of module.lessons ?? []) {
      if (lesson.id === lessonId) return lesson
    }
  }
  return flatLessons.find((l) => l.id === lessonId) ?? null
}

// Flatten the course's lessons into a `(lesson, episode-number)` list so the
// picker can show "Episode 03 · The week before" rather than raw titles.
function flattenLessonsWithIndex(
  course: CourseRead,
): Array<{ lesson: CourseLessonRead; index: number }> {
  const sortedModules = [...course.modules].sort(
    (a, b) => a.position - b.position,
  )
  const list: Array<{ lesson: CourseLessonRead; index: number }> = []
  let i = 0
  for (const module of sortedModules) {
    const sorted = [...module.lessons].sort((a, b) => a.position - b.position)
    for (const lesson of sorted) {
      list.push({ lesson, index: i })
      i += 1
    }
  }
  return list
}

// ── HLS-clipped sample player ──────────────────────────────────────────────

type HlsInstance = {
  destroy: () => void
  loadSource: (src: string) => void
  attachMedia: (video: HTMLVideoElement) => void
  startLoad: () => void
  recoverMediaError: () => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

function SampleHlsPlayer({
  playbackId,
  playbackUrl,
  poster,
  startSeconds,
  durationSeconds,
  playing,
  muted,
  onClipEnd,
  videoRef,
}: {
  playbackId: string | null
  playbackUrl: string | null
  poster: string | null
  startSeconds: number
  durationSeconds: number
  playing: boolean
  muted: boolean
  onClipEnd: () => void
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
}) {
  const hlsRef = useRef<HlsInstance | null>(null)
  const [ready, setReady] = useState(false)
  // Suppress repeated onClipEnd fires while the listener tears down.
  const endedRef = useRef(false)

  const src =
    playbackUrl ??
    (playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null)

  // ── HLS bootstrap (mirrors HlsVideo) ──────────────────────────────────────
  useEffect(() => {
    setReady(false)
    endedRef.current = false
    const video = videoRef.current
    if (!video || !src) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return
      hlsRef.current?.destroy()
      if (!Hls.isSupported()) {
        videoRef.current.src = src
        return
      }
      const instance = new Hls() as unknown as HlsInstance
      instance.loadSource(src)
      instance.attachMedia(videoRef.current)
      instance.on(
        (Hls as unknown as { Events: { ERROR: string } }).Events.ERROR,
        (...args: unknown[]) => {
          const data = args[1] as
            | { fatal?: boolean; type?: string }
            | undefined
          if (!data?.fatal) return
          const ErrorTypes = (
            Hls as unknown as {
              ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string }
            }
          ).ErrorTypes
          if (data.type === ErrorTypes.NETWORK_ERROR) instance.startLoad()
          else if (data.type === ErrorTypes.MEDIA_ERROR)
            instance.recoverMediaError()
          else {
            instance.destroy()
            if (hlsRef.current === instance) hlsRef.current = null
          }
        },
      )
      hlsRef.current = instance
    })

    return () => {
      cancelled = true
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [src, videoRef])

  // ── Seek to start once metadata loads ─────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const seek = () => {
      try {
        video.currentTime = Math.max(0, startSeconds)
      } catch {
        // Some browsers throw if the seek lands before the buffer is ready.
        // Retry once metadata + buffer are both available.
      }
      setReady(true)
    }
    if (video.readyState >= 1) {
      seek()
    } else {
      video.addEventListener('loadedmetadata', seek, { once: true })
      return () => video.removeEventListener('loadedmetadata', seek)
    }
  }, [startSeconds, src, videoRef])

  // ── Clip-end watchdog: timeupdate-driven pause + onClipEnd notification ──
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const clipEnd = startSeconds + durationSeconds
    const onTime = () => {
      if (endedRef.current) return
      if (video.currentTime >= clipEnd) {
        endedRef.current = true
        try {
          video.pause()
        } catch {
          /* noop */
        }
        onClipEnd()
      }
    }
    video.addEventListener('timeupdate', onTime)
    return () => video.removeEventListener('timeupdate', onTime)
  }, [startSeconds, durationSeconds, onClipEnd, videoRef])

  // ── Play / pause based on viewport state ──────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready) return
    if (playing) {
      // Reset the ended flag so a re-entry into the viewport can replay.
      endedRef.current = false
      // Re-seek to start if we exited and re-entered after the clip ended.
      if (video.currentTime >= startSeconds + durationSeconds - 0.1) {
        try {
          video.currentTime = Math.max(0, startSeconds)
        } catch {
          /* noop */
        }
      }
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Most likely autoplay rejected on mobile — caller will fall back
          // to tap-to-play.
        })
      }
    } else {
      try {
        video.pause()
      } catch {
        /* noop */
      }
    }
  }, [playing, ready, startSeconds, durationSeconds, videoRef])

  return (
    <video
      ref={videoRef}
      muted={muted}
      playsInline
      preload="metadata"
      poster={poster ?? undefined}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        background: '#000',
      }}
    />
  )
}

// ── Editor-only settings popover ───────────────────────────────────────────

function SampleSettingsPopover({
  open,
  onOpenChange,
  course,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: CourseRead
  initial: CourseRead['sample']
}) {
  const updateCourse = useUpdateCourse()
  const allLessons = useMemo(() => flattenLessonsWithIndex(course), [course])
  const playableLessons = useMemo(
    () =>
      allLessons.filter(
        ({ lesson }) =>
          (lesson.mux_status ?? '').toLowerCase() === 'ready' &&
          (lesson.mux_playback_id || (lesson as { mux_playback_url?: string }).mux_playback_url),
      ),
    [allLessons],
  )

  const firstPlayableId = playableLessons[0]?.lesson.id ?? null
  const [enabled, setEnabled] = useState<boolean>(
    initial?.enabled ?? Boolean(firstPlayableId),
  )
  const [lessonId, setLessonId] = useState<string | null>(
    initial?.lesson_id ?? firstPlayableId,
  )
  const [startSeconds, setStartSeconds] = useState<number>(
    initial?.start_seconds ?? 0,
  )
  const [durationSeconds, setDurationSeconds] = useState<number>(
    initial?.duration_seconds ?? DEFAULT_DURATION_SEC,
  )

  // Reset draft state when the popover (re)opens.
  useEffect(() => {
    if (!open) return
    setEnabled(initial?.enabled ?? Boolean(firstPlayableId))
    setLessonId(initial?.lesson_id ?? firstPlayableId)
    setStartSeconds(initial?.start_seconds ?? 0)
    setDurationSeconds(initial?.duration_seconds ?? DEFAULT_DURATION_SEC)
  }, [open, initial, firstPlayableId])

  const selectedLesson = useMemo(
    () =>
      playableLessons.find(({ lesson }) => lesson.id === lessonId)?.lesson ??
      null,
    [playableLessons, lessonId],
  )
  const selectedLessonDuration = selectedLesson?.duration_seconds ?? 0
  const maxStart = Math.max(
    0,
    selectedLessonDuration - MIN_DURATION_SEC,
  )
  const maxDurationForLesson = Math.min(
    MAX_DURATION_SEC,
    Math.max(MIN_DURATION_SEC, selectedLessonDuration - startSeconds),
  )

  // Clamp draft values when the chosen lesson changes (or its duration
  // is shorter than the previously-saved window).
  useEffect(() => {
    setStartSeconds((s) => Math.min(Math.max(0, s), maxStart))
  }, [maxStart])
  useEffect(() => {
    setDurationSeconds((d) =>
      Math.min(Math.max(MIN_DURATION_SEC, d), maxDurationForLesson),
    )
  }, [maxDurationForLesson])

  // Live preview ref so the scrubber drives the inline player.
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [hasEnded, setHasEnded] = useState(false)

  const submitting = updateCourse.isPending
  const canSave = Boolean(lessonId) && !submitting

  const handleSave = async () => {
    if (!canSave) return
    const body =
      enabled && lessonId
        ? {
            sample: {
              enabled: true,
              lesson_id: lessonId,
              start_seconds: Math.max(0, Math.floor(startSeconds)),
              duration_seconds: Math.max(
                MIN_DURATION_SEC,
                Math.min(MAX_DURATION_SEC, Math.floor(durationSeconds)),
              ),
            },
          }
        : { sample: null }
    try {
      await updateCourse.mutateAsync({ courseId: course.id, body })
      onOpenChange(false)
    } catch (err) {
      console.error('[SampleSettings] save failed', err)
    }
  }

  const handleClear = async () => {
    if (submitting) return
    try {
      await updateCourse.mutateAsync({
        courseId: course.id,
        body: { sample: null },
      })
      onOpenChange(false)
    } catch (err) {
      console.error('[SampleSettings] clear failed', err)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] overflow-y-auto bg-white p-0"
      >
        <div
          style={{
            fontFamily: FONT_VAR,
            padding: 24,
            color: 'oklch(0.18 0.008 280)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'oklch(0.66 0.006 280)',
              marginBottom: 8,
            }}
          >
            Episode Sample
          </div>
          <h3
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 18px',
              fontFamily: HEADING_VAR,
            }}
          >
            Configure sample
          </h3>

          {playableLessons.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: 'oklch(0.52 0.008 280)',
                lineHeight: 1.5,
              }}
            >
              No episodes are ready to play yet. Upload at least one video to
              an episode, then come back here.
            </p>
          ) : (
            <>
              {/* Enable toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: '1px solid oklch(0.92 0.003 280)',
                  marginBottom: 16,
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    Show on landing
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'oklch(0.52 0.008 280)',
                      marginTop: 2,
                    }}
                  >
                    Plays automatically when scrolled into view.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
              </label>

              {/* Episode picker */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'oklch(0.52 0.008 280)',
                    marginBottom: 8,
                  }}
                >
                  Episode
                </div>
                <select
                  value={lessonId ?? ''}
                  onChange={(e) => setLessonId(e.target.value || null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid oklch(0.92 0.003 280)',
                    background: '#fff',
                    fontSize: 13.5,
                    fontFamily: FONT_VAR,
                    color: 'oklch(0.18 0.008 280)',
                  }}
                >
                  {playableLessons.map(({ lesson, index }) => (
                    <option key={lesson.id} value={lesson.id}>
                      {`Episode ${String(index + 1).padStart(2, '0')} · ${lesson.title}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Inline scrub preview */}
              {selectedLesson && (
                <div
                  style={{
                    aspectRatio: '16 / 9',
                    width: '100%',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#000',
                    marginBottom: 14,
                    position: 'relative',
                  }}
                >
                  <SampleHlsPlayer
                    playbackId={selectedLesson.mux_playback_id ?? null}
                    playbackUrl={
                      (selectedLesson as { mux_playback_url?: string | null })
                        .mux_playback_url ?? null
                    }
                    poster={selectedLesson.thumbnail_url ?? null}
                    startSeconds={startSeconds}
                    durationSeconds={durationSeconds}
                    playing={previewPlaying}
                    muted
                    onClipEnd={() => {
                      setPreviewPlaying(false)
                      setHasEnded(true)
                    }}
                    videoRef={previewRef}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (hasEnded) {
                        setHasEnded(false)
                        // Reseek manually before re-play.
                        if (previewRef.current) {
                          try {
                            previewRef.current.currentTime = startSeconds
                          } catch {
                            /* noop */
                          }
                        }
                      }
                      setPreviewPlaying((p) => !p)
                    }}
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      right: 10,
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: 'rgba(0,0,0,0.55)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
                  >
                    {previewPlaying ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {/* Start time */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'oklch(0.52 0.008 280)',
                    }}
                  >
                    Start at
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'oklch(0.52 0.008 280)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatTime(startSeconds)} ·{' '}
                    {selectedLessonDuration
                      ? `${formatTime(selectedLessonDuration)} total`
                      : 'no duration yet'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, maxStart)}
                  step={1}
                  value={startSeconds}
                  onChange={(e) => setStartSeconds(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Duration */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'oklch(0.52 0.008 280)',
                    }}
                  >
                    Duration
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'oklch(0.52 0.008 280)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {`${durationSeconds}s · ends at ${formatTime(
                      startSeconds + durationSeconds,
                    )}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_DURATION_SEC}
                  max={maxDurationForLesson}
                  step={1}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 999,
                    background:
                      'linear-gradient(180deg, oklch(0.28 0.008 280) 0%, oklch(0.14 0.008 280) 100%)',
                    color: 'white',
                    fontSize: 13.5,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    border: 'none',
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    opacity: canSave ? 1 : 0.5,
                    fontFamily: FONT_VAR,
                  }}
                >
                  {submitting ? 'Saving…' : 'Save sample'}
                </button>
                {initial && (
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={submitting}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 999,
                      background: 'transparent',
                      color: 'oklch(0.52 0.008 280)',
                      fontSize: 13,
                      fontWeight: 500,
                      border: '1px solid oklch(0.92 0.003 280)',
                      cursor: 'pointer',
                      fontFamily: FONT_VAR,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Public-facing block ────────────────────────────────────────────────────

export function SeriesSampleBlock({
  course,
  flatLessons,
  priceLabel,
  onEnroll,
  canEnroll,
  enrolling,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
  priceLabel: string | null
  onEnroll: () => void
  canEnroll: boolean
  enrolling: boolean
}) {
  const editor = useEditor()
  const inEditMode = editor.mode === 'edit'
  // Match hero's mobile-detection logic — studio toggle wins, otherwise fall
  // back to the actual viewport. The player frame uses a taller aspect ratio
  // on mobile so the sample reads as substantial as the hero above it.
  const viewportIsMobile = useIsMobile().isMobile
  const isMobile =
    editor.device === 'mobile' ||
    (editor.device === 'desktop' && viewportIsMobile)

  // Editor settings popover. Always available in edit mode, regardless of
  // whether the sample is configured yet.
  const [settingsOpen, setSettingsOpen] = useState(false)

  // For the public view, hide entirely when there's no sample or it's
  // disabled. Editor view always shows the block (empty state if unset) so
  // the creator can configure it.
  const sample = course.sample
  const lesson = findLesson(course, flatLessons, sample?.lesson_id ?? null)
  // Sample is "usable" when we have playback data, from either source:
  //   - public landing: sample.mux_playback_id / sample.mux_playback_url
  //     are embedded directly on the payload (the server bypasses the
  //     free-preview lesson-strip gate for the sample on purpose).
  //   - dashboard editor: we look the lesson up via flatLessons /
  //     course.modules and read mux_playback_id off it.
  const samplePlaybackId =
    sample?.mux_playback_id ?? lesson?.mux_playback_id ?? null
  const samplePlaybackUrl =
    sample?.mux_playback_url ??
    (lesson as { mux_playback_url?: string | null } | null)?.mux_playback_url ??
    null
  const hasUsableSample = Boolean(
    sample && sample.enabled && (samplePlaybackId || samplePlaybackUrl),
  )

  if (course.format !== 'series') return null
  if (!inEditMode && !hasUsableSample) return null

  return (
    <section
      style={{
        padding: '20px 20px 8px',
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          margin: '0 auto',
        }}
      >
        {hasUsableSample && sample ? (
          <SamplePlayerFrame
            course={course}
            lessonTitle={
              sample.lesson_title ?? lesson?.title ?? 'Sample'
            }
            lessonThumbnailUrl={
              sample.thumbnail_url ?? lesson?.thumbnail_url ?? null
            }
            playbackId={samplePlaybackId}
            playbackUrl={samplePlaybackUrl}
            sample={sample}
            priceLabel={priceLabel}
            onEnroll={onEnroll}
            canEnroll={canEnroll}
            enrolling={enrolling}
            isMobile={isMobile}
          />
        ) : (
          <SampleEmptyState
            onConfigure={() => setSettingsOpen(true)}
            isMobile={isMobile}
          />
        )}

        {inEditMode && hasUsableSample && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 14,
            }}
          >
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              style={{
                fontFamily: FONT_VAR,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                color: 'oklch(0.52 0.008 280)',
                background: 'oklch(0.97 0.002 280)',
                border: '1px solid oklch(0.92 0.003 280)',
                borderRadius: 999,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              Sample settings
            </button>
          </div>
        )}
      </div>

      {inEditMode && (
        <SampleSettingsPopover
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          course={course}
          initial={sample}
        />
      )}
    </section>
  )
}

function SampleEmptyState({
  onConfigure,
  isMobile,
}: {
  onConfigure: () => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: isMobile ? '4 / 5' : '16 / 9',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        border: '1px dashed oklch(0.86 0.003 280)',
        background:
          'linear-gradient(180deg, oklch(0.985 0.003 280) 0%, oklch(0.96 0.003 280) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 32px',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'oklch(0.66 0.006 280)',
          marginBottom: 10,
        }}
      >
        Episode Sample
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'oklch(0.18 0.008 280)',
          marginBottom: 6,
          maxWidth: 420,
        }}
      >
        Drop viewers straight into an episode.
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'oklch(0.52 0.008 280)',
          lineHeight: 1.55,
          margin: '0 0 16px',
          maxWidth: 420,
        }}
      >
        Pick an episode, pick a moment, and a clip of that moment plays here
        on the public page when someone scrolls past.
      </p>
      <button
        type="button"
        onClick={onConfigure}
        style={{
          padding: '10px 18px',
          borderRadius: 999,
          background:
            'linear-gradient(180deg, oklch(0.28 0.008 280) 0%, oklch(0.14 0.008 280) 100%)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT_VAR,
          letterSpacing: '-0.01em',
        }}
      >
        Configure sample
      </button>
    </div>
  )
}

// ── Player frame (intersection trigger + fade-in + end overlay) ────────────

function SamplePlayerFrame({
  course: _course,
  lessonTitle,
  lessonThumbnailUrl,
  playbackId,
  playbackUrl,
  sample,
  priceLabel,
  onEnroll,
  canEnroll,
  enrolling,
  isMobile,
}: {
  course: CourseRead
  lessonTitle: string
  lessonThumbnailUrl: string | null
  playbackId: string | null
  playbackUrl: string | null
  sample: NonNullable<CourseRead['sample']>
  priceLabel: string | null
  onEnroll: () => void
  canEnroll: boolean
  enrolling: boolean
  isMobile: boolean
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [inView, setInView] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  // hasShown drives the fade-in animation. We only flip it true the first
  // time the block enters view — after that, the animation stays settled.
  const [muted, setMuted] = useState(true)
  const [ended, setEnded] = useState(false)
  // Touch-device autoplay falls back to a tap-to-play poster overlay.
  const [isTouchUA, setIsTouchUA] = useState(false)
  const [tapPlayed, setTapPlayed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsTouchUA(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  }, [])

  // Intersection observer with threshold + rootMargin (the global hook is
  // threshold=0, which would fire on the smallest sliver of overlap).
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const node = frameRef.current
    if (!node) return
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          setInView(true)
          setHasShown(true)
        } else if (entry.intersectionRatio < 0.3) {
          setInView(false)
        }
      },
      { threshold: [0, 0.3, 0.6], rootMargin: '-10% 0px' },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  // On touch devices we don't autoplay — wait for the tap before flipping
  // the "playing" flag.
  const playing = !ended && (isTouchUA ? tapPlayed && inView : inView)

  const handleReplay = () => {
    setEnded(false)
    setTapPlayed(true)
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = sample.start_seconds
      } catch {
        /* noop */
      }
    }
  }

  return (
    <div
      ref={frameRef}
      style={{
        position: 'relative',
        width: '100%',
        opacity: hasShown ? 1 : 0,
        transform: hasShown ? 'translateY(0)' : 'translateY(12px)',
        transition:
          'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'oklch(0.52 0.008 280)',
          marginBottom: 8,
        }}
      >
        Sample
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'oklch(0.18 0.008 280)',
          marginBottom: 16,
          fontFamily: HEADING_VAR,
        }}
      >
        {lessonTitle}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: isMobile ? '4 / 5' : '16 / 9',
          borderRadius: 'calc(28px * var(--radius-mul, 1))',
          overflow: 'hidden',
          background: '#000',
          boxShadow:
            '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.10)',
          border: '1px solid oklch(0.92 0.003 280)',
        }}
      >
        <SampleHlsPlayer
          playbackId={playbackId}
          playbackUrl={playbackUrl}
          poster={lessonThumbnailUrl}
          startSeconds={sample.start_seconds}
          durationSeconds={sample.duration_seconds}
          playing={playing}
          muted={muted}
          onClipEnd={() => setEnded(true)}
          videoRef={videoRef}
        />

        {/* Mute / unmute toggle, bottom-right */}
        {!ended && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute sample' : 'Mute sample'}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px) saturate(180%)',
              WebkitBackdropFilter: 'blur(12px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease',
            }}
          >
            {muted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 9v6h4l5 5V4L9 9H5zm12.59 3l2.7-2.7-1.42-1.42-2.7 2.71-2.71-2.71-1.41 1.42 2.7 2.7-2.7 2.7 1.41 1.42 2.71-2.71 2.7 2.71 1.42-1.42-2.7-2.7z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z" />
              </svg>
            )}
          </button>
        )}

        {/* Touch-device tap-to-play poster */}
        {isTouchUA && !tapPlayed && !ended && (
          <button
            type="button"
            onClick={() => setTapPlayed(true)}
            aria-label="Play sample"
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px) saturate(180%)',
                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}

        {/* End-of-clip paywall overlay. Styles live in the <style jsx> block
            below so a @media query can shrink everything for narrow
            viewports — overrides wouldn't apply through inline styles. */}
        {ended && (
          <div className="sample-end-overlay">
            <div className="sample-end-eyebrow">Members only</div>
            <div className="sample-end-title">Enroll to keep watching</div>
            <div className="sample-end-sub">
              {lessonTitle}
              {priceLabel ? ` · ${priceLabel}` : ''} · lifetime access
            </div>
            <div className="sample-end-actions">
              <button
                type="button"
                onClick={onEnroll}
                disabled={!canEnroll || enrolling}
                className="sample-end-primary"
              >
                {enrolling
                  ? 'Loading…'
                  : `Enroll${priceLabel ? ` · ${priceLabel}` : ''}`}
              </button>
              <button
                type="button"
                onClick={handleReplay}
                className="sample-end-secondary"
              >
                Replay sample
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes sampleEndFade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* End-of-clip paywall overlay. Sized for a desktop 16:9 frame, then
           tightened twice (≤700px and ≤480px) so the headline + sub + CTAs
           still fit inside the smaller 16:9 frame on phones. */
        .sample-end-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.2) 0%,
            rgba(0, 0, 0, 0.78) 65%,
            rgba(0, 0, 0, 0.92) 100%
          );
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding: 24px 28px 26px;
          color: #fff;
          font-family: var(--font-poppins), system-ui, sans-serif;
          text-align: center;
          animation: sampleEndFade 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sample-end-eyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 10px;
        }
        .sample-end-title {
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin-bottom: 8px;
          font-family: var(--font-poppins), system-ui, sans-serif;
        }
        .sample-end-sub {
          font-size: 13.5px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.5;
          margin-bottom: 18px;
          max-width: 460px;
        }
        .sample-end-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
        }
        .sample-end-primary {
          padding: 12px 22px;
          border-radius: 999px;
          background: #fff;
          color: oklch(0.18 0.008 280);
          font-size: 13.5px;
          font-weight: 600;
          letter-spacing: -0.01em;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .sample-end-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .sample-end-secondary {
          padding: 11px 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        @media (max-width: 700px) {
          .sample-end-overlay {
            padding: 14px 16px 14px;
          }
          .sample-end-eyebrow {
            font-size: 9px;
            letter-spacing: 0.18em;
            margin-bottom: 4px;
          }
          .sample-end-title {
            font-size: 17px;
            line-height: 1.1;
            margin-bottom: 4px;
          }
          .sample-end-sub {
            font-size: 11.5px;
            line-height: 1.35;
            margin-bottom: 10px;
            /* Hide on phone — title + price-on-CTA carry the message. */
            display: none;
          }
          .sample-end-actions {
            gap: 6px;
          }
          .sample-end-primary {
            padding: 9px 16px;
            font-size: 12.5px;
          }
          .sample-end-secondary {
            padding: 8px 14px;
            font-size: 12px;
          }
        }

        @media (max-width: 380px) {
          .sample-end-overlay {
            padding: 10px 12px 10px;
          }
          .sample-end-title {
            font-size: 15px;
          }
          .sample-end-primary {
            padding: 8px 14px;
            font-size: 12px;
          }
          .sample-end-secondary {
            padding: 7px 12px;
            font-size: 11.5px;
          }
        }
      `}</style>
    </div>
  )
}
