'use client'

// MarqueeEmptyState — literal clone of "Marquee Empty State.html": the
// creator-facing course page at the end of onboarding for the Marquee hero +
// Episodic + first-3-episodes-free + Catalog cards combination, with dark
// mode (band and page fade colours flip together).
//
// AI writing is prefilled; media is missing. The hero renders the liquid-
// glass placeholder (ambient colour field + glass tint + photo glyph) until
// a cover is added;每 catalog card's thumb does the same with an "Add image
// or cover" pill (hidden-until-hover once filled). Episodes live in a
// horizontal scroll-snap strip with hover arrows that appear/disappear by
// scroll position. All writing is touch-to-edit. Uploads pick → canvas
// downscale → photo shows; picks persist to localStorage (design keys).

import { useCallback, useEffect, useRef, useState } from 'react'

type Episode = [number, string, string]

// AI-prefilled episodes — exactly the design's data. This is the EPISODIC
// copy contract: narrative titles (2-4 words, no "How to"), story-driven
// 1-2 sentence descriptions with named places/moments.
const EPISODES: Episode[] = [
  [1, 'The Wager', 'Pebble Beach, dawn. Jack bets a stranger he can fix any swing in one round — and explains why he always wins.'],
  [2, 'The Grip Is a Lie', 'Everything you were taught about holding a club, unlearned. Shot in the workshop where Jack rebuilds grips.'],
  [3, 'Eighteen Inches', 'The takeaway, filmed at 1,000 frames a second. The first move that decides every shot.'],
  [4, 'The Lake at Sawgrass', 'Why great players aim at trouble. A walk through the most feared par 3 in golf.'],
  [5, 'Smooth Is Fast', 'Tempo, filmed with orchestra conductors and tour pros side by side.'],
  [6, 'The Short Game Heist', 'Inside 100 yards, where rounds are stolen. Wedges, spin, and nerve.'],
  [7, 'Sand', 'One bunker, fifty shots, every lie. The shot that stops scaring you tonight.'],
  [8, 'Reading Grass', 'Greens like a caddie reads them — slope, grain, and the line you can’t see from the book.'],
  [9, 'The Yips', 'The putt that ended a career, and the routine that brought it back.'],
  [10, 'Playing Ugly', 'Scoring when nothing works. Jack shoots 74 using only his bad swing.'],
  [11, 'Course Management', 'The percentages tour pros play — and the targets amateurs should steal from them.'],
  [12, 'The Rematch', 'Back to Pebble Beach. The stranger from Episode 1 plays Jack for the bet — with his new swing.'],
]

const PLAY_PATH =
  'M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z'

const ImageIcon = ({ size = 14, sw = 2 }: { size?: number; sw?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-4.35-4.35a1.4 1.4 0 0 0-2 0L5 20" />
  </svg>
)

const ClockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

function pickImage(maxW: number, cb: (dataUrl: string) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const f = input.files && input.files[0]
    if (!f) return
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      cb(c.toDataURL('image/jpeg', 0.78))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(f)
  }
  input.click()
}

