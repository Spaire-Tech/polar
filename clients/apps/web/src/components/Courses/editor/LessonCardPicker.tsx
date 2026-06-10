'use client'

// LessonCardPicker — literal clone of the "Choose your lesson card" design
// (Lesson Card Picker.html). Two tiles, each a live scaled iframe of the real
// card: Spotlight (title over the image) and Catalog (the existing portal card,
// details below the image). Selection ring + check, Back / Continue footer,
// confirmation toast. CSS is a faithful port scoped via styled-jsx.

import { useCallback, useEffect, useRef, useState } from 'react'

export type LessonCardStyle = 'Spotlight' | 'Catalog'

const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7'

type Option = {
  style: LessonCardStyle
  name: string
  desc: string
  src: string
}

type Toast = { id: number; msg: string }

export function LessonCardPicker({
  value,
  onChange,
  onContinue,
  onBack,
  spotlightSrc = '/embed/lesson-card-spotlight',
  catalogSrc = '/embed/lesson-card-catalog',
}: {
  value?: LessonCardStyle
  onChange?: (style: LessonCardStyle) => void
  onContinue?: (style: LessonCardStyle) => void
  onBack?: () => void
  spotlightSrc?: string
  catalogSrc?: string
}) {
  const options: Option[] = [
    {
      style: 'Spotlight',
      name: 'Spotlight',
      desc: 'Title and details rest over the image.',
      src: spotlightSrc,
    },
    {
      style: 'Catalog',
      name: 'Catalog',
      desc: 'Title and details sit below the image.',
      src: catalogSrc,
    },
  ]

  const [internal, setInternal] = useState<LessonCardStyle>('Spotlight')
  const selected = value ?? internal

  useEffect(() => {
    if (value != null) return
    const stored = window.localStorage.getItem('spaire_lesson_style')
    if (stored === 'Spotlight' || stored === 'Catalog') setInternal(stored)
  }, [value])

  const select = useCallback(
    (style: LessonCardStyle) => {
      setInternal(style)
      try {
        window.localStorage.setItem('spaire_lesson_style', style)
      } catch {
        /* ignore */
      }
      onChange?.(style)
    },
    [onChange],
  )

  // Scale each 380×362 card iframe to fill its tile (mirrors scaleFrames).
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const scaleFrames = () => {
      const root = rootRef.current
      if (!root) return
      root.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
        const fs = tile.querySelector<HTMLElement>('.frame-scale')
        if (!fs) return
        fs.style.transform = `scale(${tile.clientWidth / 380})`
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

  const [catalogLoaded, setCatalogLoaded] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const toast = useCallback((msg: string) => {
    const id = idRef.current++
    setToasts((t) => [...t, { id, msg }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  return (
    <div className="lcp-root" ref={rootRef}>
      <div className="head">
        <h1>Choose your lesson card</h1>
        <p>
          This is how every lesson appears in your course. <b>Spotlight</b>{' '}
          keeps it cinematic, with the title resting over the image.{' '}
          <b>Catalog</b> keeps things clean, setting the details just beneath.
        </p>
      </div>

      <div className="cards">
        {options.map((opt) => {
          const isSel = selected === opt.style
          const isCatalog = opt.style === 'Catalog'
          return (
            <div
              key={opt.style}
              className={`card${isSel ? ' sel' : ''}`}
              onClick={() => select(opt.style)}
            >
              <div className="tile">
                <div className="frame-scale">
                  <iframe
                    src={opt.src}
                    scrolling="no"
                    tabIndex={-1}
                    aria-hidden="true"
                    title={`${opt.name} preview`}
                    onLoad={
                      isCatalog ? () => setCatalogLoaded(true) : undefined
                    }
                  />
                </div>
                {isCatalog && (
                  <div
                    className={`splash-cover${catalogLoaded ? ' gone' : ''}`}
                  />
                )}
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
        .lcp-root {
          --ink: #1d1d1f;
          --gray: #86868b;
          --line: #e8e8ed;
          --panel: #f0f0f3;
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
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 88px 32px 64px;
        }
        .lcp-root :global(button) {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit;
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
          max-width: 620px;
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
          gap: 36px;
          width: 100%;
          max-width: 880px;
        }
        .card {
          cursor: pointer;
        }
        .tile {
          position: relative;
          aspect-ratio: 380 / 362;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px -14px rgba(0, 0, 0, 0.22);
          transition: transform 0.3s cubic-bezier(0.2, 1, 0.3, 1),
            box-shadow 0.3s;
        }
        .card:hover .tile {
          transform: translateY(-4px);
          box-shadow: 0 20px 44px -18px rgba(0, 0, 0, 0.3);
        }
        .ring {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          pointer-events: none;
          z-index: 4;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
          transition: box-shadow 0.22s;
        }
        .card.sel .tile {
          box-shadow: 0 12px 32px -14px rgba(0, 0, 0, 0.26);
        }
        .card.sel .ring {
          box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 4px rgba(0, 0, 0, 0.14);
        }
        .frame-scale {
          position: absolute;
          top: 0;
          left: 0;
          width: 380px;
          height: 362px;
          transform-origin: top left;
        }
        .frame-scale :global(iframe) {
          width: 380px;
          height: 362px;
          border: 0;
          display: block;
          pointer-events: none;
        }
        .splash-cover {
          position: absolute;
          inset: 0;
          z-index: 6;
          background: #f2f2f4;
          opacity: 1;
          transition: opacity 0.35s ease;
          pointer-events: none;
          border-radius: 16px;
        }
        .splash-cover.gone {
          opacity: 0;
        }
        .check {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 5;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.78);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.18);
          display: grid;
          place-items: center;
          color: var(--ink);
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.2s,
            transform 0.2s cubic-bezier(0.3, 1.4, 0.4, 1), background 0.2s,
            box-shadow 0.2s;
        }
        .card.sel .check {
          opacity: 1;
          transform: none;
          background: #fff;
          color: var(--ink);
          box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.12);
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
          animation: lcp-tin 0.3s cubic-bezier(0.2, 1.1, 0.3, 1);
        }
        .toast .tk {
          color: var(--ink);
          display: grid;
          place-items: center;
        }
        @keyframes lcp-tin {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
        }

        @media (max-width: 800px) {
          .lcp-root {
            padding: 56px 20px 48px;
          }
          .cards {
            grid-template-columns: 1fr;
            max-width: 400px;
            gap: 28px;
          }
        }
      `}</style>
    </div>
  )
}

export default LessonCardPicker
