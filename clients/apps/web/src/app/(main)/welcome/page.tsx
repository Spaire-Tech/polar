'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const INTRO_WORDS = ['Monetize', 'your', 'creativity']
const STAGGER_MS = 68

export default function WelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [started, setStarted] = useState(false)

  const chars: { ch: string; delay: number }[] = []
  let idx = 0
  INTRO_WORDS.forEach((word) => {
    word.split('').forEach((ch) => {
      chars.push({ ch, delay: idx * STAGGER_MS })
      idx++
    })
  })
  const lastDelay = chars.length > 0 ? chars[chars.length - 1].delay : 0

  const wordGroups: (typeof chars)[] = []
  let ci = 0
  INTRO_WORDS.forEach((word) => {
    wordGroups.push(chars.slice(ci, ci + word.length))
    ci += word.length
  })

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!started) return
    const total = lastDelay + 520 + 700
    const t = setTimeout(() => {
      // The `slug`/`auto` query params are part of an older
      // self-serve org creation entry path. If they're set, honor
      // that path and skip plan selection — the plan picker is for
      // brand-new signups arriving from the marketing site.
      const slug = searchParams.get('slug')
      const auto = searchParams.get('auto')
      if (slug || auto) {
        const params = new URLSearchParams({ from_welcome: 'true' })
        if (slug) params.set('slug', slug)
        if (auto) params.set('auto', auto)
        router.push(`/dashboard/create?${params}`)
        return
      }
      router.push('/onboarding/plan-select')
    }, total)
    return () => clearTimeout(t)
  }, [started, lastDelay, router, searchParams])

  return (
    <div className="relative flex h-full min-h-screen w-full items-center justify-center bg-white p-10">
      <style jsx global>{`
        @keyframes welcomeLetterUp {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .welcome-headline {
          font-weight: 700;
          font-size: clamp(48px, 7vw, 88px);
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #0a0a0a;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0 0.22em;
          max-width: 900px;
        }
        .welcome-word {
          display: inline-flex;
        }
        .welcome-letter {
          display: inline-block;
          opacity: 0;
          transform: translateY(22px);
        }
      `}</style>
      <h1 className="welcome-headline">
        {wordGroups.map((group, wi) => (
          <span key={wi} className="welcome-word">
            {group.map((c, li) => (
              <span
                key={li}
                className="welcome-letter"
                style={
                  started
                    ? {
                        animation: `welcomeLetterUp 0.52s cubic-bezier(0.22,1,0.36,1) ${c.delay}ms forwards`,
                      }
                    : {}
                }
              >
                {c.ch}
              </span>
            ))}
          </span>
        ))}
      </h1>
    </div>
  )
}
