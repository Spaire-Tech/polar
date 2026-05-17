'use client'

import { memo, useMemo } from 'react'

// ─── Generating screen ────────────────────────────────────────────────────────

type Phase = 'outline' | 'landing'
type Format = 'course' | 'series'

const COPY: Record<
  Format,
  Record<Phase, { headline: string; sub: string; meta: string }>
> = {
  course: {
    outline: {
      headline: 'Generating outline',
      sub: "This can take a minute or two. We're drafting modules, lessons, and learning objectives — feel free to keep this tab open.",
      meta: 'Working on it',
    },
    landing: {
      headline: 'One last step',
      sub: "We're putting together your landing page — hero, curriculum, and pricing. Hang tight, you'll be ready to share it in a moment.",
      meta: 'Almost done',
    },
  },
  series: {
    outline: {
      headline: 'Shaping the season',
      sub: "This can take a minute or two. We're sketching the arc and the episode list. Keep this tab open.",
      meta: 'Working on it',
    },
    landing: {
      headline: 'One last step',
      sub: "We're putting together your series page — hero, chapters, and episodes. Hang tight, you'll be ready to share it in a moment.",
      meta: 'Almost done',
    },
  },
}

// The wizard re-renders many times per second while the AI SDK streams
// chunks back. The ring animation has nothing to do with the streamed
// payload, so we memoize the screen + the ring layer to keep React from
// reconciling 84 SVG <circle>s every tick — that bookkeeping was eating
// enough main-thread time to stall the GPU compositor and make the rings
// look frozen.
export const GeneratingScreen = memo(function GeneratingScreen({
  onClose: _onClose,
  phase = 'outline',
  format = 'course',
}: {
  onClose: () => void
  phase?: Phase
  format?: Format
}) {
  const copy = COPY[format][phase]

  return (
    <div className="cg-stage">
      <RingArt />

      <section className="cg-copy" role="status" aria-live="polite">
        <h1 className="cg-headline">
          {copy.headline}
          <span className="cg-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </h1>
        <p className="cg-sub">{copy.sub}</p>
        <div className="cg-meta">
          <span className="cg-pulse" />
          <span>{copy.meta}</span>
        </div>
      </section>

      <GeneratingStyles />
    </div>
  )
})

// The SVG itself is fully static — pinning it behind memo() means React
// never reconciles the 84 dots once they're mounted, so the CSS animations
// stay on the compositor uninterrupted while the rest of the wizard
// re-renders on each streamed chunk.
const RingArt = memo(function RingArt() {
  return (
    <div className="cg-ring-wrap" aria-hidden="true">
      <svg viewBox="-200 -200 400 400">
        <g className="cg-ring">
          <RingDots
            count={36}
            radius={150}
            baseSize={6.5}
            sizeJitter={3}
            hueOffset={30}
            delayOffset={0}
          />
        </g>
        <g className="cg-ring cg-ring-rev">
          <RingDots
            count={48}
            radius={122}
            baseSize={3.8}
            sizeJitter={2}
            hueOffset={35}
            delayOffset={1.3}
          />
        </g>
      </svg>
    </div>
  )
})

// ─── Ring of dots ─────────────────────────────────────────────────────────────

const RingDots = memo(function RingDots({
  count,
  radius,
  baseSize,
  sizeJitter,
  hueOffset,
  delayOffset,
}: {
  count: number
  radius: number
  baseSize: number
  sizeJitter: number
  hueOffset: number
  delayOffset: number
}) {
  const dots = useMemo(() => {
    const out: Array<{
      cx: number
      cy: number
      r: number
      fill: string
      delay: number
    }> = []
    for (let i = 0; i < count; i++) {
      const t = i / count
      const angle = t * Math.PI * 2 - Math.PI / 2
      const rWobble =
        radius + (i % 3 === 0 ? 6 : i % 3 === 1 ? -4 : 0)
      const cx = Math.cos(angle) * rWobble
      const cy = Math.sin(angle) * rWobble

      let size = baseSize
      if (i % 5 === 0) size = baseSize + sizeJitter
      else if (i % 5 === 2) size = baseSize - sizeJitter * 0.5

      const hue = (t * 360 + hueOffset) % 360
      const fill = `hsl(${hue}, 85%, 62%)`

      const delay = t * 2.6 + delayOffset

      out.push({ cx, cy, r: size, fill, delay })
    }
    return out
  }, [count, radius, baseSize, sizeJitter, hueOffset, delayOffset])

  return (
    <>
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx.toFixed(2)}
          cy={d.cy.toFixed(2)}
          r={d.r.toFixed(2)}
          fill={d.fill}
          style={{
            animationDelay: `-${d.delay.toFixed(2)}s`,
            // base opacity used by the breathe keyframe
            ['--cg-o' as string]: '0.92',
          }}
        />
      ))}
    </>
  )
})

