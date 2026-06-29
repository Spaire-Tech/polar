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
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useUpdateCourse } from '@/hooks/queries/courses'

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

// Mirrors HlsVideo's tuning — see comment there. Keeps audio/video in
// sync for VOD playback by buffering ahead before frames hit the screen.
const SAMPLE_HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 30,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  startFragPrefetch: true,
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
      const instance = new (Hls as unknown as new (
        config: typeof SAMPLE_HLS_CONFIG,
      ) => HlsInstance)(SAMPLE_HLS_CONFIG)
      instance.loadSource(src)
      instance.attachMedia(videoRef.current)
      instance.on(
        (Hls as unknown as { Events: { ERROR: string } }).Events.ERROR,
        (...args: unknown[]) => {
          const data = args[1] as { fatal?: boolean; type?: string } | undefined
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

export function SampleSettingsPopover({
  open,
  onOpenChange,
  course,
  initial,
  unit = 'episode',
  lockedLessonId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: CourseRead
  initial: CourseRead['sample']
  /** "episode" for series, "lesson" for module courses — labels only. */
  unit?: 'episode' | 'lesson'
  /** When set, the picker is hidden and the sample is scoped to this one
   *  lesson — used when the editor opens from inside a single lesson. */
  lockedLessonId?: string | null
}) {
  const unitCap = unit === 'lesson' ? 'Lesson' : 'Episode'
  const updateCourse = useUpdateCourse()
  const allLessons = useMemo(() => flattenLessonsWithIndex(course), [course])
  const playableLessons = useMemo(
    () =>
      allLessons.filter(
        ({ lesson }) =>
          (lesson.mux_status ?? '').toLowerCase() === 'ready' &&
          (lesson.mux_playback_id ||
            (lesson as { mux_playback_url?: string }).mux_playback_url),
      ),
    [allLessons],
  )

  // When locked to a lesson, that lesson IS the sample source (the picker is
  // hidden). Whether this lesson already is the saved sample drives the
  // default enabled/start/duration.
  const lockedIsCurrent = Boolean(
    lockedLessonId && initial?.lesson_id === lockedLessonId,
  )
  const firstPlayableId = playableLessons[0]?.lesson.id ?? null
  const defaultLessonId =
    lockedLessonId ?? initial?.lesson_id ?? firstPlayableId
  const [enabled, setEnabled] = useState<boolean>(
    lockedLessonId ? true : (initial?.enabled ?? Boolean(firstPlayableId)),
  )
  const [lessonId, setLessonId] = useState<string | null>(defaultLessonId)
  const [startSeconds, setStartSeconds] = useState<number>(
    lockedIsCurrent ? (initial?.start_seconds ?? 0) : 0,
  )
  const [durationSeconds, setDurationSeconds] = useState<number>(
    lockedIsCurrent
      ? (initial?.duration_seconds ?? DEFAULT_DURATION_SEC)
      : DEFAULT_DURATION_SEC,
  )

  // Reset draft state when the popover (re)opens.
  useEffect(() => {
    if (!open) return
    setEnabled(
      lockedLessonId ? true : (initial?.enabled ?? Boolean(firstPlayableId)),
    )
    setLessonId(lockedLessonId ?? initial?.lesson_id ?? firstPlayableId)
    setStartSeconds(lockedIsCurrent ? (initial?.start_seconds ?? 0) : 0)
    setDurationSeconds(
      lockedIsCurrent
        ? (initial?.duration_seconds ?? DEFAULT_DURATION_SEC)
        : DEFAULT_DURATION_SEC,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, firstPlayableId, lockedLessonId])

  const selectedLesson = useMemo(
    () =>
      playableLessons.find(({ lesson }) => lesson.id === lessonId)?.lesson ??
      null,
    [playableLessons, lessonId],
  )
  const selectedLessonDuration = selectedLesson?.duration_seconds ?? 0
  const maxStart = Math.max(0, selectedLessonDuration - MIN_DURATION_SEC)
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
  // Preview audio is ON by default — the creator presses play themselves (a
  // user gesture), so the browser allows sound. This is what lets them
  // actually hear the cut they're choosing.
  const [previewMuted, setPreviewMuted] = useState(false)

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
        className="w-[420px] overflow-y-auto bg-white p-0 sm:max-w-[420px]"
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
            {unitCap} Sample
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
            {lockedLessonId ? 'Free sample' : 'Configure sample'}
          </h3>

          {(
            lockedLessonId
              ? !playableLessons.some((p) => p.lesson.id === lockedLessonId)
              : playableLessons.length === 0
          ) ? (
            <p
              style={{
                fontSize: 13,
                color: 'oklch(0.52 0.008 280)',
                lineHeight: 1.5,
              }}
            >
              {lockedLessonId
                ? `This ${unit}'s video isn't ready to clip yet. Upload a video and wait for it to finish processing, then set a sample.`
                : `No ${unit}s are ready to play yet. Upload at least one video to a ${unit}, then come back here.`}
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

              {/* Episode picker — hidden when the editor is locked to one
                  lesson (opened from inside that lesson). */}
              {!lockedLessonId && (
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
                    {unitCap}
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
                        {`${unitCap} ${String(index + 1).padStart(2, '0')} · ${lesson.title}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p
                style={{
                  fontSize: 12.5,
                  color: 'oklch(0.52 0.008 280)',
                  lineHeight: 1.5,
                  margin: '0 0 14px',
                }}
              >
                Drag <b>Start at</b> to find the exact moment — the frame below
                updates as you go — then set how long the clip runs. Press play
                to hear the cut.
              </p>

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
                    muted={previewMuted}
                    onClipEnd={() => {
                      setPreviewPlaying(false)
                      setHasEnded(true)
                    }}
                    videoRef={previewRef}
                  />
                  {/* Mute / unmute the preview. */}
                  <button
                    type="button"
                    onClick={() => setPreviewMuted((m) => !m)}
                    aria-label={
                      previewMuted ? 'Unmute preview' : 'Mute preview'
                    }
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      right: 50,
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: 'rgba(0,0,0,0.55)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {previewMuted ? (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M5 9v6h4l5 5V4L9 9H5zm12.59 3l2.7-2.7-1.42-1.42-2.7 2.71-2.71-2.71-1.41 1.42 2.7 2.7-2.7 2.7 1.41 1.42 2.71-2.71 2.7 2.71 1.42-1.42-2.7-2.7z" />
                      </svg>
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z" />
                      </svg>
                    )}
                  </button>
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
                    aria-label={
                      previewPlaying ? 'Pause preview' : 'Play preview'
                    }
                  >
                    {previewPlaying ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                      </svg>
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
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
                {/* Quick length presets — faster and clearer than hunting on
                    the slider for a common clip length. */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[15, 30, 45, 60, 90].map((preset) => {
                    const disabled = preset > maxDurationForLesson
                    const active = durationSeconds === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDurationSeconds(preset)}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 8,
                          border: `1px solid ${active ? 'oklch(0.18 0.008 280)' : 'oklch(0.92 0.003 280)'}`,
                          background: active ? 'oklch(0.18 0.008 280)' : '#fff',
                          color: active
                            ? '#fff'
                            : disabled
                              ? 'oklch(0.82 0.003 280)'
                              : 'oklch(0.32 0.008 280)',
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: FONT_VAR,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {preset}s
                      </button>
                    )
                  })}
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
