'use client'

// Per-section entry animation. Wraps a section's content in a motion.div
// that fades + rises in the first time it scrolls into view, then stays put.
// `viewport={{ once: true }}` is critical:
//   * the animation never re-fires on undo/redo (no jitter when restoring
//     edits)
//   * the animation never re-fires on text or theme changes (which would
//     otherwise flash the section every keystroke)
//   * reorders preserve EditBlock identity via React keys, so dragging a
//     section doesn't replay its animation
//   * deleting and re-adding a section unmounts → remounts, so it animates
//     fresh — which is what the user expects from "add section"
//
// Motion intensity is global (theme.motion) rather than per-section so the
// page reads as one coherent feel. 'none' falls through to a plain div so
// users opting out pay zero animation cost.

import type { LandingTheme } from '@/hooks/queries/courses'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type MotionLevel = NonNullable<LandingTheme['motion']>

// ease-out cubic-bezier — classic landing-page feel, no bounce. Typed as a
// 4-tuple so framer-motion v12 accepts it (a plain number[] is rejected).
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

// Tuned by hand: 'subtle' is just enough to feel alive on a long-scroll
// landing page; 'pronounced' is closer to what marketing landing pages
// (Linear, Stripe) do for hero-style sections; 'none' is a perf escape.
const PRESETS = {
  subtle: {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE_OUT },
  },
  pronounced: {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.75, ease: EASE_OUT },
  },
} as const

export function MotionSection({
  level,
  children,
}: {
  level: MotionLevel | undefined
  children: ReactNode
}) {
  const resolved: MotionLevel = level ?? 'subtle'
  if (resolved === 'none') return <>{children}</>
  const preset = PRESETS[resolved]
  return (
    <motion.div
      initial={preset.initial}
      whileInView={preset.whileInView}
      // 10% of the section needs to be in view before it animates — keeps
      // tall sections (Hero) from triggering until the user actually sees
      // them, and prevents short sections from animating off-screen.
      viewport={{ once: true, amount: 0.1 }}
      transition={preset.transition}
      style={{
        // Children are already block-level sections; keep the wrapper out
        // of the visual flow (no padding/margin) so it's purely an animator.
        display: 'block',
      }}
    >
      {children}
    </motion.div>
  )
}
