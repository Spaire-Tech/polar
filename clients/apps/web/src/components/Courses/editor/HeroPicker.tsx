'use client'

// HeroPicker — literal clone of the "Choose your hero" design (Hero Picker.html).
// Two poster cards, each a live scaled preview (iframe) of the actual hero —
// Marquee (the cinematic full-bleed clone) and Cover (the existing editorial
// landing hero). Selection ring + check, a fullscreen Preview overlay per
// option, Back / Continue footer, and a confirmation toast. CSS is a faithful
// port of the original stylesheet scoped to this component via styled-jsx.
//
// The previews are real routes (/embed/hero-preview, /embed/hero-preview-cover)
// scaled into 16:10 posters exactly like the prototype scales its iframes.

import { useCallback, useEffect, useRef, useState } from 'react'

export type HeroStyle = 'Marquee' | 'Cover'

const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7'
const PLAY_PATH =
  'M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z'

type Option = {
  style: HeroStyle
  name: string
  desc: string
  src: string
  /** Instant poster background so the live iframe never flashes white while
      it loads — the iframe fades in over the identical (cached) photo. */
  poster: string
  posterPos: string
}

type Toast = { id: number; msg: string }

export function HeroPicker({
  value,
  onChange,
  onContinue,
  onBack,
  marqueeSrc = '/embed/hero-preview',
  coverSrc = '/embed/hero-preview-cover',
}: {
  value?: HeroStyle
  onChange?: (style: HeroStyle) => void
  onContinue?: (style: HeroStyle) => void
  onBack?: () => void
  marqueeSrc?: string
  coverSrc?: string
}) {
  const options: Option[] = [
    {
      style: 'Marquee',
      name: 'Marquee',
      desc: 'Cinematic and full-bleed, like a streaming title.',
      src: marqueeSrc,
      poster: '/assets/onboarding/cover-hero.jpg',
      posterPos: 'center 18%',
    },
    {
      style: 'Cover',
      name: 'Cover',
      desc: 'Editorial and typographic, like a magazine cover.',
      src: coverSrc,
      poster: '/assets/onboarding/cover-hero.jpg',
      posterPos: 'center 58%',
    },
  ]

  // Uncontrolled by default; persists to localStorage like the prototype.
  const [internal, setInternal] = useState<HeroStyle>('Marquee')
  const selected = value ?? internal

  useEffect(() => {
    if (value != null) return
    const stored = window.localStorage.getItem('spaire_hero_style')
    if (stored === 'Marquee' || stored === 'Cover') setInternal(stored)
  }, [value])

  const select = useCallback(
    (style: HeroStyle) => {
      setInternal(style)
      try {
        window.localStorage.setItem('spaire_hero_style', style)
      } catch {
        /* ignore */
      }
      onChange?.(style)
    },
    [onChange],
  )

  // ── scale the live hero frames into their posters (mirrors scaleFrames) ──
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const scaleFrames = () => {
      const root = rootRef.current
      if (!root) return
      root.querySelectorAll<HTMLElement>('.poster').forEach((poster) => {
        const fs = poster.querySelector<HTMLElement>('.frame-scale')
        if (!fs) return
        const s =
          Math.max(poster.clientWidth / 1512, poster.clientHeight / 945) +
          0.0015
        fs.style.transform = `scale(${s})`
      })
    }
    scaleFrames()
    const ro = new ResizeObserver(scaleFrames)
    if (rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', scaleFrames)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', scaleFrames)
    }
  }, [])

  // ── fullscreen preview overlay — both heroes are preloaded & kept warm
  //    for instant open, exactly like the design. ──
  const [previewStyle, setPreviewStyle] = useState<HeroStyle | null>(null)
  const [overlayShown, setOverlayShown] = useState(false)

  const openPreview = useCallback((style: HeroStyle) => {
    setPreviewStyle(style)
    requestAnimationFrame(() => setOverlayShown(true))
  }, [])

  const closePreview = useCallback(() => {
    setOverlayShown(false)
    // keep iframes warm — just hide
    window.setTimeout(() => setPreviewStyle(null), 300)
  }, [])

  useEffect(() => {
    if (previewStyle == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [previewStyle, closePreview])

  // ── toast ──
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const toast = useCallback((msg: string) => {
    const id = idRef.current++
    setToasts((t) => [...t, { id, msg }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  // Fade each iframe in once it has loaded; until then the poster's photo
  // background shows, so there's no white loading screen.
  const [loaded, setLoaded] = useState<Record<HeroStyle, boolean>>({
    Marquee: false,
    Cover: false,
  })

  return (
    <div className="hp-root" ref={rootRef}>
      <div className="head">
        <h1>Choose your hero</h1>
        <p>
          Your hero is the first thing a student sees. <b>Marquee</b> stays
          cinematic and quiet, inviting them to press play. <b>Cover</b> brings
          your title and voice to the front in bold type.
        </p>
      </div>

      <div className="cards">
        {options.map((opt) => {
          const isSel = selected === opt.style
          return (
            <div
              key={opt.style}
              className={`card${isSel ? ' sel' : ''}`}
              onClick={() => select(opt.style)}
            >
              <div
                className="poster"
                style={{
                  backgroundImage: `url('${opt.poster}')`,
                  backgroundPosition: opt.posterPos,
                  backgroundSize: 'cover',
                }}
              >
                <div className="frame-scale">
                  <iframe
                    src={opt.src}
                    scrolling="no"
                    tabIndex={-1}
                    aria-hidden="true"
                    title={`${opt.name} preview`}
                    style={{
                      opacity: loaded[opt.style] ? 1 : 0,
                      transition: 'opacity 0.25s ease',
                    }}
                    onLoad={() =>
                      setLoaded((l) => ({ ...l, [opt.style]: true }))
                    }
                  />
                </div>
                <div className="ring" />
                <div className="check">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={CHECK_PATH} />
                  </svg>
                </div>
                <button
                  className="preview"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openPreview(opt.style)
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d={PLAY_PATH} />
                  </svg>
                  Preview
                </button>
              </div>
              <div className="cap">
                <div className="cap-name">{opt.name}</div>
                <div className="cap-desc">{opt.desc}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="foot">
        <button className="back" type="button" onClick={() => onBack?.()}>
          Back
        </button>
        <button
          className="continue"
          type="button"
          onClick={() =>
            onContinue
              ? onContinue(selected)
              : toast(`Continuing with ${selected}`)
          }
        >
          Continue
        </button>
      </div>

      {/* fullscreen preview (both heroes preloaded & kept warm) */}
      <div
        className={`overlay${previewStyle ? ' on' : ''}${
          overlayShown ? ' show' : ''
        }`}
      >
        {options.map((opt) => (
          <iframe
            key={opt.style}
            className={`ov-hero${previewStyle === opt.style ? ' active' : ''}`}
            src={opt.src}
            title={`${opt.name} preview`}
          />
        ))}
        <div className="ov-bar">
          <button
            className="ov-use"
            type="button"
            onClick={() => {
              if (previewStyle) {
                select(previewStyle)
                const s = previewStyle
                closePreview()
                toast(`${s} selected`)
              }
            }}
          >
            Use this style
          </button>
          <button
            className="ov-close"
            type="button"
            aria-label="Close preview"
            onClick={closePreview}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="toastwrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="tk">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
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
        .hp-root {
          --ink: #1d1d1f;
          --gray: #86868b;
          --line: #e8e8ed;
          --purple: #6a4dd8;
          --bg: #ffffff;
          --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', system-ui, sans-serif;
          --po: var(--font-poppins), -apple-system, BlinkMacSystemFont,
            system-ui, sans-serif;
          font-family: var(--sf);
          background: var(--bg);
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.01em;
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
        }
        /* Neutralize UA button chrome only — no background/color here (would
           clobber .continue / .preview / .ov-use / .ov-close fills). The
           outline .back button declares its own background: none. */
        .hp-root :global(button) {
          font-family: inherit;
          cursor: pointer;
          border: none;
        }

        /* header */
        .head {
          text-align: center;
          margin-bottom: 56px;
        }
        .head h1 {
          font-family: var(--po);
          font-size: clamp(34px, 4vw, 52px);
          font-weight: 600;
          letter-spacing: -0.03em;
          line-height: 1.05;
        }
        .head p {
          font-size: 19px;
          line-height: 1.5;
          color: var(--gray);
          font-weight: 400;
          margin-top: 16px;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }
        .head p :global(b) {
          color: var(--ink);
          font-weight: 500;
        }

        /* cards */
        .cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 32px;
          width: 100%;
          max-width: 1080px;
        }
        .card {
          cursor: pointer;
        }
        .poster {
          position: relative;
          aspect-ratio: 16 / 10;
          border-radius: 20px;
          overflow: hidden;
          background: #0a0807;
          box-shadow: 0 6px 18px -10px rgba(0, 0, 0, 0.18),
            0 1px 3px rgba(0, 0, 0, 0.05);
          transition: transform 0.32s cubic-bezier(0.2, 1, 0.3, 1),
            box-shadow 0.32s;
        }
        .card:hover .poster {
          transform: translateY(-4px);
          box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.28),
            0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .card.sel .poster {
          transform: scale(1.045);
          box-shadow: 0 26px 60px -22px rgba(0, 0, 0, 0.34),
            0 2px 6px rgba(0, 0, 0, 0.06);
        }
        .card.sel:hover .poster {
          transform: scale(1.045) translateY(-4px);
        }
        .ring {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          pointer-events: none;
          z-index: 4;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
          transition: box-shadow 0.22s;
        }
        .card.sel .ring {
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
        }
        .frame-scale {
          position: absolute;
          top: 0;
          left: 0;
          width: 1512px;
          height: 945px;
          transform-origin: top left;
        }
        .frame-scale :global(iframe) {
          width: 1512px;
          height: 945px;
          border: 0;
          pointer-events: none;
          display: block;
        }
        .check {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 5;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(20, 20, 24, 0.34);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.9);
          display: grid;
          place-items: center;
          color: #fff;
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.2s,
            transform 0.2s cubic-bezier(0.3, 1.4, 0.4, 1), background 0.2s;
        }
        .card.sel .check {
          opacity: 1;
          transform: none;
          background: #fff;
          color: var(--ink);
          box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.12);
        }
        .preview {
          position: absolute;
          right: 16px;
          bottom: 16px;
          z-index: 5;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          background: rgba(20, 20, 24, 0.46);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          backdrop-filter: blur(18px) saturate(160%);
          padding: 10px 17px;
          border-radius: 980px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
          transition: background 0.18s, transform 0.18s;
        }
        .preview:hover {
          background: rgba(40, 40, 46, 0.72);
          transform: scale(1.03);
        }

        /* caption */
        .cap {
          padding: 22px 6px 0;
        }
        .cap-name {
          font-family: var(--po);
          font-size: 23px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        .cap-desc {
          font-size: 17px;
          line-height: 1.45;
          color: var(--gray);
          font-weight: 400;
          margin-top: 5px;
        }

        /* footer */
        .foot {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 60px;
        }
        .continue {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          background: var(--ink);
          color: #fff;
          font-size: 17px;
          font-weight: 500;
          padding: 15px 40px;
          border-radius: 980px;
          transition: transform 0.16s, background 0.16s;
        }
        .continue:hover {
          transform: scale(1.025);
          background: #000;
        }
        .continue:active {
          transform: scale(0.98);
        }
        .back {
          font-size: 17px;
          font-weight: 500;
          color: var(--ink);
          background: none;
          padding: 15px 34px;
          border-radius: 980px;
          box-shadow: inset 0 0 0 1px var(--line);
          transition: background 0.16s, transform 0.16s;
        }
        .back:hover {
          background: #f5f5f7;
          transform: scale(1.025);
        }
        .back:active {
          transform: scale(0.98);
        }

        /* fullscreen preview */
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: #000;
          display: none;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .overlay.on {
          display: block;
        }
        .overlay.show {
          opacity: 1;
        }
        .overlay :global(.ov-hero) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s;
        }
        .overlay :global(.ov-hero.active) {
          opacity: 1;
          pointer-events: auto;
        }
        .ov-bar {
          position: fixed;
          top: 22px;
          right: 22px;
          z-index: 110;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .ov-use {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 500;
          color: #1d1d1f;
          background: rgba(255, 255, 255, 0.92);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          padding: 11px 22px;
          border-radius: 980px;
          box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
          transition: transform 0.16s;
        }
        .ov-use:hover {
          transform: scale(1.04);
        }
        .ov-close {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #fff;
          background: rgba(40, 40, 46, 0.6);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
          transition: background 0.16s, transform 0.16s;
        }
        .ov-close:hover {
          background: rgba(60, 60, 68, 0.85);
          transform: scale(1.05);
        }

        /* toast */
        .toastwrap {
          position: fixed;
          left: 50%;
          bottom: 36px;
          transform: translateX(-50%);
          z-index: 200;
          pointer-events: none;
        }
        .toast {
          background: rgba(28, 28, 30, 0.9);
          -webkit-backdrop-filter: blur(20px);
          backdrop-filter: blur(20px);
          color: #fff;
          padding: 13px 22px;
          border-radius: 980px;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          gap: 9px;
          animation: hp-tin 0.3s cubic-bezier(0.2, 1.1, 0.3, 1);
        }
        .toast .tk {
          color: var(--ink);
          display: grid;
          place-items: center;
        }
        @keyframes hp-tin {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
        }

        @media (max-width: 800px) {
          .hp-root {
            padding: 56px 20px 48px;
          }
          .cards {
            grid-template-columns: 1fr;
            max-width: 520px;
            gap: 28px;
          }
        }
      `}</style>
    </div>
  )
}

export default HeroPicker
