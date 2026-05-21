'use client'

// HeroMedia — hover-triggered trailer peek. The trailer only starts playing
// when the user actually hovers (or taps, on touch) the hero. It pauses on
// any scroll, mutes on any click outside the volume toggle, and fades back
// to the still image after `peekSeconds`. Audio only kicks in on the public
// landing (preview mode) — the studio's customize canvas always stays
// muted so the creator isn't blasted with sound while editing.

import { useEffect, useRef, useState } from 'react'
import { useEditor } from './EditorContext'

export function HeroMedia({
  imageUrl,
  imageObjectPosition,
  trailerUrl,
  peekSeconds = 10,
}: {
  imageUrl: string | null
  imageObjectPosition?: string | null
  trailerUrl: string | null
  peekSeconds?: number
}) {
  const ed = useEditor()
  // Audio is a public-landing thing only. In the studio (mode === 'edit')
  // the trailer always stays silent so the creator can work without the
  // soundtrack starting up every time they switch tabs.
  const audioAllowed = ed.mode === 'preview'

  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const volumeBtnRef = useRef<HTMLButtonElement | null>(null)
  // Phase drives which layer is visible:
  //   'image' — still poster, no playback
  //   'video' — trailer playing, peek countdown running
  const [phase, setPhase] = useState<'video' | 'image'>('image')
  const [muted, setMuted] = useState(true)
  const [hovered, setHovered] = useState(false)

  // Reset to the image whenever the trailer URL changes (e.g. uploading a
  // new trailer in the editor). The hover handler will retrigger playback.
  useEffect(() => {
    setPhase('image')
    setMuted(true)
  }, [trailerUrl])

  // Start the peek as soon as the user hovers. Scrolling, leaving the
  // hero, or hitting the end of the peek window all snap us back to the
  // still image.
  useEffect(() => {
    if (!trailerUrl) return
    if (!hovered) {
      setPhase('image')
      return
    }
    setPhase('video')
  }, [hovered, trailerUrl])

  // Peek countdown — runs only while the trailer is actually playing, and
  // bails out cleanly on phase / hover changes so timers never leak.
  useEffect(() => {
    if (phase !== 'video') return
    const v = videoRef.current
    if (!v) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const start = () => {
      timer = setTimeout(() => setPhase('image'), peekSeconds * 1000)
    }
    if (v.readyState >= 2) start()
    else v.addEventListener('loadeddata', start, { once: true })
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [phase, peekSeconds, trailerUrl])

  // Stop the trailer when the peek ends or the user moves away — pause the
  // element AND re-mute it. Pausing alone usually stops audio in modern
  // browsers, but resetting `muted` keeps it guaranteed-silent even if
  // some browser keeps decoding in the background.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (phase === 'image') {
      try {
        v.pause()
      } catch {
        // ignore — non-interactive .pause() never throws but be safe
      }
      // Rewind so the next hover starts from the top instead of resuming
      // from wherever we paused — a partial peek that picks up halfway
      // through feels broken.
      try {
        v.currentTime = 0
      } catch {
        /* noop */
      }
      setMuted(true)
    }
  }, [phase])

  // Pause + collapse the trailer on any scroll. The user explicitly
  // asked for this: glancing at the page shouldn't leave audio playing
  // somewhere off-screen.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      // Hover is implicitly broken by scroll too (the cursor isn't tracked
      // mid-scroll), but we reset both pieces of state explicitly so the
      // image snap-back is immediate instead of waiting for the next
      // mouseleave event.
      setHovered(false)
      setPhase('image')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Mute on any click outside the volume toggle. Lets the user silence
  // the trailer just by clicking the page rather than hunting for the
  // tiny speaker button.
  useEffect(() => {
    if (!audioAllowed) return
    if (muted) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (target && volumeBtnRef.current?.contains(target)) return
      setMuted(true)
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [audioAllowed, muted])

  // Reflect the muted state onto the actual <video>. When transitioning
  // from muted → unmuted some browsers pause the stream; re-issue
  // .play() and fall back to muted if it rejects.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = muted
    if (!muted && phase === 'video') {
      v.play().catch(() => setMuted(true))
    }
  }, [muted, phase])

  // Kick playback when the video phase starts. We don't use autoPlay on
  // the element itself — that would race with the hover gate and start
  // streaming on mount, defeating the whole "only on hover" intent.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (phase === 'video') {
      v.play().catch(() => {
        // Autoplay blocked even though we're muted (rare). The peek
        // window will just expire to the image and the user can hover
        // again to retry.
      })
    }
  }, [phase])

  if (!trailerUrl && !imageUrl) return null

  return (
    <div
      ref={containerRef}
      onPointerEnter={(e) => {
        // Ignore touch — tapping the hero on mobile shouldn't kick a
        // peek before the user can read the page. Pointer events from
        // touch report pointerType 'touch'.
        if (e.pointerType === 'touch') return
        if (trailerUrl) setHovered(true)
      }}
      onPointerLeave={() => setHovered(false)}
      style={{ position: 'absolute', inset: 0, zIndex: 1 }}
    >
      {trailerUrl && (
        <video
          ref={videoRef}
          src={trailerUrl}
          muted={muted}
          playsInline
          preload="auto"
          onError={(e) => {
            const v = e.currentTarget
            // eslint-disable-next-line no-console
            console.error('[HeroMedia] video failed to load', {
              src: trailerUrl,
              code: v.error?.code,
              message: v.error?.message,
              networkState: v.networkState,
              readyState: v.readyState,
            })
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: phase === 'video' ? 1 : 0,
            transition: 'opacity 600ms ease',
          }}
        />
      )}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          onError={() => {
            // eslint-disable-next-line no-console
            console.error('[HeroMedia] image failed to load', { src: imageUrl })
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: imageObjectPosition ?? '50% 50%',
            opacity: phase === 'image' || !trailerUrl ? 1 : 0,
            transition: 'opacity 600ms ease',
          }}
        />
      )}
      {audioAllowed && trailerUrl && phase === 'video' && (
        <button
          ref={volumeBtnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMuted((m) => !m)
          }}
          aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            zIndex: 4,
            width: 38,
            height: 38,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(20,20,22,0.55)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(8px) saturate(180%)',
            WebkitBackdropFilter: 'blur(8px) saturate(180%)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {muted ? <VolumeOffIcon /> : <VolumeOnIcon />}
        </button>
      )}
    </div>
  )
}

function VolumeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="m17 9 4 4M21 9l-4 4" />
    </svg>
  )
}

function VolumeOnIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </svg>
  )
}
