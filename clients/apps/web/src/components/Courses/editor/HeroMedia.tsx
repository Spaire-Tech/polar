'use client'

// HeroMedia — Netflix/YouTube-style preview. If a trailer URL is set, plays
// the first `peekSeconds` of it, then fades to the still image. Starts
// muted (browsers reject unmuted autoplay without a prior user gesture)
// and auto-unmutes on the first interaction with the page. Renders a
// small volume toggle in the corner so the viewer can mute again or
// turn sound on early on touch devices where document interactions
// already counted.

import { useEffect, useRef, useState } from 'react'

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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<'video' | 'image'>(
    trailerUrl ? 'video' : 'image',
  )
  // Start muted so the browser always allows autoplay. A user gesture
  // (anywhere on the page, including the unmute button itself) flips
  // this to false and we call .play() again to re-enter audio.
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    setPhase(trailerUrl ? 'video' : 'image')
  }, [trailerUrl])

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

  // Auto-unmute on the first user interaction with the page. Most
  // browsers count a pointerdown / keydown / touchstart as an
  // engagement signal, so we listen for any of those once and flip
  // muted to false. If the user navigated to this page from a click
  // on a previous page, the first listener call usually fires within
  // a few hundred ms of mount.
  useEffect(() => {
    if (!trailerUrl) return
    if (!muted) return
    const tryUnmute = () => {
      setMuted(false)
    }
    const opts = { once: true, capture: true } as const
    window.addEventListener('pointerdown', tryUnmute, opts)
    window.addEventListener('keydown', tryUnmute, opts)
    window.addEventListener('touchstart', tryUnmute, opts)
    return () => {
      window.removeEventListener('pointerdown', tryUnmute, opts)
      window.removeEventListener('keydown', tryUnmute, opts)
      window.removeEventListener('touchstart', tryUnmute, opts)
    }
  }, [trailerUrl, muted])

  // Reflect the muted state onto the actual <video> element. When
  // switching from muted → unmuted, the browser may pause the stream
  // on some autoplay-restricted pages — call .play() again and fall
  // back to muted if the promise rejects.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = muted
    if (!muted) {
      v.play().catch(() => {
        setMuted(true)
      })
    }
  }, [muted])

  if (!trailerUrl && !imageUrl) return null

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      {trailerUrl && (
        <video
          ref={videoRef}
          src={trailerUrl}
          autoPlay
          // `muted` attribute mirrors the React state — see the effect
          // above. Initial render is muted so autoplay is allowed.
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
      {trailerUrl && phase === 'video' && (
        <button
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
            transition: 'opacity 200ms ease',
            opacity: phase === 'video' ? 1 : 0,
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
