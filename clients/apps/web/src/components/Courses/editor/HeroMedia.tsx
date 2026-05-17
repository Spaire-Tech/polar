'use client'

// HeroMedia — Netflix/YouTube-style preview. If a trailer URL is set, plays
// the first `peekSeconds` of it, then fades AND pauses, settling on the
// still image. Audio only kicks in on the public landing (preview mode)
// — the studio's customize canvas always stays muted so the creator
// isn't blasted with sound while editing.

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

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<'video' | 'image'>(
    trailerUrl ? 'video' : 'image',
  )
  // Default muted (autoplay requires it). When `audioAllowed` is true a
  // user gesture flips this to false; we also flip it back to true when
  // the peek ends so the audio stops cleanly.
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    setPhase(trailerUrl ? 'video' : 'image')
  }, [trailerUrl])

  // Peek timer — once the trailer has buffered, schedule the fade back
  // to the still image. The cleanup also runs when the trailer URL
  // changes or the component unmounts, so timers never leak.
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

  // Stop the trailer when the peek ends — pause the element AND
  // re-mute it. Pausing alone usually stops audio in modern browsers,
  // but resetting `muted` keeps the audio guaranteed-silent even if
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
      setMuted(true)
    }
  }, [phase])

  // First-gesture auto-unmute — only on the public landing, only while
  // the peek is still showing. After the peek ends the effect above
  // re-mutes us, and this listener doesn't refire.
  useEffect(() => {
    if (!audioAllowed) return
    if (!trailerUrl) return
    if (phase !== 'video') return
    if (!muted) return
    const tryUnmute = () => setMuted(false)
    const opts = { once: true, capture: true } as const
    window.addEventListener('pointerdown', tryUnmute, opts)
    window.addEventListener('keydown', tryUnmute, opts)
    window.addEventListener('touchstart', tryUnmute, opts)
    return () => {
      window.removeEventListener('pointerdown', tryUnmute, opts)
      window.removeEventListener('keydown', tryUnmute, opts)
      window.removeEventListener('touchstart', tryUnmute, opts)
    }
  }, [audioAllowed, trailerUrl, phase, muted])

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

  if (!trailerUrl && !imageUrl) return null

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      {trailerUrl && (
        <video
          ref={videoRef}
          src={trailerUrl}
          autoPlay
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
