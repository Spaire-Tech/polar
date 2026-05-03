'use client'

import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export const HlsVideo = ({
  playbackId,
  poster,
  className,
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
}: {
  playbackId: string
  poster?: string | null
  className?: string
  controls?: boolean
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const src = `https://stream.mux.com/${playbackId}.m3u8`

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let cancelled = false
    let hls: { destroy: () => void } | null = null
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return
      if (Hls.isSupported()) {
        const instance = new Hls()
        instance.loadSource(src)
        instance.attachMedia(videoRef.current)
        hls = instance
      } else {
        videoRef.current.src = src
      }
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [playbackId])

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
    />
  )
}
