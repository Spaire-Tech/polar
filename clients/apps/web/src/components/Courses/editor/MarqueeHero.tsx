'use client'

// MarqueeHero — literal static clone of the "Marquee" hero design
// (Hero.html, "Championship Tennis"). Full-bleed, cinematic, streaming-title
// styling: a slow Ken Burns zoom over a still, a double scrim for legibility,
// a film-grain overlay, a low-anchored title, and a light frosted control
// band across the bottom (actions / description / instructor).
//
// This is intentionally STATIC — content is hardcoded to the design's sample
// (tennis documentary) so the proportions can be reviewed in isolation before
// it's wired to real course data + the EditorContext slots. CSS is a faithful
// port of the original stylesheet (clamp/vw units, grid template, media
// queries) scoped to this component via styled-jsx.

import { useCallback, useRef, useState } from 'react'

const PLAY_PATH =
  'M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z'

type Toast = { id: number; msg: string }

// All props optional — defaults reproduce the design's "Championship Tennis"
// sample exactly, so the standalone /embed/hero-preview clone is unchanged.
// The wizard's portal preview (and later the real portal) passes real course
// data through these.
export type MarqueeHeroProps = {
  brand?: string
  eyebrow?: string
  title?: string
  description?: string
  metaLine?: string
  badges?: string[]
  instructorName?: string
  instructorSub?: string
  playLabel?: string
  buyLabel?: string
  freeLine?: string
  imageUrl?: string
  showTrailer?: boolean
  onPlay?: () => void
  onBuy?: () => void
  onTrailer?: () => void
}

