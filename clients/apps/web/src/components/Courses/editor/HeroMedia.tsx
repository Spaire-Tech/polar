'use client'

// HeroMedia — hover-triggered trailer peek. The trailer only starts playing
// when the user actually hovers (or taps, on touch) the hero. It pauses on
// any scroll and fades back to the still image after `peekSeconds`. Audio
// kicks in automatically on the public landing whenever the trailer is
// playing — the speaker button is still there as an escape hatch, but the
// default behavior is "sound on while you hover, silent when you move
// away". The studio's customize canvas always stays muted so the creator
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
  // still image. On the public landing, also auto-unmute so the viewer
  // hears the trailer the moment it starts — `v.play()` in the muted/phase
  // effect below will reject and fall back to muted if the browser blocks
  // unmuted autoplay (no prior gesture), but every subsequent hover after
  // any click on the page will succeed.
  useEffect(() => {
    if (!trailerUrl) return
    if (!hovered) {
      setPhase('image')
      return
    }
    setPhase('video')
    if (audioAllowed) setMuted(false)
  }, [hovered, trailerUrl, audioAllowed])

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

  // Note: previously a "click outside the volume toggle → mute" handler
  // lived here, but it actively fought the desired behavior — the viewer
  // would hover, hear sound briefly, accidentally click elsewhere, then
  // get muted with no way to re-enable audio without finding the speaker
  // button. The volume toggle (`volumeBtnRef`) is still rendered so the
  // viewer can mute manually if they want; the move-cursor-away action
  // already pauses the trailer and resets to muted via the phase effect
  // above.

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
      // Outer wrapper itself doesn't capture pointer events — it just
      // hosts the image/video layers. The hover trigger is a separate
      // smaller overlay (top portion only) so hovering near the title /
      // CTA stack at the bottom of the hero doesn't fire the trailer.
      // Volume button overrides this with its own pointerEvents:'auto'.
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      {/* Hover-trigger overlay — top portion of the hero only. The
          title + CTA stack lives in the bottom ~40% of the hero, so
          limiting the trigger to the top 55% means hovering over (or
          near) the CTAs never accidentally fires the trailer. */}
      {trailerUrl && (
        <div
          onPointerEnter={(e) => {
            if (e.pointerType === 'touch') return
            setHovered(true)
          }}
          onPointerLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '55%',
            zIndex: 3,
            pointerEvents: 'auto',
          }}
          aria-hidden
        />
      )}
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
            // Parent has pointerEvents:'none' so the title/CTA layer
            // beneath it stays clickable; re-enable here so the volume
            // toggle remains tappable.
            pointerEvents: 'auto',
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
