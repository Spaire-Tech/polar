'use client'

// Render-only harness for the Spaire Originals v2 watch components:
//   /embed/watch            → WatchPlayer over a synthesized webm clip
//   /embed/watch?sheet=1    → OverviewSheet (rich lesson data)
//   /embed/watch?comments=1 → CommentsPanel
//   &dark=1                 → dark theme for the sheets/panel
// The clip is generated client-side (canvas + MediaRecorder) so real
// playback, scrubbing, and progress can be verified without a Mux asset.

import { WatchPlayer } from '@/components/Courses/watch/WatchPlayer'
import {
  CommentsPanel,
  OverviewSheet,
  type WatchComment,
} from '@/components/Courses/watch/WatchSheets'
import { useEffect, useState } from 'react'

const COMMENTS: WatchComment[] = [
  {
    id: 'c1',
    name: 'Amara Okeke',
    time: '2d',
    text: 'Three minutes in and I already understand why I keep losing close matches.',
    likes: 12,
    liked: true,
  },
  {
    id: 'c2',
    name: 'Diego Fuentes',
    time: '1d',
    text: 'Coming back after 10 years off. Exactly the reset I needed.',
    likes: 5,
  },
]

export default function WatchEmbedPage() {
  const [params, setParams] = useState<URLSearchParams | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [progressLog, setProgressLog] = useState<number[]>([])

  useEffect(() => {
    setParams(new URLSearchParams(window.location.search))
  }, [])

  // Synthesize a short real video clip (same trick as /embed/generated-portal).
  useEffect(() => {
    if (!params || params.get('sheet') || params.get('comments') || url) return
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')!
    let hue = 0
    const draw = () => {
      hue = (hue + 4) % 360
      ctx.fillStyle = `hsl(${hue} 70% 50%)`
      ctx.fillRect(0, 0, 320, 180)
    }
    draw()
    const stream = canvas.captureStream(20)
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.onstop = () =>
      setUrl(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })))
    rec.start()
    const timer = setInterval(draw, 50)
    setTimeout(() => {
      clearInterval(timer)
      rec.stop()
    }, 8000)
    return () => clearInterval(timer)
  }, [params, url])

  if (!params) return null
  const dark = params.get('dark') === '1'

  if (params.get('sheet')) {
    return (
      <div style={{ height: '100vh', background: dark ? '#141416' : '#fff' }}>
        {open && (
          <OverviewSheet
            lessonN={2}
            title="The Athlete’s Mindset"
            durLabel="14 min"
            instructorName="Carla Marín"
            imageUrl={null}
            dark={dark}
            overview={{
              body: [
                "Most players think matches are won with the forehand or the serve. They're not — they're won in the six seconds between points.",
                "In this lesson I'll share the exact mental routine I used on tour: how I reset after errors and how I narrow my focus before the biggest points.",
              ],
              learn: [
                'A 4-step reset routine to use after every point',
                "How to turn nerves into 'readiness' instead of fear",
                'A pre-serve breathing pattern that lowers your heart rate',
              ],
              resources: [
                {
                  name: 'Mental Game Workbook',
                  type: 'pdf',
                  meta: 'PDF · 2.4 MB',
                  url: '#',
                },
                {
                  name: 'Pre-Serve Breathing Audio',
                  type: 'audio',
                  meta: 'MP3 · 4:10',
                  url: '#',
                },
              ],
            }}
            onClose={() => setOpen(false)}
            onPlay={() => undefined}
          />
        )}
      </div>
    )
  }

  if (params.get('comments')) {
    return (
      <div style={{ height: '100vh', background: dark ? '#141416' : '#fff' }}>
        {open && (
          <CommentsPanel
            lessonLabel="Lesson 2 · The Athlete’s Mindset"
            comments={COMMENTS}
            dark={dark}
            onClose={() => setOpen(false)}
            onLike={() => undefined}
            onPost={() => undefined}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: '#000' }}>
      <div
        data-progress-log={progressLog.map((f) => f.toFixed(2)).join(',')}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000 }}
      />
      {open && url && (
        <WatchPlayer
          lesson={{
            n: 2,
            title: 'The Athlete’s Mindset',
            playbackUrl: url,
          }}
          courseTitle="Championship Tennis"
          instructorName="Carla Marín"
          startSec={Number(params.get('start') ?? 0)}
          comments={COMMENTS}
          onPostComment={() => undefined}
          onLikeComment={() => undefined}
          onClose={() => setOpen(false)}
          onProgress={(f) => setProgressLog((l) => [...l, f])}
          onComplete={() => setProgressLog((l) => [...l, 1])}
        />
      )}
    </div>
  )
}