// ─── Styles ───────────────────────────────────────────────────────────────────

function GeneratingStyles() {
  return (
    <style jsx global>{`
      .cg-stage {
        --cg-bg: #ffffff;
        --cg-fg: #1d1d1f;
        --cg-fg-soft: #6e6e73;
        position: fixed;
        inset: 0;
        z-index: 200;
        background: var(--cg-bg);
        color: var(--cg-fg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        gap: 40px;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
          'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .cg-ring-wrap {
        width: min(360px, 60vw);
        aspect-ratio: 1 / 1;
        position: relative;
        flex-shrink: 0;
      }
      .cg-ring-wrap svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }

      .cg-copy {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        max-width: 480px;
      }

      .cg-headline {
        font-size: clamp(28px, 4vw, 40px);
        font-weight: 600;
        letter-spacing: -0.022em;
        margin: 0;
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
      }

      .cg-dots {
        display: inline-flex;
        gap: 4px;
        margin-left: 4px;
        transform: translateY(-0.08em);
      }
      .cg-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.25;
        animation: cgBlink 1.4s infinite ease-in-out both;
      }
      .cg-dots span:nth-child(2) {
        animation-delay: 0.18s;
      }
      .cg-dots span:nth-child(3) {
        animation-delay: 0.36s;
      }
      @keyframes cgBlink {
        0%,
        80%,
        100% {
          opacity: 0.2;
          transform: translateY(0);
        }
        40% {
          opacity: 1;
          transform: translateY(-2px);
        }
      }

      .cg-sub {
        font-size: clamp(15px, 1.4vw, 17px);
        line-height: 1.5;
        color: var(--cg-fg-soft);
        margin: 0;
        letter-spacing: -0.005em;
        text-wrap: pretty;
      }

      .cg-meta {
        margin-top: 4px;
        font-size: 13px;
        color: var(--cg-fg-soft);
        letter-spacing: 0.02em;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        opacity: 0.85;
      }
      .cg-pulse {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #34c759;
        box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.5);
        animation: cgPulse 1.8s infinite;
      }
      @keyframes cgPulse {
        0% {
          box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.45);
        }
        70% {
          box-shadow: 0 0 0 8px rgba(52, 199, 89, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
        }
      }

      .cg-ring {
        transform-origin: 50% 50%;
        animation: cgSpin 16s linear infinite;
      }
      .cg-ring-rev {
        animation: cgSpinRev 22s linear infinite;
      }
      @keyframes cgSpin {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes cgSpinRev {
        to {
          transform: rotate(-360deg);
        }
      }

      .cg-ring circle {
        transform-box: fill-box;
        transform-origin: center;
        animation: cgBreathe 2.6s ease-in-out infinite;
      }
      @keyframes cgBreathe {
        0%,
        100% {
          transform: scale(1);
          opacity: var(--cg-o, 0.85);
        }
        50% {
          transform: scale(0.65);
          opacity: 0.45;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .cg-ring,
        .cg-ring-rev,
        .cg-ring circle,
        .cg-dots span,
        .cg-pulse {
          animation: none !important;
        }
      }
    `}</style>
  )
}

// ─── Creating screen ──────────────────────────────────────────────────────────

export function CreatingScreen({ onClose: _onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        fontFamily: "'Poppins', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#f4f4f4',
            border: '1.5px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14l6 6 10-12"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            margin: 0,
            color: '#0a0a0a',
          }}
        >
          Creating your course
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: '#a0a0a0',
          }}
        >
          Setting everything up…
        </p>
      </div>
    </div>
  )
}
