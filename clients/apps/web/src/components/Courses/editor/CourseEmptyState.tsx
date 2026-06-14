'use client'

// CourseEmptyState — literal clone of "Course Page Empty State.html": the
// creator-facing course page at the end of onboarding for the Cover hero +
// Free Sample + Spotlight cards + Modules combination.
//
// The AI has already filled the WRITING; the MEDIA is missing. Every missing
// surface renders a liquid-glass placeholder (blurred ambient colour field
// under a glass tint) — never the cover photo. Frosted "Add" controls sit
// top-right (Add cover / Add trailer / dark-mode toggle); the sample screen
// and every lesson card carry their own add/change affordances. All writing
// is touch-to-edit (contenteditable with a blue focus ring).
//
// Upload behaviour matches the design: pick → canvas-downscale → apply as the
// .photo background + mark .filled (placeholder hides, photo + shade show;
// "Add cover" becomes "Change cover"; the sample gets a hover Change pill;
// card add-pills hide until hover). Picks persist to localStorage with the
// design's keys so the preview survives reloads.

import { useCallback, useEffect, useState } from 'react'

type Lesson = [number, string, string]

// AI-prefilled sample copy — exactly the design's data. This is the contract
// shape the generation must produce: short title + a two-line description
// ("Fragment. Sentence." cadence, ~80–110 chars).
const MODULES: { title: string; lessons: Lesson[] }[] = [
  {
    title: 'Foundations',
    lessons: [
      [1, 'Grip & Setup', 'Where every swing begins. The neutral grip, pressure points, and a setup you can repeat under pressure.'],
      [2, 'Stance & Alignment', 'Aim is a skill. Building a stance that points the body and the clubface at the same target.'],
      [3, 'Ball Position', 'One variable, every club. How ball position changes strike, flight, and why most players get it wrong.'],
      [4, 'Posture & Balance', 'The athletic base. Spine angle, knee flex, and weight that stays centered through the swing.'],
      [5, 'Pre-Shot Routine', 'The same 20 seconds before every shot. Building a routine that quiets the mind.'],
      [6, 'Equipment Essentials', 'What actually matters in the bag. Lofts, lies, and a setup that fits your swing.'],
    ],
  },
  {
    title: 'The Swing',
    lessons: [
      [7, 'The Takeaway', 'The first 18 inches decide the rest. Starting the club back on plane, every time.'],
      [8, 'The Backswing', 'Width, turn, and the top position. Loading power without losing the clubface.'],
      [9, 'Downswing & Impact', 'Sequencing from the ground up. Why impact is a position you arrive at, not one you force.'],
      [10, 'Tempo & Rhythm', 'Smooth is fast. Training a swing that holds together on the first tee and the last hole.'],
      [11, 'Driver Off the Tee', 'Width and launch. Hitting up on the ball and finding more fairways with more speed.'],
      [12, 'Iron Striking', 'Ball first, turf second. Compressing irons and controlling your landing distances.'],
    ],
  },
  {
    title: 'Scoring',
    lessons: [
      [13, 'Chipping & Pitching', 'One technique, many distances. Landing spots, trajectory, and touch around the green.'],
      [14, 'Bunker Play', 'The shot that scares everyone, simplified. Using the bounce and committing through the sand.'],
      [15, 'Reading the Green', 'Slope, grain, and speed. Seeing the line before you ever stand over the ball.'],
      [16, 'Putting Under Pressure', 'A routine that survives nerves. Short putts, long lags, and the discipline of pace.'],
      [17, 'Wedge Distance Control', 'The clock system. Three swings per wedge for a number you can trust inside 100 yards.'],
      [18, 'Course Strategy', 'Playing the percentages. Picking targets that fit your shot, not the one you wish you had.'],
    ],
  },
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

// pick → downscale on a canvas → JPEG data URL (the design's pickImage).
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

export function CourseEmptyState() {
  const [dark, setDark] = useState(false)
  const [cover, setCover] = useState<string | null>(null)
  const [sample, setSample] = useState<string | null>(null)
  const [lessonImgs, setLessonImgs] = useState<Record<number, string>>({})

  // Restore persisted picks + theme (the design's localStorage behaviour).
  useEffect(() => {
    try {
      if (window.localStorage.getItem('spaire_theme') === 'dark') setDark(true)
      const c = window.localStorage.getItem('ces_cover')
      if (c) setCover(c)
      const s = window.localStorage.getItem('ces_sample')
      if (s) setSample(s)
      const imgs: Record<number, string> = {}
      for (const m of MODULES)
        for (const [n] of m.lessons) {
          const v = window.localStorage.getItem(`ces_lesson_${n}`)
          if (v) imgs[n] = v
        }
      if (Object.keys(imgs).length) setLessonImgs(imgs)
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
      persist('ces_cover', url)
    })
  const addSample = () =>
    pickImage(1600, (url) => {
      setSample(url)
      persist('ces_sample', url)
    })
  const addLesson = (n: number) =>
    pickImage(900, (url) => {
      setLessonImgs((m) => ({ ...m, [n]: url }))
      persist(`ces_lesson_${n}`, url)
    })

  return (
    <div className={`ces-root${dark ? ' dark' : ''}`}>
      {/* ════════ HERO — cover not added yet ════════ */}
      <section
        className={`hero${cover ? ' filled' : ''}`}
        data-screen-label="Hero (awaiting cover)"
      >
        <div className="ph-ambient" />
        <div className="hero-art" />
        <div
          className="photo"
          style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
        />
        <div className="photo-shade" />
        <div className="hero-ph">
          <ImageIcon size={64} sw={1.1} />
        </div>
        <div className="hero-shade" />
        <div className="hero-blend" />

        <div className="hero-eyebrow">
          <span className="dot" />
          <span contentEditable suppressContentEditableWarning spellCheck={false}>
            Spaire Original
          </span>
        </div>

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

        <div className="hero-content">
          <div className="hero-meta">
            <span
              className="badge"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
            >
              New Series
            </span>
            <div className="meta-line">
              <span>0 lessons</span>
              <span className="sep">·</span>
              <span>0 min</span>
              <span className="sep">·</span>
              <span contentEditable suppressContentEditableWarning spellCheck={false}>
                All levels
              </span>
            </div>
          </div>

          <h1
            className="hero-title"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
          >
            The Golfer’s
            <br />
            Blueprint
          </h1>

          <p className="hero-desc">
            <span contentEditable suppressContentEditableWarning spellCheck={false}>
              A two-time major champion takes you inside the scoring game — the
              swing, the short game, and the mind that wins the shots that
              matter. Shot like a film, taught like a private lesson.
            </span>{' '}
            <span
              className="with"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
            >
              — with Jack Reeves
            </span>
          </p>

          <div className="hero-actions">
            <button className="btn-trailer" type="button">
              <span className="play">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d={PLAY_PATH} />
                </svg>
              </span>
              Watch trailer
            </button>
            <button className="btn-enroll" type="button">
              Enroll · $79
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ════════ FREE SAMPLE — clip not added yet ════════ */}
      <section className="sample" data-screen-label="Free Sample (awaiting clip)">
        <div
          className="sample-eyebrow"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
        >
          Free Sample
        </div>
        <h2 contentEditable suppressContentEditableWarning spellCheck={false}>
          Watch a free sample
        </h2>
        <p
          className="sample-sub"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
        >
          A few minutes inside the course. No account, no card.
        </p>
        <div className={`sample-screen${sample ? ' filled' : ''}`}>
          <div className="ph-ambient" />
          <div className="glass-tint" />
          <div
            className="photo"
            style={sample ? { backgroundImage: `url("${sample}")` } : undefined}
          />
          <div className="photo-shade" />
          <div className="ph-cta">
            <span
              className="ph-ic"
              role="button"
              tabIndex={0}
              onClick={addSample}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') addSample()
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="ph-k">Add your sample</span>
            <span className="ph-s">A 2–3 minute clip from any lesson</span>
          </div>
          <button className="change-pill" type="button" onClick={addSample}>
            <ImageIcon size={12} sw={2.2} />
            Change
          </button>
        </div>
      </section>

      {/* ════════ LESSONS — stills not added yet ════════ */}
      <div className="lessons" data-screen-label="Lessons (awaiting stills)">
        {MODULES.map((mod, mi) => (
          <section className="row" key={mi} data-screen-label={`Module ${mi + 1}`}>
            <div className="row-head">
              <span className="mod">Module {mi + 1}</span>
              <span contentEditable suppressContentEditableWarning spellCheck={false}>
                {mod.title}
              </span>
            </div>
            <div className="grid">
              {mod.lessons.map(([n, title, desc]) => {
                const img = lessonImgs[n]
                return (
                  <div className={`card${img ? ' filled' : ''}`} key={n}>
                    <div className="ph-ambient" />
                    <div className="glass-tint" />
                    <div
                      className="photo"
                      style={
                        img ? { backgroundImage: `url("${img}")` } : undefined
                      }
                    />
                    <div className="photo-shade" />
                    <button
                      className="card-add"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        addLesson(n)
                      }}
                    >
                      <ImageIcon size={12} sw={2.2} />
                      Add image or cover
                    </button>
                    <div className="card-info">
                      <div className="ep">Lesson {n}</div>
                      <div
                        className="title"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                      >
                        {title}
                      </div>
                      <div
                        className="desc"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                      >
                        {desc}
                      </div>
                      <div className="foot">
                        <span className="time">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d={PLAY_PATH} />
                          </svg>
                          0m
                        </span>
                        <button className="dots" aria-label="More" type="button">
                          <span />
                          <span />
                          <span />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <style jsx>{`
        /* ============================================================
           COURSE PAGE — CREATOR EMPTY STATE.
           ============================================================ */
        .ces-root {
          --bg: #ffffff;
          --text: #1d1d1f;
          --text-2: #86868b;
          --blue: #0071e3;
          --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', system-ui, sans-serif;
          --po: 'Poppins', var(--font-poppins), -apple-system,
            BlinkMacSystemFont, system-ui, sans-serif;
          font-family: var(--sf);
          background: var(--bg);
          color: var(--text);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.01em;
          transition: background 0.4s ease;
          min-height: 100vh;
        }
        .ces-root :global(button) {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit;
        }

        /* ── editable writing ── */
        .ces-root :global([contenteditable]) {
          outline: none;
          border-radius: 6px;
          transition: box-shadow 0.15s;
          cursor: text;
        }
        .ces-root :global([contenteditable]:hover) {
          box-shadow: 0 0 0 1.5px rgba(0, 113, 227, 0.35);
        }
        .ces-root :global([contenteditable]:focus) {
          box-shadow: 0 0 0 2px var(--blue);
        }

        /* ── dark mode (background + background writing only) ── */
        .ces-root.dark {
          --bg: #141416;
          --text: #f5f5f7;
          --text-2: rgba(245, 245, 247, 0.6);
        }
        .row-head,
        .sample h2,
        .sample-sub,
        .sample-eyebrow {
          transition: color 0.4s ease;
        }

        /* ── liquid glass: blurred ambient color under a glass tint ── */
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
          box-shadow: none;
        }

        /* ── uploaded photo state ── */
        .photo {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          display: none;
        }
        .photo-shade {
          position: absolute;
          inset: 0;
          display: none;
        }
        .filled .photo,
        .filled .photo-shade {
          display: block;
        }
        .hero.filled .ph-ambient,
        .hero.filled .hero-art,
        .hero.filled .hero-ph {
          display: none;
        }
        .hero .photo-shade {
          background: linear-gradient(
            0deg,
            rgba(5, 5, 8, 0.62) 0%,
            rgba(5, 5, 8, 0.28) 32%,
            transparent 58%
          );
        }
        .sample-screen.filled .ph-ambient,
        .sample-screen.filled .glass-tint,
        .sample-screen.filled .ph-cta {
          display: none;
        }
        .sample-screen .photo-shade {
          background: linear-gradient(
            0deg,
            rgba(7, 8, 10, 0.55) 0%,
            rgba(7, 8, 10, 0.12) 30%,
            transparent 50%
          );
        }
        .card.filled .ph-ambient,
        .card.filled .glass-tint {
          display: none;
        }
        .card .photo-shade {
          background: linear-gradient(
            0deg,
            rgba(7, 8, 10, 0.92) 2%,
            rgba(7, 8, 10, 0.6) 24%,
            rgba(7, 8, 10, 0.08) 50%,
            transparent 64%
          );
        }
        /* once filled, the change control hides until hover */
        .card.filled .card-add {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, background 0.18s;
        }
        .card.filled:hover .card-add {
          opacity: 1;
          pointer-events: auto;
        }
        .change-pill {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 3;
          display: none;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 14px;
          border-radius: 980px;
          background: rgba(10, 11, 13, 0.46);
          color: #fff;
          -webkit-backdrop-filter: blur(14px) saturate(150%);
          backdrop-filter: blur(14px) saturate(150%);
          box-shadow: none;
          font-family: var(--sf);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, background 0.18s;
        }
        .sample-screen.filled .change-pill {
          display: inline-flex;
        }
        .sample-screen.filled:hover .change-pill {
          opacity: 1;
        }
        .change-pill:hover {
          background: rgba(40, 40, 46, 0.7);
        }

        /* ============================================================ HERO — awaiting cover */
        .hero {
          position: relative;
          width: 100%;
          /* Full-viewport tall, same as the marquee/extended hero. */
          height: 100svh;
          min-height: 640px;
          overflow: hidden;
          background: transparent;
          font-family: var(--po);
          letter-spacing: normal;
        }
        .hero-art {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          -webkit-backdrop-filter: blur(60px) saturate(140%);
          backdrop-filter: blur(60px) saturate(140%);
          box-shadow: none;
        }
        .hero-ph {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -64%);
          color: rgba(255, 255, 255, 0.22);
          pointer-events: none;
        }
        .hero-shade {
          display: none;
        }
        .hero-blend {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 48px;
          z-index: 2;
          background: linear-gradient(180deg, transparent, #141416);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }
        .ces-root.dark .hero-blend {
          opacity: 1;
        }

        .hero-eyebrow {
          position: absolute;
          top: 48px;
          left: 64px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        .hero-eyebrow .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #e0482e;
        }

        /* ── creator controls, top right ── */
        .creator-bar {
          position: absolute;
          top: 40px;
          right: 64px;
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
          box-shadow: none;
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
        .theme-toggle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          display: grid;
          place-items: center;
          transition: background 0.2s, transform 0.16s;
        }
        .theme-toggle:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.06);
        }
        .theme-toggle:active {
          transform: scale(0.94);
        }
        .theme-toggle :global(.ic-sun) {
          display: none;
        }
        .ces-root.dark .theme-toggle :global(.ic-sun) {
          display: block;
        }
        .ces-root.dark .theme-toggle :global(.ic-moon) {
          display: none;
        }

        .hero-content {
          position: absolute;
          left: 64px;
          right: 64px;
          bottom: 52px;
          max-width: 760px;
          color: #fff;
          z-index: 3;
        }
        .hero-meta {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.92);
          color: #1d1d1f;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 980px;
        }
        .meta-line {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 15px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.78);
        }
        .meta-line .sep {
          opacity: 0.55;
        }
        .hero-title {
          font-size: clamp(46px, 5.6vw, 84px);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.025em;
          text-wrap: balance;
        }
        .hero-desc {
          margin-top: 18px;
          max-width: 580px;
          font-size: 16px;
          font-weight: 500;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.88);
        }
        .hero-desc .with {
          color: rgba(255, 255, 255, 0.62);
        }
        .hero-actions {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-top: 26px;
        }
        .btn-trailer {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          background: #fff;
          color: #111;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          padding: 12px 24px 12px 12px;
          border-radius: 980px;
          font-family: var(--sf);
          transition: transform 0.16s ease;
        }
        .btn-trailer:hover {
          transform: scale(1.03);
        }
        .btn-trailer:active {
          transform: scale(0.98);
        }
        .btn-trailer .play {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #111;
          color: #fff;
          display: grid;
          place-items: center;
          flex: none;
        }
        .btn-enroll {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          padding: 15px 26px;
          border-radius: 980px;
          font-family: var(--sf);
          transition: background 0.18s, transform 0.16s ease;
        }
        .btn-enroll:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.03);
        }
        .btn-enroll:active {
          transform: scale(0.98);
        }

        /* ============================================================ FREE SAMPLE — awaiting clip */
        .sample {
          padding: 76px 64px 12px;
          text-align: center;
        }
        .sample-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-2);
          margin-bottom: 14px;
        }
        .sample h2 {
          font-family: var(--po);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          letter-spacing: -0.025em;
          color: var(--text);
        }
        .sample-sub {
          font-size: 16px;
          color: var(--text-2);
          margin-top: 10px;
        }
        .sample-screen {
          position: relative;
          width: min(1040px, 100%);
          aspect-ratio: 16 / 9;
          margin: 36px auto 0;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 40px 30px rgba(0, 0, 0, 0.05);
          display: grid;
          place-items: center;
        }
        .ph-cta {
          position: relative;
          z-index: 2;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          color: #fff;
        }
        .ph-cta .ph-ic {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background 0.2s, transform 0.18s;
        }
        .ph-cta .ph-ic:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.06);
        }
        .ph-cta .ph-k {
          font-family: var(--sf);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .ph-cta .ph-s {
          font-family: var(--sf);
          font-size: 13px;
          color: rgba(235, 235, 245, 0.6);
          margin-top: -8px;
        }

        /* ============================================================ LESSON ROWS */
        .lessons {
          padding: 48px 64px 96px;
        }
        .row {
          margin-top: 48px;
        }
        .row:first-child {
          margin-top: 0;
        }
        .row-head {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text);
          margin-bottom: 16px;
        }
        .row-head .mod {
          color: var(--text-2);
          font-weight: 600;
        }

        .grid {
          display: flex;
          gap: 18px;
          overflow: hidden;
        }
        .grid .card {
          flex: 0 0 calc((100% - 90px) / 6);
        }

        /* spotlight card — awaiting still. Liquid glass, no hover job yet. */
        .card {
          position: relative;
          aspect-ratio: 380 / 362;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 18px rgba(0, 0, 0, 0.04);
        }
        .card-add {
          position: absolute;
          top: 32%;
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
          box-shadow: none;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.005em;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.18s, transform 0.18s;
        }
        .card-add:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: translate(-50%, -50%) scale(1.05);
        }

        .card-info {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          padding: 0 14px 12px;
        }
        .ep {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(235, 235, 245, 0.66);
        }
        .title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.015em;
          line-height: 1.15;
          color: #fff;
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .desc {
          font-size: 13px;
          line-height: 1.4;
          color: rgba(235, 235, 245, 0.76);
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 36px;
        }
        .foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 7px;
        }
        .time {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(235, 235, 245, 0.76);
          font-variant-numeric: tabular-nums;
        }
        .dots {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 4px 2px;
          color: rgba(235, 235, 245, 0.6);
        }
        .dots :global(span) {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: currentColor;
        }

        @media (max-width: 1380px) {
          .grid .card {
            flex: 0 0 calc((100% - 72px) / 5);
          }
        }
        @media (max-width: 1100px) {
          .grid .card {
            flex: 0 0 calc((100% - 54px) / 4);
          }
          .lessons {
            padding: 40px 40px 72px;
          }
        }
        @media (max-width: 760px) {
          .grid {
            flex-wrap: wrap;
          }
          .grid .card {
            flex: 0 0 calc((100% - 18px) / 2);
          }
          .lessons {
            padding: 28px 20px 56px;
          }
          .sample {
            padding: 48px 20px 8px;
          }
          .hero-eyebrow {
            top: 30px;
            left: 24px;
          }
          .creator-bar {
            top: 24px;
            right: 20px;
          }
          .hero-content {
            left: 24px;
            right: 24px;
            bottom: 36px;
          }
          .hero-actions {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}

export default CourseEmptyState