export function MarqueeHero({
  brand = 'Spaire Originals',
  eyebrow = 'Documentary Series · Tennis',
  title = 'Championship Tennis',
  description = 'A two-time Grand Slam champion takes you inside the all-court game — the strokes, the footwork, and the mind that wins the points that matter. Shot like a film, taught like a private lesson.',
  metaLine = 'Documentary Series · Tennis  ·  2026  ·  11 Lessons  ·  3h 42m',
  badges = ['All Levels', 'Self-paced', 'Captions', 'Mobile & TV'],
  instructorName = 'Carla Marín',
  instructorSub = 'Former world No. 2 and two-time Grand Slam champion.',
  playLabel = 'Play Lesson 1 Free',
  buyLabel = 'Subscribe — $89',
  freeLine = '3 lessons free · one-time purchase',
  imageUrl = 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1920&q=80&auto=format&fit=crop',
  showTrailer = true,
  onPlay,
  onBuy,
  onTrailer,
}: MarqueeHeroProps = {}) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const toast = useCallback((msg: string) => {
    const id = idRef.current++
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 2600)
  }, [])

  return (
    <header className="panel">
      <div
        className="panel-art"
        style={{ backgroundImage: `url('${imageUrl}')` }}
      />
      <div className="panel-scrim" />
      <div className="panel-grain" />

      <div className="panel-brand rise">{brand}</div>

      <div className="panel-title">
        <div className="pt-eyebrow rise d1">{eyebrow}</div>
        <h1 className="pt-h rise d1">{title}</h1>
      </div>

      <div className="band rise d2">
        <div className="band-actions">
          <button
            className="abtn play"
            type="button"
            onClick={() =>
              onPlay
                ? onPlay()
                : toast('Playing free preview · Introduction')
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d={PLAY_PATH} />
            </svg>
            {playLabel}
          </button>
          <button
            className="abtn buy"
            type="button"
            onClick={() =>
              onBuy ? onBuy() : toast('Redirecting to secure checkout…')
            }
          >
            {buyLabel}
          </button>
          {freeLine ? <div className="band-free">{freeLine}</div> : null}
        </div>

        <div className="band-desc">
          <p className="bd-text">{description}</p>
          <div className="bd-meta">{metaLine}</div>
          <div className="bd-badges">
            {badges.map((b, i) => (
              <span key={b} className={`bdg${i === 0 ? ' rate' : ''}`}>
                {b}
              </span>
            ))}
            {showTrailer && (
              <button
                className="bd-trailer"
                type="button"
                onClick={() =>
                  onTrailer ? onTrailer() : toast('Loading trailer · 2:18')
                }
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d={PLAY_PATH} />
                </svg>
                Trailer
              </button>
            )}
          </div>
        </div>

        <div className="band-cast">
          <div className="bc-k">Instructor</div>
          <div className="bc-v">{instructorName}</div>
          <div className="bc-sub">{instructorSub}</div>
        </div>
      </div>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="tk">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20" />
                <path d="M7.7 12.2l2.8 2.8 5.6-5.6" />
              </svg>
            </span>
            {t.msg}
          </div>
        ))}
      </div>

      <style jsx>{`
        /* ============================================================ HERO PANEL */
        .panel {
          --label: #ffffff;
          --text: #1d1d1f;
          --text-2: rgba(0, 0, 0, 0.56);
          --text-3: rgba(0, 0, 0, 0.4);
          --ink: #07080a;
          --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', system-ui, sans-serif;
          --gut: 72px;
          position: relative;
          width: 100vw;
          height: 100vh;
          min-height: 640px;
          overflow: hidden;
          background: var(--ink);
          color: var(--text);
          font-family: var(--sf);
          letter-spacing: -0.014em;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .panel :global(button) {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit;
        }
        .panel-art {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center 24%;
          transform: scale(1.04);
          animation: kb 26s ease-out forwards;
        }
        @keyframes kb {
          to {
            transform: scale(1.13);
          }
        }
        .panel-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
              0deg,
              var(--ink) 0.5%,
              rgba(255, 255, 255, 0.5) 18%,
              transparent 46%
            ),
            linear-gradient(
              115deg,
              rgba(0, 0, 0, 0.55) 0%,
              rgba(0, 0, 0, 0.16) 40%,
              transparent 62%
            );
        }
        .panel-grain {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          pointer-events: none;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* small brand mark, top-left */
        .panel-brand {
          position: absolute;
          left: var(--gut);
          top: 36px;
          z-index: 4;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.4);
        }

        /* title — anchored low, close to the band */
        .panel-title {
          position: absolute;
          left: var(--gut);
          right: var(--gut);
          bottom: 272px;
          z-index: 4;
        }
        .pt-eyebrow {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 20px;
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
        }
        .pt-h {
          font-size: clamp(56px, 7.4vw, 124px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 0.9;
          max-width: 12ch;
          color: #fff;
          text-shadow: 0 4px 50px rgba(0, 0, 0, 0.4);
        }

        /* ============================================================ FROSTED CONTROL BAND */
        .band {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          display: grid;
          grid-template-columns: 380px minmax(0, 1fr) 320px;
          gap: 56px;
          align-items: start;
          padding: 60px var(--gut) 48px;
          -webkit-backdrop-filter: blur(32px) saturate(140%);
          backdrop-filter: blur(32px) saturate(140%);
          background: linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.92) 12%,
            rgba(255, 255, 255, 0.66) 46%,
            rgba(255, 255, 255, 0.3) 74%,
            rgba(255, 255, 255, 0) 100%
          );
          -webkit-mask-image: linear-gradient(0deg, #000 70%, transparent 100%);
          mask-image: linear-gradient(0deg, #000 70%, transparent 100%);
        }
        .band-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .abtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          height: 60px;
          border-radius: 14px;
          font-size: 19px;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: transform 0.16s cubic-bezier(0.2, 1.2, 0.3, 1),
            background 0.16s, box-shadow 0.16s;
        }
        .abtn:active {
          transform: scale(0.975);
        }
        .abtn.play {
          background: #1d1d1f;
          color: #fff;
          box-shadow: 0 8px 26px rgba(0, 0, 0, 0.22);
        }
        .abtn.play:hover {
          background: #000;
          transform: translateY(-1px);
        }
        .abtn.buy {
          background: rgba(255, 255, 255, 0.6);
          color: #1d1d1f;
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          backdrop-filter: blur(20px) saturate(160%);
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }
        .abtn.buy:hover {
          background: rgba(255, 255, 255, 0.82);
          transform: translateY(-1px);
        }
        .band-free {
          font-size: 14.5px;
          font-weight: 500;
          color: var(--text-2);
          text-align: center;
          margin-top: 5px;
        }

        .band-desc {
          padding-top: 2px;
        }
        .bd-text {
          font-size: 19px;
          line-height: 1.45;
          font-weight: 400;
          color: var(--text);
          max-width: 60ch;
        }
        .bd-meta {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-2);
          margin-top: 16px;
        }
        .bd-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }
        .bdg {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--text-2);
          background: rgba(0, 0, 0, 0.07);
          border-radius: 5px;
          padding: 3px 8px;
        }
        .bdg.rate {
          background: transparent;
          box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.22);
        }
        .bd-trailer {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          padding: 4px 6px;
          margin-left: 4px;
        }
        .bd-trailer:hover {
          color: #000;
        }

        .band-cast {
          padding-top: 2px;
        }
        .bc-k {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-3);
          margin-bottom: 7px;
        }
        .bc-v {
          font-size: 21px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--text);
        }
        .bc-sub {
          font-size: 16px;
          line-height: 1.4;
          color: var(--text-2);
          margin-top: 6px;
        }

        /* entrance */
        .rise {
          opacity: 0;
          transform: translateY(22px);
          animation: rise 1s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .rise.d1 {
          animation-delay: 0.15s;
        }
        .rise.d2 {
          animation-delay: 0.35s;
        }
        .rise.d3 {
          animation-delay: 0.55s;
        }
        @keyframes rise {
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rise,
          .panel-art {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }

        /* toast */
        .toast-wrap {
          position: fixed;
          left: 50%;
          bottom: 40px;
          transform: translateX(-50%);
          z-index: 200;
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
          pointer-events: none;
        }
        .toast {
          background: rgba(40, 40, 44, 0.82);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          backdrop-filter: blur(24px) saturate(180%);
          color: #fff;
          padding: 13px 22px;
          border-radius: 999px;
          font-size: 16px;
          font-weight: 600;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          gap: 10px;
          animation: tin 0.3s cubic-bezier(0.2, 1.1, 0.3, 1);
        }
        .toast .tk {
          color: #30d158;
          display: grid;
          place-items: center;
        }
        @keyframes tin {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
        }

        @media (max-width: 1200px) {
          .panel {
            --gut: 44px;
          }
          .band {
            grid-template-columns: 340px minmax(0, 1fr);
            gap: 40px;
          }
          .band-cast {
            display: none;
          }
        }
        @media (max-width: 820px) {
          .panel {
            --gut: 22px;
          }
          .panel-title {
            bottom: 248px;
          }
          .band {
            grid-template-columns: 1fr;
            gap: 20px;
            padding-bottom: 32px;
          }
          .band-desc {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}

export default MarqueeHero
