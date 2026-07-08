'use client'

// WatchPlayer — the Spaire Originals v2 full-screen player, ported 1:1 from
// the design (originals2-parts.jsx → VideoPlayer) but driving a REAL video
// element instead of the prototype's simulated clock:
//
//   • scrub bar (click + drag) with buffered shading and knob
//   • ±10s skips, big center play, space/←/→/Esc/f keys
//   • volume + mute — hover-expanding glass slider, M / ↑ / ↓ keys,
//     level persisted across lessons (mute-only on iOS, where page
//     volume is hardware-controlled)
//   • playback speed — 0.5×–2× glass menu, persisted across lessons
//   • buffering spinner — a hairline arc whenever playback stalls
//     mid-stream, so a rebuffer never looks like a frozen frame
//   • captions button — wired to the video's text tracks; only rendered
//     when the asset actually carries captions, and kept in lock-step with
//     the on-screen captions so the button never lies about the state
//   • fullscreen button — real Fullscreen API on the player root (not a
//     disguised exit), with the icon/label reflecting the current state
//   • discussion side panel — rendered only when comment wiring is passed
//   • onProgress(frac) every 5s + on exit; onComplete at the end
//
// Used by the public landing (free-preview lessons, anonymous progress in
// localStorage) and by the customer portal when it adopts this design.

import { useCallback, useEffect, useRef, useState } from 'react'
import { HlsVideo } from '../HlsVideo'
import { Glyph, SF, SkipIcon, fmtTime } from './WatchGlyphs'
import { CommentsPanel, type WatchComment } from './WatchSheets'
import { WatchStyles } from './WatchStyles'

// Viewer preferences that outlive a single lesson (volume, mute, speed).
// A 1.5× learner stays at 1.5× for the whole course — and the next one.
const PREFS_KEY = 'polar-watch-player-prefs'
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

type PlayerPrefs = { volume: number; muted: boolean; rate: number }
const DEFAULT_PREFS: PlayerPrefs = { volume: 1, muted: false, rate: 1 }

function loadPrefs(): PlayerPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<PlayerPrefs>
    return {
      volume:
        typeof p.volume === 'number'
          ? Math.min(1, Math.max(0, p.volume))
          : DEFAULT_PREFS.volume,
      muted: p.muted === true,
      rate:
        typeof p.rate === 'number' && (RATES as readonly number[]).includes(p.rate)
          ? p.rate
          : DEFAULT_PREFS.rate,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(patch: Partial<PlayerPrefs>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...loadPrefs(), ...patch }),
    )
  } catch {
    /* storage unavailable (private mode) — prefs just don't persist */
  }
}

export type WatchLesson = {
  n: number
  title: string
  description?: string | null
  thumbnailUrl?: string | null
  muxPlaybackId?: string | null
  playbackUrl?: string | null
}

