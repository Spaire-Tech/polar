'use client'

// CoverHero — literal port of the "Cover" hero design (Hero B.html, "The Art
// of Persuasive Writing"). The design ships as React with inline styles; this
// is that source carried over nearly verbatim:
//   • a light-gray page frame (oklch(0.95 0.003 280)) centering ONE boxed
//     cinematic hero (max-width 1280, min(88vh, 900px), radius 28, hairline
//     border + soft shadow)
//   • backdrop photo at object-position 60% 22% with a soft-light warm grade
//     (hue 35) and the bottom vignette
//   • SPAIRE ORIGINAL tag top-left (glowing dot), NEW SERIES meta row,
//     balance-wrapped display title, tagline with the dimmed "— with" byline
//   • CTAs: white "Watch trailer" pill with a dark play circle, and the
//     frosted "Enroll · $79 →" glass pill
// Content defaults to the design sample so it clones exactly; the photo is
// self-hosted (CSP'self') — extracted from the design bundle itself.

const VARS = {
  bg3: 'oklch(0.95 0.003 280)',
  line: 'oklch(0.92 0.003 280)',
  fg0: 'oklch(0.18 0.008 280)',
  radiusXl: 28,
}

const heroV2Styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 1280,
    height: 'min(88vh, 900px)',
    minHeight: 620,
    margin: '0 auto',
    borderRadius: VARS.radiusXl,
    overflow: 'hidden',
    background: '#000',
    isolation: 'isolate',
    border: `1px solid ${VARS.line}`,
    boxShadow: '0 2px 6px oklch(0 0 0 / 0.06), 0 24px 60px oklch(0 0 0 / 0.10)',
  },
  backdrop: { position: 'absolute', inset: 0 },
  vignette: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0) 30%, oklch(0 0 0 / 0) 45%, oklch(0 0 0 / 0.6) 80%, oklch(0 0 0 / 0.92) 100%)',
    pointerEvents: 'none',
  },
  topTag: {
    position: 'absolute',
    left: 48,
    top: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    letterSpacing: '0.18em',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.80)',
  },
  topTagDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'oklch(0.72 0.16 25)',
    boxShadow: '0 0 10px oklch(0.72 0.16 25)',
    display: 'block',
  },
  contentWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '40px 48px 52px',
    color: 'white',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: 500,
  },
  metaPill: {
    padding: '3px 10px',
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.18)',
    fontSize: 10,
    letterSpacing: '0.12em',
    fontWeight: 600,
    color: 'white',
  },
  metaText: { color: 'rgba(255,255,255,0.60)' },
  metaDot: { color: 'rgba(255,255,255,0.3)' },
  title: {
    fontSize: 'clamp(52px, 7.5vw, 96px)',
    fontWeight: 700,
    letterSpacing: '-0.045em',
    lineHeight: 0.95,
    margin: '0 0 18px',
    color: 'white',
    maxWidth: '14ch',
    textWrap: 'balance' as React.CSSProperties['textWrap'],
    textShadow: '0 2px 30px oklch(0 0 0 / 0.35)',
  },
  tagline: {
    fontSize: 'clamp(14px, 1.3vw, 18px)',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 600,
    marginBottom: 30,
    letterSpacing: '-0.005em',
    lineHeight: 1.5,
  },
  taglineDim: { color: 'rgba(255,255,255,0.50)' },
  bottomRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  ctas: { display: 'flex', alignItems: 'center', gap: 10 },
  ctaPlay: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '13px 22px 13px 14px',
    background: 'white',
    color: 'oklch(0.14 0.006 280)',
    borderRadius: 999,
    boxShadow: '0 8px 28px oklch(0 0 0 / 0.4)',
    transition: 'transform 150ms ease, opacity 150ms ease',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ctaPlayIcon: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'oklch(0.14 0.006 280)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
    flexShrink: 0,
  },
  ctaPlayLabel: { fontSize: 14, fontWeight: 600, lineHeight: 1 },
  ctaEnroll: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 22px',
    background: 'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'white',
    borderRadius: 999,
    fontSize: 13.5,
    fontWeight: 600,
    transition: 'background 150ms ease',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}

