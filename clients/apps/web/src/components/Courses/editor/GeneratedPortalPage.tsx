'use client'

// GeneratedPortalPage — THE page the AI generates, composed 1:1 from the two
// course-page designs ("Course Page Empty State.html" and "Marquee Empty
// State.html"). One surface, five axes, every onboarding choice honored:
//
//   hero      marquee | cover       — Marquee panel + frosted band that fades
//                                     into the page colour, or the Cover hero
//                                     with badge/title/desc over the art.
//   cards     spotlight | catalog   — title over the image vs. details below.
//   trial     free_preview | lesson_sample — Free/lock chips on tiles, or the
//                                     designed Free Sample screen section.
//   structure modules | episodic    — module rows vs. a scroll-snap strip
//                                     with hover arrows.
//   theme     light | dark          — page + band colours flip together
//                                     (design's toggle, persisted).
//
// MEDIA RULE: missing media renders the designs' liquid-glass placeholder
// (blurred ambient colour field under a glass tint) — NEVER the cover photo,
// and NO "Add image / Add trailer" affordances here; media is added later in
// the editor. A lesson only shows a photo if IT has one.

import { useCallback, useEffect, useRef, useState } from 'react'

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

const LockIcon = () => (
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
)

export type GeneratedLesson = {
  title: string
  description: string
  flatIdx: number
  /** Real lesson still when it exists; otherwise the glass placeholder. */
  imageUrl?: string | null
  durationLabel?: string | null
  free: boolean
  locked: boolean
}

export type GeneratedGroup = {
  /** Module title; null for the flat episodic season. */
  title: string | null
  lessons: GeneratedLesson[]
}

export type GeneratedPortalPageProps = {
  brand: string
  title: string
  /** Cover hero's two-line title break (AI titleLines). */
  titleLines?: string[] | null
  /** "Documentary Series · Golf" (AI eyebrow). */
  eyebrow: string
  /** "New Series" (AI badge — cover hero). */
  badge: string
  /** AI hero description (never the creator's raw brief). */
  desc: string
  /** Instructor credential line (AI byline). */
  byline: string
  instructorName: string
  heroVariant: 'marquee' | 'cover'
  cardVariant: 'spotlight' | 'catalog'
  structure: 'modules' | 'episodic'
  trialMode: 'free_preview' | 'lesson_sample'
  paywallEnabled: boolean
  freeLessons: number
  playLabel: string
  buyLabel: string
  freeLine: string
  coverUrl?: string | null
  coverPosition?: string | null
  /** Real sample poster/clip (public page); placeholder otherwise. */
  sampleImageUrl?: string | null
  samplePlayable?: boolean
  groups: GeneratedGroup[]
  lessonCount: number
  unit: 'lesson' | 'episode'
  dark: boolean
  /** Theme toggle (creator-facing). Omit to hide (public page). */
  onToggleDark?: () => void
  showTrailerButton?: boolean
  onPlay?: () => void
  onBuy?: () => void
  onTrailer?: () => void
  onSample?: () => void
  onLessonClick?: (flatIdx: number) => void
}