export function WatchPlayer({
  lesson,
  courseTitle,
  instructorName,
  startSec = 0,
  comments,
  canModerateComments,
  onPostComment,
  onLikeComment,
  onDeleteComment,
  onPinComment,
  onHeartComment,
  onClose,
  onProgress,
  onComplete,
}: {
  lesson: WatchLesson
  courseTitle: string
  instructorName?: string | null
  startSec?: number
  comments?: WatchComment[]
  canModerateComments?: boolean
  onPostComment?: (text: string, parentId?: string | null) => void
  onLikeComment?: (id: string) => void
  onDeleteComment?: (id: string) => void
  onPinComment?: (id: string) => void
  onHeartComment?: (id: string) => void
  onClose: () => void
  onProgress?: (frac: number) => void
  onComplete?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [paused, setPaused] = useState(true)
  const [buffered, setBuffered] = useState(0)
  const [hasCaptions, setHasCaptions] = useState(false)
  const [cc, setCc] = useState(false)
  // Mirror of `cc` for the polling loop, whose effect closes over the
  // initial value. The poll re-asserts the desired caption mode every
  // tick so the on-screen captions can never drift from the button (e.g.
  // when hls.js or the OS tries to re-enable a default subtitle track).
  const ccRef = useRef(false)
  ccRef.current = cc
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [side, setSide] = useState<null | 'discussion'>(null)
  const [uiVisible, setUiVisible] = useState(true)
  const barRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  const done = useRef(false)
  const startedRef = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── volume / speed / stall state ──
  // Initialized from persisted prefs; safe because the player only ever
  // mounts client-side (opened by a user interaction, never SSR'd).
  const [volume, setVolume] = useState(() => loadPrefs().volume)
  const [muted, setMuted] = useState(() => loadPrefs().muted)
  const [rate, setRate] = useState(() => loadPrefs().rate)
  const [rateOpen, setRateOpen] = useState(false)
  const [volOpen, setVolOpen] = useState(false)
  const [stalled, setStalled] = useState(false)
  // Mirrors for the polling loop / element wiring, same pattern as ccRef.
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const rateRef = useRef(rate)
  rateRef.current = rate
  const rateOpenRef = useRef(rateOpen)
  rateOpenRef.current = rateOpen
  const volBarRef = useRef<HTMLDivElement | null>(null)
  const volDragging = useRef(false)
  const volFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stallTicks = useRef(0)
  const prateRef = useRef<HTMLDivElement | null>(null)
  // iOS ignores programmatic volume (it's hardware-controlled), so the
  // slider would be a dead control there — show mute-only instead.
  const [isIOS] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      (/iP(hone|od|ad)/.test(navigator.userAgent) ||
        (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1)),
  )

  // ── element wiring ──
  const onVideoEl = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el
      if (!el) return
      // Apply the viewer's persisted prefs before anything plays, so a
      // lesson never opens at the wrong loudness or speed.
      el.volume = volumeRef.current
      el.muted = mutedRef.current
      el.playbackRate = rateRef.current
      const begin = () => {
        if (startedRef.current) return
        startedRef.current = true
        if (startSec > 0 && Number.isFinite(el.duration)) {
          el.currentTime = Math.min(startSec, Math.max(0, el.duration - 2))
        } else if (startSec > 0) {
          el.currentTime = startSec
        }
        void el.play().catch(() => setPaused(true))
      }
      if (el.readyState >= 1) begin()
      else el.addEventListener('loadedmetadata', begin, { once: true })
    },
    [startSec],
  )

  // Poll element state into React (time, duration, buffered, captions).
  useEffect(() => {
    const id = setInterval(() => {
      const el = videoRef.current
      if (!el) return
      setT(el.currentTime)
      if (Number.isFinite(el.duration) && el.duration > 0) setDur(el.duration)
      setPaused(el.paused)
      try {
        const b = el.buffered
        if (b.length > 0 && el.duration > 0) {
          setBuffered(b.end(b.length - 1) / el.duration)
        }
      } catch {
        /* ignore */
      }
      // Mirror the element's volume/mute so the speaker button can never
      // lie (autoplay policies and hls.js can both flip `muted`); re-assert
      // the playback rate the same defensive way captions are handled.
      setVolume(el.volume)
      setMuted(el.muted)
      if (el.playbackRate !== rateRef.current) {
        el.playbackRate = rateRef.current
      }
      // Stall detection: playing, but without enough data to keep going.
      // Two consecutive ticks (~500ms) before showing the spinner so a
      // normal seek or a healthy segment switch never flashes it.
      if (!el.paused && !el.ended && el.readyState < 3) {
        stallTicks.current += 1
      } else {
        stallTicks.current = 0
      }
      setStalled(stallTicks.current >= 2)
      // Detect caption tracks and keep their visibility pinned to the
      // viewer's choice. Re-asserting every tick (not just on toggle) means
      // nothing else — hls.js, the browser, or OS caption settings — can
      // flip a default track back on behind the button's back.
      let captionsPresent = false
      const want = ccRef.current ? 'showing' : 'hidden'
      for (const tr of el.textTracks) {
        if (tr.kind !== 'subtitles' && tr.kind !== 'captions') continue
        captionsPresent = true
        if (tr.mode !== want) tr.mode = want
      }
      setHasCaptions(captionsPresent)
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Captions toggle → native text track mode. The poll above also enforces
  // this, but applying it synchronously here makes the toggle feel instant
  // instead of waiting for the next poll tick.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    for (const tr of el.textTracks) {
      if (tr.kind === 'subtitles' || tr.kind === 'captions') {
        tr.mode = cc ? 'showing' : 'hidden'
      }
    }
  }, [cc, hasCaptions])

  // ── auto-hiding chrome ──
  // The title, controls and vignette are only there when the viewer needs
  // them. They show on entry and on any interaction (mouse, touch, keys,
  // scrubbing); after a few idle seconds of playback they fade away so the
  // viewer can focus on the video. Pausing keeps them up.
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      // Only fade out while the video is actually playing — a paused
      // player always keeps its controls visible. An open speed menu or a
      // volume drag counts as interacting: never fade mid-adjustment.
      if (
        videoRef.current &&
        !videoRef.current.paused &&
        !rateOpenRef.current &&
        !volDragging.current
      ) {
        setUiVisible(false)
      }
    }, 3000)
  }, [])

  const revealUi = useCallback(() => {
    setUiVisible(true)
    if (videoRef.current && !videoRef.current.paused) scheduleHide()
    else if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [scheduleHide])

  // Keep chrome up whenever paused or while the speed menu is open;
  // restart the idle countdown on play / menu close.
  useEffect(() => {
    if (paused || rateOpen) {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setUiVisible(true)
    } else {
      scheduleHide()
    }
  }, [paused, rateOpen, scheduleHide])

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (volFlashTimer.current) clearTimeout(volFlashTimer.current)
    },
    [],
  )

  const frac = dur > 0 ? Math.min(1, t / dur) : 0

  // ── progress reporting ──
  const fracRef = useRef(0)
  fracRef.current = frac
  useEffect(() => {
    const id = setInterval(() => {
      if (fracRef.current > 0) onProgress?.(fracRef.current)
    }, 5000)
    return () => clearInterval(id)
  }, [onProgress])
  useEffect(() => {
    if (frac >= 0.97 && dur > 0 && !done.current) {
      done.current = true
      onComplete?.()
    }
  }, [frac, dur, onComplete])

  const exit = useCallback(() => {
    if (fracRef.current > 0) onProgress?.(fracRef.current)
    videoRef.current?.pause()
    onClose()
  }, [onClose, onProgress])

  // ── real browser fullscreen ──
  // The player is a fixed overlay, but that still lives inside the browser
  // chrome (and the mobile address bar). The transport's fullscreen control
  // requests true fullscreen on the player root so the video fills the whole
  // screen, and mirrors the current state in its icon + label.
  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
      webkitExitFullscreen?: () => void
    }
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen)
        void document.exitFullscreen().catch(() => undefined)
      else doc.webkitExitFullscreen?.()
      return
    }
    const root = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
      | null
    if (root?.requestFullscreen) {
      void root.requestFullscreen().catch(() => undefined)
    } else if (root?.webkitRequestFullscreen) {
      root.webkitRequestFullscreen()
    } else {
      // iOS Safari only lets the <video> element itself go fullscreen.
      const video = videoRef.current as
        | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        | null
      video?.webkitEnterFullscreen?.()
    }
  }, [])

  const togglePlay = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) void el.play().catch(() => undefined)
    else el.pause()
  }, [])

  // ── volume + mute ──
  // The element is the single source of truth: every path writes to it
  // synchronously and mirrors into state, and the poll keeps them honest.
  const applyVolume = useCallback((v: number) => {
    const el = videoRef.current
    if (!el) return
    const clamped = Math.min(1, Math.max(0, v))
    el.volume = clamped
    // Dragging to zero reads as mute; any audible level unmutes.
    el.muted = clamped === 0
    setVolume(clamped)
    setMuted(el.muted)
    savePrefs({ volume: clamped, muted: el.muted })
  }, [])

  const toggleMute = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    if (el.muted || el.volume === 0) {
      el.muted = false
      // Unmuting at zero volume would be a silent no-op — restore to half.
      if (el.volume === 0) el.volume = 0.5
    } else {
      el.muted = true
    }
    setMuted(el.muted)
    setVolume(el.volume)
    savePrefs({ muted: el.muted, volume: el.volume })
  }, [])

  // Briefly expand the slider capsule after a keyboard volume change so
  // the level is visible without needing the pointer on the button.
  const flashVolume = useCallback(() => {
    setVolOpen(true)
    if (volFlashTimer.current) clearTimeout(volFlashTimer.current)
    volFlashTimer.current = setTimeout(() => setVolOpen(false), 1200)
  }, [])

  const setVolFromX = useCallback(
    (clientX: number) => {
      const bar = volBarRef.current
      if (!bar) return
      const r = bar.getBoundingClientRect()
      applyVolume((clientX - r.left) / r.width)
    },
    [applyVolume],
  )

  // ── playback speed ──
  const selectRate = useCallback((r: number) => {
    setRate(r)
    setRateOpen(false)
    const el = videoRef.current
    if (el) el.playbackRate = r
    savePrefs({ rate: r })
  }, [])

  // Close the speed menu on any press outside it.
  useEffect(() => {
    if (!rateOpen) return
    const onDown = (e: PointerEvent) => {
      if (prateRef.current && !prateRef.current.contains(e.target as Node)) {
        setRateOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [rateOpen])

  const seekBy = useCallback((delta: number) => {
    const el = videoRef.current
    if (!el || !Number.isFinite(el.duration)) return
    el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + delta))
  }, [])

  const seekAt = useCallback((clientX: number) => {
    const el = videoRef.current
    const bar = barRef.current
    if (!el || !bar || !Number.isFinite(el.duration)) return
    const r = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    el.currentTime = el.duration * ratio
    setT(el.currentTime)
  }, [])

  // Drag-to-scrub (mouse + touch).
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (dragging.current) seekAt(e.clientX)
    }
    const tm = (e: TouchEvent) => {
      if (dragging.current && e.touches[0]) seekAt(e.touches[0].clientX)
    }
    const up = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', mv)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', tm)
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', mv)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('touchend', up)
    }
  }, [seekAt])

  // Keyboard.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      revealUi()
      if (e.key === 'Escape') {
        if (rateOpen) setRateOpen(false)
        else if (side) setSide(null)
        // While fullscreen, the browser already exits fullscreen on Escape —
        // don't also tear down the whole player out from under the viewer.
        else if (document.fullscreenElement) return
        else exit()
      } else if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowRight') seekBy(10)
      else if (e.key === 'ArrowLeft') seekBy(-10)
      else if (e.key === 'ArrowUp') {
        e.preventDefault()
        applyVolume((mutedRef.current ? 0 : volumeRef.current) + 0.05)
        flashVolume()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        applyVolume(volumeRef.current - 0.05)
        flashVolume()
      } else if (e.key === 'm' || e.key === 'M') toggleMute()
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [
    side,
    rateOpen,
    exit,
    togglePlay,
    seekBy,
    revealUi,
    toggleFullscreen,
    applyVolume,
    flashVolume,
    toggleMute,
  ])

  // Lock page scroll while the player is up.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const hasDiscussion = comments != null

  // Mux assets stream HLS; anything else (e.g. a direct file URL) plays
  // through a plain element — mirrors the sample screen's split.
  const isHls = Boolean(
    lesson.muxPlaybackId ||
    (lesson.playbackUrl && lesson.playbackUrl.includes('.m3u8')),
  )
  const onEndedCb = useCallback(() => {
    if (!done.current) {
      done.current = true
      onComplete?.()
    }
  }, [onComplete])

  const effVol = muted ? 0 : volume
  const volGlyph =
    muted || volume === 0
      ? SF.audioMuted
      : volume < 0.55
        ? SF.audioLow
        : SF.audio

  return (
    <div
      ref={containerRef}
      className={`sov2 player ${uiVisible ? '' : 'ui-hidden'}`}
      data-watch-player
      onMouseMove={revealUi}
      onMouseDown={revealUi}
      onTouchStart={revealUi}
    >
      <div className="player-video">
        {isHls ? (
          <HlsVideo
            playbackId={lesson.muxPlaybackId ?? null}
            playbackUrl={lesson.playbackUrl ?? null}
            poster={lesson.thumbnailUrl ?? null}
            controls={false}
            className="watch-video"
            onVideoElement={onVideoEl}
            onEnded={onEndedCb}
          />
        ) : (
          <video
            src={lesson.playbackUrl ?? undefined}
            poster={lesson.thumbnailUrl ?? undefined}
            playsInline
            ref={onVideoEl}
            onEnded={onEndedCb}
          />
        )}
      </div>
      <div className="player-vignette" />

      {paused && (
        <button
          className="player-bigplay"
          onClick={togglePlay}
          aria-label="Play"
        >
          <Glyph d={SF.play} size={44} fill="#fff" />
        </button>
      )}

      {stalled && (
        <div className="player-spin" role="status" aria-label="Loading" />
      )}

      <div className="player-top">
        <button className="pbtn" onClick={exit} aria-label="Back">
          <Glyph d={SF.back} size={24} stroke={2} />
        </button>
        <div className="player-title">
          <div className="pt-k">
            {instructorName ? `${instructorName} · ` : ''}
            {courseTitle}
          </div>
          <div className="pt-t">
            Lesson {lesson.n} · {lesson.title}
          </div>
        </div>
      </div>

      <div className="player-controls">
        <div className="scrub-row">
          <span className="ptime">{fmtTime(t)}</span>
          <div
            className="scrub"
            ref={barRef}
            onMouseDown={(e) => {
              dragging.current = true
              seekAt(e.clientX)
            }}
            onTouchStart={(e) => {
              dragging.current = true
              if (e.touches[0]) seekAt(e.touches[0].clientX)
            }}
          >
            <div className="scrub-track">
              <div
                className="scrub-buf"
                style={{ width: `${Math.min(100, buffered * 100)}%` }}
              />
              <div className="scrub-fill" style={{ width: `${frac * 100}%` }} />
              <div className="scrub-knob" style={{ left: `${frac * 100}%` }} />
            </div>
          </div>
          <span className="ptime">-{fmtTime(Math.max(0, dur - t))}</span>
        </div>

        <div className="transport">
          <div className="tp-left">
            <span className="tp-chaplabel">{lesson.title}</span>
          </div>
          <div className="tp-center">
            <button
              className="pbtn"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
            >
              <SkipIcon dir={-1} n={10} size={30} />
            </button>
            <button
              className="pbtn big"
              onClick={togglePlay}
              aria-label={paused ? 'Play' : 'Pause'}
            >
              <Glyph
                d={paused ? SF.play : SF.pause}
                size={30}
                fill="currentColor"
              />
            </button>
            <button
              className="pbtn"
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
            >
              <SkipIcon dir={1} n={10} size={30} />
            </button>
          </div>
          <div className="tp-right">
            <div className={`pvol ${volOpen ? 'open' : ''}`}>
              {/* Slider precedes the button so the capsule grows leftward
                  into empty space instead of shoving the other controls.
                  Hidden on iOS, where page volume is hardware-only. */}
              {!isIOS && (
                <div
                  className="pvol-slider"
                  role="slider"
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(effVol * 100)}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    volDragging.current = true
                    setVolOpen(true)
                    if (volFlashTimer.current)
                      clearTimeout(volFlashTimer.current)
                    setVolFromX(e.clientX)
                  }}
                  onPointerMove={(e) => {
                    if (volDragging.current) setVolFromX(e.clientX)
                  }}
                  onPointerUp={() => {
                    volDragging.current = false
                    setVolOpen(false)
                  }}
                  onPointerCancel={() => {
                    volDragging.current = false
                    setVolOpen(false)
                  }}
                >
                  <div className="pvol-track" ref={volBarRef}>
                    <div
                      className="pvol-fill"
                      style={{ width: `${effVol * 100}%` }}
                    />
                    <div
                      className="pvol-knob"
                      style={{ left: `${effVol * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <button
                className="pbtn sm"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                aria-pressed={muted}
              >
                <Glyph d={volGlyph} size={21} stroke={1.9} />
              </button>
            </div>
            <div className="prate" ref={prateRef}>
              <button
                className={`pbtn sm ${rate !== 1 ? 'on' : ''}`}
                onClick={() => setRateOpen((o) => !o)}
                aria-label="Playback speed"
                aria-expanded={rateOpen}
              >
                <span className="prate-label">{rate}&times;</span>
              </button>
              {rateOpen && (
                <div className="pmenu" role="menu">
                  <div className="pmenu-title">Speed</div>
                  {RATES.map((r) => (
                    <button
                      key={r}
                      className={`pmenu-item ${r === rate ? 'on' : ''}`}
                      role="menuitemradio"
                      aria-checked={r === rate}
                      onClick={() => selectRate(r)}
                    >
                      <span>{r}&times;</span>
                      {r === rate && (
                        <Glyph d={SF.check} size={14} stroke={2.4} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {hasCaptions && (
              <button
                className={`pbtn sm ${cc ? 'on' : ''}`}
                onClick={() => setCc((c) => !c)}
                aria-label={cc ? 'Turn off captions' : 'Turn on captions'}
                aria-pressed={cc}
              >
                <Glyph d={SF.captions} size={21} stroke={1.9} />
              </button>
            )}
            {hasDiscussion && (
              <button
                className={`pbtn sm ${side === 'discussion' ? 'on' : ''}`}
                onClick={() =>
                  setSide((s) => (s === 'discussion' ? null : 'discussion'))
                }
                aria-label="Discussion"
                aria-pressed={side === 'discussion'}
              >
                <Glyph d={SF.bubble} size={21} stroke={2} />
                {comments!.length > 0 && (
                  <span className="pbtn-badge">{comments!.length}</span>
                )}
              </button>
            )}
            <button
              className="pbtn sm"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
              aria-pressed={isFullscreen}
            >
              <Glyph
                d={isFullscreen ? SF.fullscreenExit : SF.fullscreen}
                size={21}
                stroke={2}
              />
            </button>
          </div>
        </div>
      </div>

      {side === 'discussion' && hasDiscussion && (
        <CommentsPanel
          // The player is always dark, so its discussion panel is too —
          // otherwise it rendered as a white sheet over the dark video.
          dark
          lessonLabel={`Lesson ${lesson.n} · ${lesson.title}`}
          comments={comments!}
          canModerate={canModerateComments}
          instructorName={instructorName}
          onClose={() => setSide(null)}
          onLike={onLikeComment}
          onPost={onPostComment}
          onDelete={onDeleteComment}
          onPin={onPinComment}
          onHeart={onHeartComment}
        />
      )}

      <WatchStyles />
    </div>
  )
}

export default WatchPlayer
