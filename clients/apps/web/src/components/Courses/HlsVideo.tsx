'use client'

import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type HlsInstance = {
  destroy: () => void
  loadSource: (src: string) => void
  attachMedia: (video: HTMLVideoElement) => void
  startLoad: () => void
  recoverMediaError: () => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

export const HlsVideo = ({
  playbackId,
  playbackUrl,
  poster,
  className,
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
  onEnded,
}: {
  playbackId?: string | null
  playbackUrl?: string | null
  poster?: string | null
  className?: string
  controls?: boolean
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  onEnded?: () => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Track the current Hls instance via a ref so a fast effect re-run
  // (e.g. switching lessons before the dynamic import resolves) can't
  // leak the previous one.
  const hlsRef = useRef<HlsInstance | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  // Prefer the server-signed playback URL. Fall back to building one from
  // the public playback id for legacy public assets.
  const src =
    playbackUrl ??
    (playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null)

  useEffect(() => {
    setFatalError(null)
    const video = videoRef.current
    if (!video || !src) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return
      // Cleanup any previous instance before creating a new one — protects
      // against the race where the effect re-ran before the import resolved.
      hlsRef.current?.destroy()
      if (!Hls.isSupported()) {
        videoRef.current.src = src
        return
      }
      const instance = new Hls() as unknown as HlsInstance
      instance.loadSource(src)
      instance.attachMedia(videoRef.current)
      // Recover from transient errors automatically; surface fatal ones so
      // the user gets a real error instead of a frozen black box.
      instance.on(
        (Hls as unknown as { Events: { ERROR: string } }).Events.ERROR,
        (...args: unknown[]) => {
          const data = args[1] as
            | { fatal?: boolean; type?: string; details?: string }
            | undefined
          if (!data?.fatal) return
          const ErrorTypes = (
            Hls as unknown as { ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string } }
          ).ErrorTypes
          if (data.type === ErrorTypes.NETWORK_ERROR) {
            instance.startLoad()
          } else if (data.type === ErrorTypes.MEDIA_ERROR) {
            instance.recoverMediaError()
          } else {
            setFatalError(data.details ?? 'Video playback failed')
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
  }, [src])

  if (fatalError) {
    return (
      <div
        className={twMerge(
          'flex h-full w-full flex-col items-center justify-center gap-2 bg-black px-6 text-center text-sm text-white/80',
          className,
        )}
      >
        <p>Couldn't play this video.</p>
        <button
          type="button"
          onClick={() => setFatalError(null)}
          className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay={autoPlay}
      controls={controls}
      muted={muted}
      loop={loop}
      playsInline
      poster={poster ?? undefined}
      className={twMerge('h-full w-full', className)}
      onEnded={onEnded}
    />
  )
}
