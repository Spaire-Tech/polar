'use client'

// HeroMedia — Netflix/YouTube-style preview. If a trailer URL is set, plays
// the first `peekSeconds` muted, then fades to the still image. If only one
// of the two is set we just render that. If neither is set the parent's
// placeholder backdrop shows through.

import { useEffect, useRef, useState } from 'react'

export function HeroMedia({
  imageUrl,
  trailerUrl,
  peekSeconds = 10,
}: {
  imageUrl: string | null
  trailerUrl: string | null
  peekSeconds?: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<'video' | 'image'>(
    trailerUrl ? 'video' : 'image',
  )

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

  if (!trailerUrl && !imageUrl) return null

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      {trailerUrl && (
        <video
          ref={videoRef}
          src={trailerUrl}
          autoPlay
          muted
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
            opacity: phase === 'image' || !trailerUrl ? 1 : 0,
            transition: 'opacity 600ms ease',
          }}
        />
      )}
    </div>
  )
}