export function MarqueeEmptyState() {
  const [dark, setDark] = useState(false)
  const [cover, setCover] = useState<string | null>(null)
  const [epImgs, setEpImgs] = useState<Record<number, string>>({})

  useEffect(() => {
    try {
      if (window.localStorage.getItem('spaire_theme') === 'dark') setDark(true)
      const c = window.localStorage.getItem('mes_cover')
      if (c) setCover(c)
      const imgs: Record<number, string> = {}
      for (const [n] of EPISODES) {
        const v = window.localStorage.getItem(`mes_ep_${n}`)
        if (v) imgs[n] = v
      }
      if (Object.keys(imgs).length) setEpImgs(imgs)
    } catch {
      /* ignore */
    }
  }, [])

  const persist = (key: string, url: string) => {
    try {
      window.localStorage.setItem(key, url)
    } catch {
      /* quota — preview only */
    }
  }

  const toggleTheme = useCallback(() => {
    setDark((d) => {
      try {
        window.localStorage.setItem('spaire_theme', d ? 'light' : 'dark')
      } catch {
        /* ignore */
      }
      return !d
    })
  }, [])

  const addCover = () =>
    pickImage(1800, (url) => {
      setCover(url)
      persist('mes_cover', url)
    })
  const addEp = (n: number) =>
    pickImage(900, (url) => {
      setEpImgs((m) => ({ ...m, [n]: url }))
      persist(`mes_ep_${n}`, url)
    })

  // ── strip arrows: show/hide by scroll position ──
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [showPrev, setShowPrev] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const updateArrows = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const max = strip.scrollWidth - strip.clientWidth - 2
    setShowPrev(strip.scrollLeft > 2)
    setShowNext(strip.scrollLeft < max)
  }, [])
  useEffect(() => {
    updateArrows()
    const strip = stripRef.current
    if (!strip) return
    strip.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    const raf = requestAnimationFrame(updateArrows)
    return () => {
      strip.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
      cancelAnimationFrame(raf)
    }
  }, [updateArrows])
  const scrollBy = (dir: 1 | -1) => {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className={`mes-root${dark ? ' dark' : ''}`}>
      {/* ════════ MARQUEE HERO ════════ */}
      <header
        className={`panel${cover ? ' filled' : ''}`}
        data-screen-label="Marquee Hero (awaiting cover)"
      >
        <div className="ph-ambient" />
        <div className="glass-tint" />
        <div
          className="photo"
          style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
        />
        <div className="hero-ph-glyph">
          <ImageIcon size={64} sw={1.1} />
        </div>
        <div className="panel-grain" />

        <div className="panel-brand rise">Spaire Originals</div>

        <div className="creator-bar">
          <button className="add-pill" type="button" onClick={addCover}>
            <ImageIcon size={14} />
            <span>{cover ? 'Change cover' : 'Add cover'}</span>
          </button>
          <button className="add-pill" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d={PLAY_PATH} />
            </svg>
            Add trailer
          </button>
          <button
            className="theme-toggle"
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <svg
              className="ic-moon"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
            <svg
              className="ic-sun"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
        </div>

        <div className="panel-title">
          <div
            className="pt-eyebrow rise d1"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
          >
            Documentary Series · Golf
          </div>
          <h1
            className="pt-h rise d1"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
          >
            The Golfer’s Blueprint
          </h1>
        </div>

        <div className="band rise d2">
          <div className="band-actions">
            <button className="abtn play" type="button">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d={PLAY_PATH} />
              </svg>
              Play Episode 1 Free
            </button>
            <button className="abtn buy" type="button">
              Subscribe — $89
            </button>
            <div className="band-free">First 3 episodes free · cancel anytime</div>
          </div>

          <div className="band-desc">
            <p
              className="bd-text"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
            >
              A two-time major champion takes you inside the scoring game — the
              swing, the short game, and the mind that wins the shots that
              matter. Shot like a film, taught like a private lesson.
            </p>
            <div className="bd-meta">
              Documentary Series · Golf&nbsp;&nbsp;·&nbsp;&nbsp;2026&nbsp;&nbsp;·&nbsp;&nbsp;0
              Episodes&nbsp;&nbsp;·&nbsp;&nbsp;0m
            </div>
            <div className="bd-badges">
              <span className="bdg rate">All Levels</span>
              <span className="bdg">Self-paced</span>
              <span className="bdg">Captions</span>
              <span className="bdg">Mobile &amp; TV</span>
              <button className="bd-trailer" type="button">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d={PLAY_PATH} />
                </svg>
                Trailer
              </button>
            </div>
          </div>

          <div className="band-cast">
            <div className="bc-k">Instructor</div>
            <div
              className="bc-v"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
            >
              Jack Reeves
            </div>
            <div
              className="bc-sub"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
            >
              Two-time major champion and former world No. 1.
            </div>
          </div>
        </div>
      </header>

      {/* ════════ EPISODES ════════ */}
      <div className="lessons" data-screen-label="Episodes">
        <div className="row-head">
          <span className="rh">Episodes</span>
          <span className="rh-meta">12 episodes · first 3 free · add stills</span>
        </div>
        <div className="strip-wrap">
          <button
            className={`arrow prev${showPrev ? ' show' : ''}`}
            aria-label="Previous"
            type="button"
            onClick={() => scrollBy(-1)}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 5l-6.5 7 6.5 7" />
            </svg>
          </button>
          <button
            className={`arrow next${showNext ? ' show' : ''}`}
            aria-label="Next"
            type="button"
            onClick={() => scrollBy(1)}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9.5 5l6.5 7-6.5 7" />
            </svg>
          </button>
          <div className="grid" ref={stripRef}>
            {EPISODES.map(([n, title, desc]) => {
              const free = n <= 3
              const img = epImgs[n]
              return (
                <div className="lc-catalog" key={n}>
                  <div className="lc-card">
                    <div className={`lc-thumb ph${img ? ' filled' : ''}`}>
                      <div className="ph-ambient" />
                      <div className="glass-tint" />
                      <div
                        className="photo"
                        style={
                          img ? { backgroundImage: `url("${img}")` } : undefined
                        }
                      />
                      {free ? (
                        <div className="lc-state lc-free">
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Free
                        </div>
                      ) : (
                        <div className="lc-state lc-lock">
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
                            <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
                          </svg>
                        </div>
                      )}
                      <button
                        className="thumb-add"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          addEp(n)
                        }}
                      >
                        <ImageIcon size={12} sw={2.2} />
                        Add image or cover
                      </button>
                    </div>
                    <div className="lc-info">
                      <div className="lc-num">Episode {n}</div>
                      <div
                        className="lc-title"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                      >
                        {title}
                      </div>
                      <div
                        className="lc-desc"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                      >
                        {desc}
                      </div>
                      <div className="lc-meta">
                        <ClockIcon />
                        <span>0m</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ============================================================
           COURSE PAGE — Marquee hero · Episodic · first 3 episodes free.
           Catalog cards. Band fades into the page color in both modes.
           ============================================================ */
        .mes-root {
          --bg: #ffffff;
          --band: 255, 255, 255;
          --bt: #1d1d1f; /* band text */
          --bt2: rgba(0, 0, 0, 0.56);
          --bt3: rgba(0, 0, 0, 0.4);
          --text: #1d1d1f;
          --text-2: #86868b;
          --ink: #07080a;
          --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', system-ui, sans-serif;
          --gut: 64px;
          font-family: var(--sf);
          background: var(--bg);
          color: var(--text);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.014em;
          transition: background 0.4s ease;
          min-height: 100vh;
        }
        .mes-root.dark {
          --bg: #141416;
          --band: 20, 20, 22;
          --bt: #f5f5f7;
          --bt2: rgba(245, 245, 247, 0.65);
          --bt3: rgba(245, 245, 247, 0.45);
          --text: #f5f5f7;
          --text-2: rgba(245, 245, 247, 0.6);
        }
        .mes-root :global(button) {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit;
        }

        /* ============================================================ MARQUEE HERO */
        .panel {
          position: relative;
          width: 100%;
          /* Full-viewport tall, matching the live marquee/cover heroes. */
          height: 100svh;
          min-height: 640px;
          overflow: hidden;
          background: var(--ink);
        }
        .panel-grain {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          pointer-events: none;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .panel-brand {
          position: absolute;
          left: var(--gut);
          top: 32px;
          z-index: 4;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.4);
        }
        .theme-toggle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(20, 20, 24, 0.4);
          color: #fff;
          -webkit-backdrop-filter: blur(14px) saturate(150%);
          backdrop-filter: blur(14px) saturate(150%);
          box-shadow: none;
          display: grid;
          place-items: center;
          transition: background 0.2s, transform 0.16s;
        }
        .theme-toggle:hover {
          background: rgba(40, 40, 46, 0.6);
          transform: scale(1.06);
        }
        .theme-toggle:active {
          transform: scale(0.94);
        }
        .theme-toggle :global(.ic-sun) {
          display: none;
        }
        .mes-root.dark .theme-toggle :global(.ic-sun) {
          display: block;
        }
        .mes-root.dark .theme-toggle :global(.ic-moon) {
          display: none;
        }

        .panel-title {
          position: absolute;
          left: var(--gut);
          right: var(--gut);
          bottom: 242px;
          z-index: 4;
        }
        .pt-eyebrow {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 14px;
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
        }
        .pt-h {
          font-size: clamp(40px, 4.8vw, 72px);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 0.92;
          max-width: 14ch;
          color: #fff;
          text-shadow: 0 4px 50px rgba(0, 0, 0, 0.4);
        }

        /* frosted control band — fades into the page color */
        .band {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr) 250px;
          gap: 44px;
          align-items: start;
          padding: 76px var(--gut) 38px;
          -webkit-backdrop-filter: blur(32px) saturate(140%);
          backdrop-filter: blur(32px) saturate(140%);
          background: linear-gradient(
            0deg,
            rgba(var(--band), 0.97) 30%,
            rgba(var(--band), 0.82) 58%,
            rgba(var(--band), 0.45) 82%,
            rgba(var(--band), 0) 100%
          );
          -webkit-mask-image: linear-gradient(0deg, #000 78%, transparent 100%);
          mask-image: linear-gradient(0deg, #000 78%, transparent 100%);
          color: var(--bt);
          transition: color 0.4s ease;
        }
        .band-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .abtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          height: 46px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: transform 0.16s cubic-bezier(0.2, 1.2, 0.3, 1),
            background 0.16s, box-shadow 0.16s;
        }
        .abtn:active {
          transform: scale(0.975);
        }
        .abtn.play {
          background: var(--bt);
          color: var(--bg);
          box-shadow: 0 8px 26px rgba(0, 0, 0, 0.18);
        }
        .abtn.play:hover {
          transform: translateY(-1px);
        }
        .abtn.buy {
          background: rgba(var(--band), 0.55);
          color: var(--bt);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          backdrop-filter: blur(20px) saturate(160%);
          box-shadow: inset 0 0 0 1px var(--bt3);
        }
        .abtn.buy:hover {
          transform: translateY(-1px);
        }
        /* dark mode — liquid glass: frosted, white rim light, white label */
        .mes-root.dark .abtn.buy {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          box-shadow: none;
        }
        .mes-root.dark .abtn.buy:hover {
          background: rgba(255, 255, 255, 0.24);
        }
        .mes-root.dark .bdg {
          background: rgba(255, 255, 255, 0.12);
        }
        .mes-root.dark .bdg.rate {
          background: transparent;
          box-shadow: none;
        }
        .band-free {
          font-size: 13px;
          font-weight: 500;
          color: var(--bt2);
          text-align: center;
          margin-top: 3px;
        }

        .band-desc {
          padding-top: 2px;
        }
        .bd-text {
          font-size: 16px;
          line-height: 1.5;
          font-weight: 400;
          color: var(--bt);
          max-width: 62ch;
        }
        .bd-meta {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--bt2);
          margin-top: 12px;
        }
        .bd-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }
        .bdg {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--bt2);
          background: rgba(125, 125, 135, 0.16);
          border-radius: 5px;
          padding: 3px 7px;
        }
        .bdg.rate {
          background: transparent;
          box-shadow: inset 0 0 0 1.5px var(--bt3);
        }
        .bd-trailer {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--bt);
          padding: 3px 5px;
          margin-left: 3px;
        }

        .band-cast {
          padding-top: 2px;
        }
        .bc-k {
          font-size: 12px;
          font-weight: 600;
          color: var(--bt3);
          margin-bottom: 5px;
        }
        .bc-v {
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--bt);
        }
        .bc-sub {
          font-size: 13.5px;
          line-height: 1.45;
          color: var(--bt2);
          margin-top: 4px;
        }

        /* entrance */
        .rise {
          opacity: 0;
          transform: translateY(22px);
          animation: mes-rise 1s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .rise.d1 {
          animation-delay: 0.15s;
        }
        .rise.d2 {
          animation-delay: 0.35s;
        }
        @keyframes mes-rise {
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rise {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }

        /* ── editable writing ── */
        .mes-root :global([contenteditable]) {
          outline: none;
          border-radius: 6px;
          transition: box-shadow 0.15s;
          cursor: text;
        }
        .mes-root :global([contenteditable]:hover) {
          box-shadow: 0 0 0 1.5px rgba(0, 113, 227, 0.35);
        }
        .mes-root :global([contenteditable]:focus) {
          box-shadow: 0 0 0 2px #0071e3;
        }

        /* ── liquid glass placeholder: blurred ambient under glass tint ── */
        .ph-ambient {
          position: absolute;
          inset: -15%;
          background: radial-gradient(
              42% 52% at 20% 28%,
              #6e7a5e 0%,
              transparent 70%
            ),
            radial-gradient(46% 56% at 76% 22%, #8a7565 0%, transparent 70%),
            radial-gradient(52% 62% at 62% 82%, #46464c 0%, transparent 72%),
            radial-gradient(36% 46% at 28% 78%, #5d6e6a 0%, transparent 70%),
            #57544e;
          filter: blur(40px);
        }
        .glass-tint {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          -webkit-backdrop-filter: blur(60px) saturate(140%);
          backdrop-filter: blur(60px) saturate(140%);
        }
        .hero-ph-glyph {
          position: absolute;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          color: rgba(255, 255, 255, 0.22);
          pointer-events: none;
        }

        /* creator bar pills */
        .creator-bar {
          position: absolute;
          top: 26px;
          right: var(--gut);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .add-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          padding: 0 18px;
          border-radius: 980px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          font-family: var(--sf);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: background 0.2s, transform 0.16s;
        }
        .add-pill:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.04);
        }
        .add-pill:active {
          transform: scale(0.96);
        }

        /* uploaded photo state */
        .photo {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          display: none;
        }
        .filled .photo {
          display: block;
        }
        .panel.filled .ph-ambient,
        .panel.filled .glass-tint,
        .panel.filled .hero-ph-glyph {
          display: none;
        }

        /* catalog thumb placeholder */
        .lc-thumb.ph {
          background: none;
        }
        .lc-thumb .thumb-add {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 14px;
          border-radius: 980px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.005em;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.18s, transform 0.18s;
        }
        .lc-thumb .thumb-add:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: translate(-50%, -50%) scale(1.05);
        }
        .lc-thumb.filled .thumb-add {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
        }
        .lc-catalog:hover .lc-thumb.filled .thumb-add {
          opacity: 1;
          pointer-events: auto;
        }

        /* ============================================================ EPISODES — catalog cards */
        .lessons {
          padding: 48px var(--gut) 96px;
        }
        .row-head {
          display: flex;
          align-items: baseline;
          gap: 13px;
          margin-bottom: 18px;
        }
        .row-head .rh {
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text);
          transition: color 0.4s ease;
        }
        .row-head .rh-meta {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-2);
          transition: color 0.4s ease;
        }

        .strip-wrap {
          position: relative;
        }
        .grid {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          padding: 4px 2px 16px;
          scrollbar-width: none;
        }
        .grid::-webkit-scrollbar {
          display: none;
        }
        .grid .lc-catalog {
          flex: 0 0 calc((100% - 60px) / 4);
          scroll-snap-align: start;
        }

        .arrow {
          position: absolute;
          top: 0;
          bottom: 16px;
          z-index: 5;
          width: 52px;
          background: none;
          color: rgba(0, 0, 0, 0.5);
          display: grid;
          place-items: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, color 0.15s;
        }
        .arrow:hover {
          color: #000;
        }
        .mes-root.dark .arrow {
          color: rgba(255, 255, 255, 0.55);
        }
        .mes-root.dark .arrow:hover {
          color: #fff;
        }
        .arrow.prev {
          left: -52px;
        }
        .arrow.next {
          right: -52px;
        }
        .arrow.show {
          opacity: 1;
          pointer-events: auto;
        }
        .arrow :global(svg) {
          transition: transform 0.15s;
        }
        .arrow:active :global(svg) {
          transform: scale(0.88);
        }

        /* ── catalog lesson card ── */
        .lc-catalog {
          cursor: pointer;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.014em;
        }
        .lc-card {
          width: 100%;
          border-radius: 16px;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e6e6e9;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.05);
          transition: transform 0.26s cubic-bezier(0.34, 1.3, 0.64, 1),
            box-shadow 0.26s;
        }
        .lc-catalog:hover .lc-card {
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .lc-thumb {
          position: relative;
          flex: 0 0 auto;
          aspect-ratio: 380 / 214;
          background: #111111;
          overflow: hidden;
        }

        .lc-state {
          position: absolute;
          left: 12px;
          top: 12px;
        }
        .lc-free {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #111;
          background: rgba(255, 255, 255, 0.92);
          padding: 4px 9px;
          border-radius: 980px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .lc-lock {
          width: 25px;
          height: 25px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.92);
          background: rgba(0, 0, 0, 0.42);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          box-shadow: none;
        }

        .lc-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 16px 18px 18px;
        }
        .lc-num {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #86868b;
          margin-bottom: 5px;
        }
        .lc-title {
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.2;
          color: #1d1d1f;
          margin-bottom: 7px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lc-desc {
          font-size: 13.5px;
          color: rgba(0, 0, 0, 0.56);
          line-height: 1.5;
          text-wrap: pretty;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 40px;
        }
        .lc-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: auto;
          padding-top: 11px;
          font-size: 12.5px;
          font-weight: 500;
          color: #86868b;
          font-variant-numeric: tabular-nums;
        }

        @media (max-width: 1200px) {
          .mes-root {
            --gut: 44px;
          }
          .band {
            grid-template-columns: 280px minmax(0, 1fr);
            gap: 36px;
          }
          .band-cast {
            display: none;
          }
          .grid .lc-catalog {
            flex-basis: calc((100% - 40px) / 3);
          }
        }
        @media (max-width: 820px) {
          .mes-root {
            --gut: 22px;
          }
          .panel-title {
            bottom: 234px;
          }
          .band {
            grid-template-columns: 1fr;
            gap: 18px;
            padding-bottom: 28px;
          }
          .band-desc {
            display: none;
          }
          .grid .lc-catalog {
            flex-basis: calc((100% - 20px) / 2);
          }
        }
      `}</style>
    </div>
  )
}

export default MarqueeEmptyState