export function GeneratedPortalPage({
  brand,
  title,
  titleLines,
  eyebrow,
  badge,
  desc,
  byline,
  instructorName,
  heroVariant,
  cardVariant,
  structure,
  trialMode,
  paywallEnabled,
  freeLessons,
  playLabel,
  buyLabel,
  freeLine,
  coverUrl,
  coverPosition,
  sampleImageUrl,
  samplePlayable = false,
  groups,
  lessonCount,
  unit,
  dark,
  onToggleDark,
  showTrailerButton = true,
  onPlay,
  onBuy,
  onTrailer,
  onSample,
  onLessonClick,
}: GeneratedPortalPageProps) {
  const isEpisodic = structure === 'episodic'
  const unitCap = unit === 'episode' ? 'Episode' : 'Lesson'
  const year = new Date().getFullYear()

  const trialShort = !paywallEnabled
    ? `all ${unit}s free`
    : trialMode === 'lesson_sample'
      ? 'sample clip free'
      : `first ${freeLessons} free`

  // ── episodic strip arrows (design: show/hide by scroll position) ──
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
    if (!isEpisodic) return
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
  }, [isEpisodic, updateArrows])
  const scrollStrip = (dir: 1 | -1) => {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' })
  }

  const themeToggle = onToggleDark ? (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Toggle dark mode"
      onClick={onToggleDark}
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
  ) : null

  const chip = (l: GeneratedLesson) =>
    !paywallEnabled || trialMode === 'lesson_sample' ? null : l.free ? (
      <div className="lc-state lc-free">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Free
      </div>
    ) : (
      <div className="lc-state lc-lock">
        <LockIcon />
      </div>
    )

  // ── spotlight card (CourseEmptyState vocabulary, no add pill) ──
  const spotlightCard = (l: GeneratedLesson) => (
    <div
      className={`sp-card${l.imageUrl ? ' filled' : ''}`}
      key={l.flatIdx}
      onClick={() => onLessonClick?.(l.flatIdx)}
      role={onLessonClick ? 'button' : undefined}
    >
      <div className="ph-ambient" />
      <div className="glass-tint" />
      <div
        className="photo"
        style={
          l.imageUrl ? { backgroundImage: `url("${l.imageUrl}")` } : undefined
        }
      />
      <div className="photo-shade" />
      {chip(l)}
      <div className="card-info">
        <div className="ep">
          {unitCap} {l.flatIdx + 1}
        </div>
        <div className="sp-title">{l.title}</div>
        <div className="sp-desc">{l.description}</div>
        <div className="sp-foot">
          <span className="time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d={PLAY_PATH} />
            </svg>
            {l.durationLabel || '0m'}
          </span>
          <span className="dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  )

  // ── catalog card (MarqueeEmptyState vocabulary, no add pill) ──
  const catalogCard = (l: GeneratedLesson) => (
    <div
      className="lc-catalog"
      key={l.flatIdx}
      onClick={() => onLessonClick?.(l.flatIdx)}
      role={onLessonClick ? 'button' : undefined}
    >
      <div className="lc-card">
        <div className={`lc-thumb ph${l.imageUrl ? ' filled' : ''}`}>
          <div className="ph-ambient" />
          <div className="glass-tint" />
          <div
            className="photo"
            style={
              l.imageUrl
                ? { backgroundImage: `url("${l.imageUrl}")` }
                : undefined
            }
          />
          {chip(l)}
        </div>
        <div className="lc-info">
          <div className="lc-num">
            {unitCap} {l.flatIdx + 1}
          </div>
          <div className="lc-title">{l.title}</div>
          <div className="lc-desc">{l.description}</div>
          <div className="lc-meta">
            <ClockIcon />
            <span>{l.durationLabel || '0m'}</span>
          </div>
        </div>
      </div>
    </div>
  )

  const card = cardVariant === 'spotlight' ? spotlightCard : catalogCard

  return (
    <div className={`gpp-root${dark ? ' dark' : ''}`}>
      {/* ════════ HERO ════════ */}
      {heroVariant === 'marquee' ? (
        <header className={`panel${coverUrl ? ' filled' : ''}`}>
          <div className="ph-ambient" />
          <div className="glass-tint" />
          <div
            className="photo"
            style={
              coverUrl
                ? {
                    backgroundImage: `url("${coverUrl}")`,
                    backgroundPosition: coverPosition || 'center',
                  }
                : undefined
            }
          />
          <div className="hero-ph-glyph">
            <ImageIcon size={64} sw={1.1} />
          </div>
          <div className="panel-grain" />

          <div className="panel-brand rise">{brand}</div>
          {themeToggle && <div className="creator-bar">{themeToggle}</div>}

          <div className="panel-title">
            <div className="pt-eyebrow rise d1">{eyebrow}</div>
            <h1 className="pt-h rise d1">{title}</h1>
          </div>

          <div className="band rise d2">
            <div className="band-actions">
              <button className="abtn play" type="button" onClick={onPlay}>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d={PLAY_PATH} />
                </svg>
                {playLabel}
              </button>
              <button className="abtn buy" type="button" onClick={onBuy}>
                {buyLabel}
              </button>
              {freeLine ? <div className="band-free">{freeLine}</div> : null}
            </div>

            <div className="band-desc">
              <p className="bd-text">{desc}</p>
              <div className="bd-meta">
                {eyebrow}&nbsp;&nbsp;·&nbsp;&nbsp;{year}
                &nbsp;&nbsp;·&nbsp;&nbsp;{lessonCount} {unitCap}
                {lessonCount === 1 ? '' : 's'}
              </div>
              <div className="bd-badges">
                <span className="bdg rate">All Levels</span>
                <span className="bdg">Self-paced</span>
                <span className="bdg">Captions</span>
                <span className="bdg">Mobile &amp; TV</span>
                {showTrailerButton && (
                  <button
                    className="bd-trailer"
                    type="button"
                    onClick={onTrailer}
                  >
                    <svg
                      width="12"
                      height="12"
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
              <div className="bc-sub">{byline}</div>
            </div>
          </div>
        </header>
      ) : (
        <section className={`hero${coverUrl ? ' filled' : ''}`}>
          <div className="ph-ambient" />
          <div className="hero-art" />
          <div
            className="photo"
            style={
              coverUrl
                ? {
                    backgroundImage: `url("${coverUrl}")`,
                    backgroundPosition: coverPosition || 'center',
                  }
                : undefined
            }
          />
          <div className="photo-shade" />
          <div className="hero-ph">
            <ImageIcon size={64} sw={1.1} />
          </div>
          <div className="hero-blend" />

          <div className="hero-eyebrow">
            <span className="dot" />
            <span>Spaire Original</span>
          </div>
          {themeToggle && <div className="creator-bar">{themeToggle}</div>}

          <div className="hero-content">
            <div className="hero-meta">
              <span className="hbadge">{badge}</span>
              <div className="meta-line">
                <span>
                  {lessonCount} {unit}
                  {lessonCount === 1 ? '' : 's'}
                </span>
                <span className="sep">·</span>
                <span>All levels</span>
              </div>
            </div>

            <h1 className="hero-title">
              {titleLines && titleLines.length > 1 ? (
                titleLines.map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))
              ) : (
                title
              )}
            </h1>

            <p className="hero-desc">
              {desc}{' '}
              <span className="with">
                — {byline ? byline : `with ${instructorName}`}
              </span>
            </p>

            <div className="hero-actions">
              {showTrailerButton && (
                <button
                  className="btn-trailer"
                  type="button"
                  onClick={onTrailer ?? onPlay}
                >
                  <span className="play">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d={PLAY_PATH} />
                    </svg>
                  </span>
                  {trialMode === 'lesson_sample' ? playLabel : 'Watch trailer'}
                </button>
              )}
              <button className="btn-enroll" type="button" onClick={onBuy}>
                {buyLabel}
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
      )}

      {/* ════════ FREE SAMPLE — only for the lesson_sample trial ════════ */}
      {paywallEnabled && trialMode === 'lesson_sample' && (
        <section className="sample">
          <div className="sample-eyebrow">Free Sample</div>
          <h2>Watch a free sample</h2>
          <p className="sample-sub">
            A few minutes inside the {unit === 'episode' ? 'series' : 'course'}.
            No account, no card.
          </p>
          <div
            className={`sample-screen${sampleImageUrl ? ' filled' : ''}${
              samplePlayable ? ' playable' : ''
            }`}
            onClick={samplePlayable ? onSample : undefined}
            role={samplePlayable ? 'button' : undefined}
          >
            <div className="ph-ambient" />
            <div className="glass-tint" />
            <div
              className="photo"
              style={
                sampleImageUrl
                  ? { backgroundImage: `url("${sampleImageUrl}")` }
                  : undefined
              }
            />
            <div className="photo-shade" />
            {samplePlayable ? (
              <span className="sample-play">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d={PLAY_PATH} />
                </svg>
              </span>
            ) : (
              // Placeholder only — no add affordance; media comes later in
              // the editor. A faint glyph marks the screen as video.
              <span className="sample-glyph">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d={PLAY_PATH} />
                </svg>
              </span>
            )}
          </div>
        </section>
      )}

      {/* ════════ LESSONS / EPISODES ════════ */}
      {isEpisodic ? (
        <div className="lessons">
          <div className="row-head strip-head">
            <span className="rh">Episodes</span>
            <span className="rh-meta">
              {lessonCount} episode{lessonCount === 1 ? '' : 's'} · {trialShort}
            </span>
          </div>
          <div className="strip-wrap">
            <button
              className={`arrow prev${showPrev ? ' show' : ''}`}
              aria-label="Previous"
              type="button"
              onClick={() => scrollStrip(-1)}
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
              onClick={() => scrollStrip(1)}
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
            <div className="strip" ref={stripRef}>
              {groups.flatMap((g) => g.lessons).map((l) => card(l))}
            </div>
          </div>
        </div>
      ) : (
        <div className="lessons">
          {groups.map((g, gi) => (
            <section className="row" key={gi}>
              <div className="row-head">
                <span className="mod">Module {gi + 1}</span>
                <span>{g.title}</span>
              </div>
              <div className="mod-grid">{g.lessons.map((l) => card(l))}</div>
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        /* ============================================================
           GENERATED COURSE PAGE — composed from the two empty-state
           designs. Page + band colours flip together in dark mode.
           ============================================================ */
        .gpp-root {
          --bg: #ffffff;
          --band: 255, 255, 255;
          --bt: #1d1d1f;
          --bt2: rgba(0, 0, 0, 0.56);
          --bt3: rgba(0, 0, 0, 0.4);
          --text: #1d1d1f;
          --text-2: #86868b;
          --ink: #07080a;
          --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', system-ui, sans-serif;
          --po: 'Poppins', var(--font-poppins), -apple-system,
            BlinkMacSystemFont, system-ui, sans-serif;
          --gut: 64px;
          font-family: var(--sf);
          background: var(--bg);
          color: var(--text);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.014em;
          transition: background 0.4s ease;
          min-height: 100%;
        }
        .gpp-root.dark {
          --bg: #141416;
          --band: 20, 20, 22;
          --bt: #f5f5f7;
          --bt2: rgba(245, 245, 247, 0.65);
          --bt3: rgba(245, 245, 247, 0.45);
          --text: #f5f5f7;
          --text-2: rgba(245, 245, 247, 0.6);
        }
        .gpp-root :global(button) {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit;
        }

        /* ── liquid glass placeholder ── */
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

        /* ── theme toggle (creator bar, no add pills) ── */
        .creator-bar {
          position: absolute;
          top: 26px;
          right: var(--gut);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .theme-toggle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(20, 20, 24, 0.4);
          color: #fff;
          -webkit-backdrop-filter: blur(14px) saturate(150%);
          backdrop-filter: blur(14px) saturate(150%);
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
        .gpp-root.dark .theme-toggle :global(.ic-sun) {
          display: block;
        }
        .gpp-root.dark .theme-toggle :global(.ic-moon) {
          display: none;
        }

        /* ============================================================
           MARQUEE HERO — panel + frosted band fading into the page.
           ============================================================ */
        .panel {
          position: relative;
          width: 100%;
          height: 92vh;
          min-height: 560px;
          overflow: hidden;
          background: var(--ink);
        }
        .panel.filled .ph-ambient,
        .panel.filled .glass-tint,
        .panel.filled .hero-ph-glyph {
          display: none;
        }
        .panel-grain {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          pointer-events: none;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
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
        .panel-title {
          position: absolute;
          left: var(--gut);
          right: var(--gut);
          bottom: 286px;
          z-index: 4;
        }
        .pt-eyebrow {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 16px;
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
        }
        .pt-h {
          font-size: clamp(52px, 6vw, 92px);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 0.9;
          max-width: 13ch;
          color: #fff;
          text-shadow: 0 4px 50px rgba(0, 0, 0, 0.4);
        }
        .band {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr) 280px;
          gap: 52px;
          align-items: start;
          padding: 88px var(--gut) 46px;
          -webkit-backdrop-filter: blur(32px) saturate(140%);
          backdrop-filter: blur(32px) saturate(140%);
          background: linear-gradient(
            0deg,
            rgba(var(--band), 0.97) 30%,
            rgba(var(--band), 0.82) 58%,
            rgba(var(--band), 0.45) 82%,
            rgba(var(--band), 0) 100%
          );
          -webkit-mask-image: linear-gradient(0deg, #000 80%, transparent 100%);
          mask-image: linear-gradient(0deg, #000 80%, transparent 100%);
          color: var(--bt);
          transition: color 0.4s ease;
        }
        .band-actions {
          display: flex;
          flex-direction: column;
          gap: 11px;
        }
        .abtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 54px;
          border-radius: 13px;
          font-size: 17px;
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
        .gpp-root.dark .abtn.buy {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          box-shadow: none;
        }
        .gpp-root.dark .abtn.buy:hover {
          background: rgba(255, 255, 255, 0.24);
        }
        .gpp-root.dark .bdg {
          background: rgba(255, 255, 255, 0.12);
        }
        .gpp-root.dark .bdg.rate {
          background: transparent;
          box-shadow: none;
        }
        .band-free {
          font-size: 14px;
          font-weight: 500;
          color: var(--bt2);
          text-align: center;
          margin-top: 4px;
        }
        .band-desc {
          padding-top: 3px;
        }
        .bd-text {
          font-size: 19px;
          line-height: 1.5;
          font-weight: 400;
          color: var(--bt);
          max-width: 58ch;
        }
        .bd-meta {
          font-size: 15px;
          font-weight: 500;
          color: var(--bt2);
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
          color: var(--bt2);
          background: rgba(125, 125, 135, 0.16);
          border-radius: 6px;
          padding: 4px 9px;
        }
        .bdg.rate {
          background: transparent;
          box-shadow: inset 0 0 0 1.5px var(--bt3);
        }
        .bd-trailer {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 14px;
          font-weight: 600;
          color: var(--bt);
          padding: 4px 6px;
          margin-left: 3px;
        }
        .band-cast {
          padding-top: 3px;
        }
        .bc-k {
          font-size: 13px;
          font-weight: 600;
          color: var(--bt3);
          margin-bottom: 6px;
        }
        .bc-v {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--bt);
        }
        .bc-sub {
          font-size: 15px;
          line-height: 1.45;
          color: var(--bt2);
          margin-top: 5px;
        }
        .rise {
          opacity: 0;
          transform: translateY(22px);
          animation: gpp-rise 1s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .rise.d1 {
          animation-delay: 0.15s;
        }
        .rise.d2 {
          animation-delay: 0.35s;
        }
        @keyframes gpp-rise {
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

        /* ============================================================
           COVER HERO — badge / title / desc over the art.
           ============================================================ */
        .hero {
          position: relative;
          width: 100%;
          height: 92vh;
          min-height: 540px;
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
        .hero-ph {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -64%);
          color: rgba(255, 255, 255, 0.22);
          pointer-events: none;
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
        .gpp-root.dark .hero-blend {
          opacity: 1;
        }
        .hero-eyebrow {
          position: absolute;
          top: 48px;
          left: var(--gut);
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          z-index: 4;
        }
        .hero-eyebrow .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #e0482e;
        }
        .hero-content {
          position: absolute;
          left: var(--gut);
          right: var(--gut);
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
        .hbadge {
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

        /* ============================================================
           FREE SAMPLE — designed screen, placeholder only (no add CTA).
           ============================================================ */
        .sample {
          padding: 76px var(--gut) 12px;
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
          transition: color 0.4s ease;
        }
        .sample h2 {
          font-family: var(--po);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          letter-spacing: -0.025em;
          color: var(--text);
          transition: color 0.4s ease;
        }
        .sample-sub {
          font-size: 16px;
          color: var(--text-2);
          margin-top: 10px;
          transition: color 0.4s ease;
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
        .sample-screen.playable {
          cursor: pointer;
        }
        .sample-screen.filled .ph-ambient,
        .sample-screen.filled .glass-tint,
        .sample-screen.filled .sample-glyph {
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
        .sample-glyph {
          position: relative;
          z-index: 2;
          color: rgba(255, 255, 255, 0.3);
          pointer-events: none;
        }
        .sample-play {
          position: relative;
          z-index: 2;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          color: #111;
          display: grid;
          place-items: center;
          padding-left: 4px;
          box-shadow: 0 14px 44px rgba(0, 0, 0, 0.4);
          transition: transform 0.18s;
        }
        .sample-screen.playable:hover .sample-play {
          transform: scale(1.06);
        }

        /* ============================================================
           LESSON ROWS (modules) + STRIP (episodic)
           ============================================================ */
        .lessons {
          padding: 48px var(--gut) 96px;
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
          transition: color 0.4s ease;
        }
        .row-head .mod {
          color: var(--text-2);
          font-weight: 600;
        }
        .strip-head {
          display: flex;
          align-items: baseline;
          gap: 13px;
          margin-bottom: 18px;
        }
        .strip-head .rh {
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text);
          transition: color 0.4s ease;
        }
        .strip-head .rh-meta {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-2);
          transition: color 0.4s ease;
        }

        .mod-grid {
          display: flex;
          gap: 18px;
          overflow: hidden;
          flex-wrap: wrap;
        }
        .mod-grid > :global(*) {
          flex: 0 0 calc((100% - 90px) / 6);
        }

        .strip-wrap {
          position: relative;
        }
        .strip {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          padding: 4px 2px 16px;
          scrollbar-width: none;
        }
        .strip::-webkit-scrollbar {
          display: none;
        }
        .strip > :global(*) {
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
        .gpp-root.dark .arrow {
          color: rgba(255, 255, 255, 0.55);
        }
        .gpp-root.dark .arrow:hover {
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

        /* ── free / lock chips ── */
        .lc-state {
          position: absolute;
          left: 12px;
          top: 12px;
          z-index: 3;
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
        }

        /* ── spotlight card — liquid glass until a still exists ── */
        .sp-card {
          position: relative;
          aspect-ratio: 380 / 362;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 18px rgba(0, 0, 0, 0.04);
          cursor: ${onLessonClick ? 'pointer' : 'default'};
        }
        .sp-card.filled .ph-ambient,
        .sp-card.filled .glass-tint {
          display: none;
        }
        .sp-card .photo-shade {
          background: linear-gradient(
            0deg,
            rgba(7, 8, 10, 0.92) 2%,
            rgba(7, 8, 10, 0.6) 24%,
            rgba(7, 8, 10, 0.08) 50%,
            transparent 64%
          );
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
        .sp-title {
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
        .sp-desc {
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
        .sp-foot {
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

        /* ── catalog card ── */
        .lc-catalog {
          cursor: ${onLessonClick ? 'pointer' : 'default'};
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
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04),
            0 4px 16px rgba(0, 0, 0, 0.05);
          transition: transform 0.26s cubic-bezier(0.34, 1.3, 0.64, 1),
            box-shadow 0.26s;
        }
        .lc-catalog:hover .lc-card {
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14),
            0 2px 8px rgba(0, 0, 0, 0.06);
        }
        .lc-thumb {
          position: relative;
          flex: 0 0 auto;
          aspect-ratio: 380 / 214;
          background: #111111;
          overflow: hidden;
        }
        .lc-thumb.ph {
          background: none;
        }
        .lc-thumb.filled .ph-ambient,
        .lc-thumb.filled .glass-tint {
          display: none;
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

        @media (max-width: 1380px) {
          .mod-grid > :global(*) {
            flex: 0 0 calc((100% - 72px) / 5);
          }
        }
        @media (max-width: 1200px) {
          .gpp-root {
            --gut: 44px;
          }
          .band {
            grid-template-columns: 300px minmax(0, 1fr);
            gap: 40px;
          }
          .band-cast {
            display: none;
          }
          .strip > :global(*) {
            flex-basis: calc((100% - 40px) / 3);
          }
        }
        @media (max-width: 1100px) {
          .mod-grid > :global(*) {
            flex: 0 0 calc((100% - 54px) / 4);
          }
          .lessons {
            padding: 40px 40px 72px;
          }
        }
        @media (max-width: 820px) {
          .gpp-root {
            --gut: 22px;
          }
          .panel-title {
            bottom: 270px;
          }
          .band {
            grid-template-columns: 1fr;
            gap: 20px;
            padding-bottom: 32px;
          }
          .band-desc {
            display: none;
          }
          .strip > :global(*) {
            flex-basis: calc((100% - 20px) / 2);
          }
          .hero-eyebrow {
            top: 30px;
          }
          .hero-content {
            bottom: 36px;
          }
          .hero-actions {
            flex-wrap: wrap;
          }
        }
        @media (max-width: 760px) {
          .mod-grid > :global(*) {
            flex: 0 0 calc((100% - 18px) / 2);
          }
          .lessons {
            padding: 28px 20px 56px;
          }
          .sample {
            padding: 48px 20px 8px;
          }
        }
      `}</style>
    </div>
  )
}

export default GeneratedPortalPage