const IconPlay = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const IconArrowRight = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

export type CoverHeroProps = {
  title?: string
  tagline?: string
  withByline?: string
  metaPill?: string
  lessonsLabel?: string
  durationLabel?: string
  levelLabel?: string
  enrollLabel?: string
  trailerLabel?: string
  imageUrl?: string | null
  imageObjectPosition?: string
  /** Warm soft-light grade hue from the design (heroHue). */
  heroHue?: number
  onWatchTrailer?: () => void
  onEnroll?: () => void
}

export function CoverHero({
  title = 'The Art of Persuasive Writing',
  tagline = 'Build arguments that move people. A working novelist and former litigator takes you inside the craft of persuasion — the structures, the sentences, and the habit of mind behind writing that changes how people think.',
  withByline = 'Dr. Lena Marchetti',
  metaPill = 'NEW SERIES',
  lessonsLabel = '22 lessons',
  durationLabel = '4 hr 12 min',
  levelLabel = 'All levels',
  enrollLabel = 'Enroll · $79',
  trailerLabel = 'Watch trailer',
  imageUrl = '/assets/onboarding/cover-lena.jpg',
  imageObjectPosition = '60% 22%',
  heroHue = 35,
  onWatchTrailer,
  onEnroll,
}: CoverHeroProps = {}) {
  return (
    <section style={heroV2Styles.wrap}>
      {/* Full-bleed cinematic backdrop */}
      <div style={heroV2Styles.backdrop}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            background: '#0a0807',
          }}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={withByline}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: imageObjectPosition,
              }}
            />
          )}
          {/* Subtle warm grade to seat the photo into the brand hue */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              mixBlendMode: 'soft-light',
              background: `linear-gradient(120deg, oklch(0.45 0.12 ${heroHue} / 0.5) 0%, transparent 55%)`,
              pointerEvents: 'none',
            }}
          />
        </div>
        <div style={heroV2Styles.vignette} />
      </div>

      {/* Top-left tag */}
      <div style={heroV2Styles.topTag}>
        <span style={heroV2Styles.topTagDot} />
        <span>SPAIRE ORIGINAL</span>
      </div>

      {/* Bottom content overlay */}
      <div style={heroV2Styles.contentWrap}>
        <div style={heroV2Styles.metaRow}>
          <span style={heroV2Styles.metaPill}>{metaPill}</span>
          <span style={heroV2Styles.metaText}>{lessonsLabel}</span>
          <span style={heroV2Styles.metaDot}>·</span>
          <span style={heroV2Styles.metaText}>{durationLabel}</span>
          <span style={heroV2Styles.metaDot}>·</span>
          <span style={heroV2Styles.metaText}>{levelLabel}</span>
        </div>

        <h1 style={heroV2Styles.title}>{title}</h1>

        <div style={heroV2Styles.tagline}>
          {tagline}
          {withByline && (
            <span style={heroV2Styles.taglineDim}> — with {withByline}</span>
          )}
        </div>

        <div style={heroV2Styles.bottomRow}>
          <div style={heroV2Styles.ctas}>
            <button
              type="button"
              style={heroV2Styles.ctaPlay}
              onClick={onWatchTrailer}
            >
              <span style={heroV2Styles.ctaPlayIcon}>
                <IconPlay size={14} />
              </span>
              <span style={heroV2Styles.ctaPlayLabel}>{trailerLabel}</span>
            </button>
            <button
              type="button"
              style={heroV2Styles.ctaEnroll}
              onClick={onEnroll}
            >
              <span>{enrollLabel}</span>
              <IconArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Hero-only assembly — the design's LandingApp frame: light-gray page that
// centers the boxed hero with 24px breathing room.
export function CoverHeroPage(props: CoverHeroProps = {}) {
  return (
    <div
      data-screen-label="Spaire Hero"
      style={{
        background: VARS.bg3,
        minHeight: '100vh',
        color: VARS.fg0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Poppins', var(--font-poppins), system-ui, sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        letterSpacing: '-0.005em',
      }}
    >
      <CoverHero {...props} />
    </div>
  )
}

export default CoverHero
