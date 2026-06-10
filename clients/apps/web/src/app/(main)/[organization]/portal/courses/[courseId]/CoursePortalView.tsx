'use client'

import type {
  CustomerCourseDetail,
  CustomerLessonRead,
  CustomerModuleRead,
} from '@/hooks/queries/courses'
import { useIsMobile } from '@/utils/mobile'
import { useState } from 'react'

const FONT = "'Poppins', var(--font-poppins), system-ui, sans-serif"

// ── Theme tokens (mirrors the design's :root variables) ────────────────────
const C = {
  bg0: '#ffffff',
  bg2: 'oklch(0.975 0.002 280)',
  bg3: 'oklch(0.95 0.003 280)',
  line: 'oklch(0.92 0.003 280)',
  fg0: 'oklch(0.18 0.008 280)',
  fg1: 'oklch(0.32 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  accent: 'oklch(0.55 0.20 265)',
  accent2: 'oklch(0.62 0.16 285)',
  radiusXl: 28,
}

// Stable "module color" derived from index so each module row has its own hue
// across the page, mirroring the design's per-module hues.
const MODULE_HUES = [35, 195, 285, 145, 25, 320, 75, 245]
const moduleHue = (index: number): number =>
  MODULE_HUES[index % MODULE_HUES.length]!

const formatHrMin = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return '—'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}

const formatMinSec = (seconds: number | null | undefined): string => {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

// ── Inline SVG icons (stroke = currentColor) ───────────────────────────────
const SvgIcon = ({
  size = 18,
  fill = 'none',
  sw = 1.75,
  children,
  style,
}: {
  size?: number
  fill?: string
  sw?: number
  children: React.ReactNode
  style?: React.CSSProperties
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
)
const IconPlay = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)
const IconBookmark = ({ size = 15 }: { size?: number }) => (
  <SvgIcon size={size}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </SvgIcon>
)
const IconMore = ({ size = 15 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </SvgIcon>
)
const IconCheck = ({ size = 11 }: { size?: number }) => (
  <SvgIcon size={size} sw={2.4}>
    <path d="M20 6 9 17l-5-5" />
  </SvgIcon>
)
const IconChevronRight = ({
  size = 18,
  style,
}: {
  size?: number
  style?: React.CSSProperties
}) => (
  <SvgIcon size={size} style={style}>
    <path d="m9 18 6-6-6-6" />
  </SvgIcon>
)
const IconClock = ({ size = 10 }: { size?: number }) => (
  <SvgIcon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </SvgIcon>
)
const IconLock = ({ size = 16 }: { size?: number }) => (
  <SvgIcon size={size}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </SvgIcon>
)
// ── Helper: figure out which lesson to "Continue" with ─────────────────────
type ContinueState =
  | {
      kind: 'continue' | 'replay' | 'start'
      module: CustomerModuleRead
      lesson: CustomerLessonRead
      moduleIndex: number
    }
  | { kind: 'complete' }
  | null

function pickContinueLesson(modules: CustomerModuleRead[]): ContinueState {
  let firstAccessible: {
    module: CustomerModuleRead
    lesson: CustomerLessonRead
    moduleIndex: number
  } | null = null
  let totalAccessible = 0
  let totalCompleted = 0

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!
    if (m.locked) continue
    for (const lesson of m.lessons) {
      if (lesson.locked) continue
      totalAccessible += 1
      if (lesson.completed) {
        totalCompleted += 1
        continue
      }
      if (!firstAccessible) {
        firstAccessible = { module: m, lesson, moduleIndex: i }
      }
    }
  }

  // Found an unwatched accessible lesson — that's where Continue points.
  if (firstAccessible) {
    const isStart = totalCompleted === 0
    return { ...firstAccessible, kind: isStart ? 'start' : 'continue' }
  }

  // Every accessible lesson is complete → course done.
  if (totalAccessible > 0 && totalCompleted === totalAccessible) {
    return { kind: 'complete' }
  }

  // Nothing accessible (everything locked behind paywall/drip).
  return null
}

// ── Styles (translated 1:1 from the design) ────────────────────────────────
const heroStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    height: 'min(88vh, 760px)',
    minHeight: 600,
    margin: '20px 20px 0',
    borderRadius: C.radiusXl,
    overflow: 'hidden',
    background: '#000',
    isolation: 'isolate',
    border: `1px solid ${C.line}`,
    boxShadow:
      '0 2px 6px oklch(0 0 0 / 0.06), 0 24px 60px oklch(0 0 0 / 0.10)',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0) 30%, oklch(0 0 0 / 0) 35%, oklch(0 0 0 / 0.7) 75%, oklch(0 0 0 / 0.95) 100%)',
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
  topRight: {
    position: 'absolute',
    right: 48,
    top: 32,
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  progressLabel: {
    fontSize: 10.5,
    letterSpacing: '0.18em',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  },
  contentWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '40px 48px 44px',
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
    fontSize: 'clamp(48px, 7vw, 88px)',
    fontWeight: 700,
    letterSpacing: '-0.045em',
    lineHeight: 0.95,
    margin: '0 0 16px',
    color: 'white',
    maxWidth: '14ch',
    textShadow: '0 2px 30px oklch(0 0 0 / 0.35)',
  },
  tagline: {
    fontSize: 'clamp(14px, 1.3vw, 17px)',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.85)',
    maxWidth: 560,
    marginBottom: 28,
    letterSpacing: '-0.005em',
    lineHeight: 1.4,
  },
  taglineDim: { color: 'rgba(255,255,255,0.50)' },
  continueRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 32,
    flexWrap: 'wrap',
  },
  continueInfo: { flex: '1 1 360px', maxWidth: 540 },
  continueLabel: {
    fontSize: 10,
    letterSpacing: '0.16em',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
  },
  continueTitle: {
    fontSize: 19,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: 'white',
    marginBottom: 5,
    lineHeight: 1.2,
  },
  continueMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 12,
  },
  progressBar: {
    position: 'relative',
    height: 4,
    background: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: 460,
  },
  progressFill: {
    height: '100%',
    background: 'white',
    borderRadius: 999,
  },
  ctas: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
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
    fontFamily: FONT,
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
  ctaGhost: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.10)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: 'white',
    borderRadius: '50%',
    cursor: 'pointer',
    fontFamily: FONT,
  },
}

const modStyles: Record<string, React.CSSProperties> = {
  wrap: {
    background: C.bg0,
    color: C.fg0,
    padding: '56px 32px 80px',
    maxWidth: 1320,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 44,
  },
  row: { display: 'flex', flexDirection: 'column', gap: 14 },
  rowHeader: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: 0,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT,
    textAlign: 'left',
    color: C.fg0,
    alignSelf: 'flex-start',
  },
  rowTitle: {
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.025em',
    margin: 0,
    color: C.fg0,
    lineHeight: 1.1,
  },
  rowCount: {
    marginLeft: 12,
    fontSize: 12,
    color: C.fg3,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  rowDone: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: C.fg1,
  },
  rowProg: { color: 'oklch(0.55 0.18 25)' },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 18,
  },
}

const lessonStyles: Record<string, React.CSSProperties> = {
  // Card surface — mirrors the landing "Free preview" episode cards.
  card: {
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    background: C.bg0,
    border: `1px solid ${C.line}`,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'left',
    padding: 0,
    fontFamily: FONT,
    color: 'inherit',
    // Apple TV-style pop: faster transform spring + slower shadow ease,
    // so the card lifts crisply while the glow blooms behind it. Hint
    // the compositor to keep the animation buttery.
    transition:
      'transform 320ms cubic-bezier(0.22, 1.4, 0.36, 1), box-shadow 360ms cubic-bezier(0.22, 1, 0.36, 1)',
    transform: 'translateY(0) scale(1)',
    willChange: 'transform',
    transformOrigin: 'center center',
    boxShadow:
      '0 1px 2px oklch(0 0 0 / 0.04), 0 4px 16px oklch(0 0 0 / 0.05)',
    position: 'relative',
    zIndex: 1,
  },
  cardHover: {
    transform: 'translateY(-6px) scale(1.06)',
    boxShadow:
      '0 28px 64px oklch(0 0 0 / 0.22), 0 12px 28px oklch(0 0 0 / 0.12), 0 2px 6px oklch(0 0 0 / 0.06)',
    zIndex: 2,
  },
  thumb: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    background: '#111',
    overflow: 'hidden',
    flexShrink: 0,
  },
  watchedDim: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.30)',
  },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 200ms ease',
  },
  playBtn: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.95)',
    color: C.fg0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  // Episode-number badge, top-left of thumb (like the landing).
  epBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.10em',
    color: 'rgba(255,255,255,0.80)',
    background: 'rgba(0,0,0,0.40)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    padding: '3px 7px',
    borderRadius: 4,
    zIndex: 2,
  },
  // Watched pill replaces the EPISODE badge top-left when complete.
  watchedPill: {
    position: 'absolute',
    left: 10,
    top: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#fff',
    color: '#000',
    padding: '3px 9px 3px 7px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    zIndex: 2,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  durBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(0,0,0,0.50)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    padding: '3px 8px',
    borderRadius: 5,
    zIndex: 2,
  },
  lockOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    zIndex: 2,
  },
  // Padded info block under the thumbnail.
  info: { padding: '16px 18px 18px' },
  epLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: C.fg3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15.5,
    fontWeight: 600,
    letterSpacing: '-0.015em',
    color: C.fg0,
    lineHeight: 1.25,
    marginBottom: 7,
  },
  desc: {
    fontSize: 12.5,
    color: C.fg2,
    lineHeight: 1.6,
    marginBottom: 10,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  metaLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    color: C.fg3,
    fontVariantNumeric: 'tabular-nums',
  },
}

// ── Components ─────────────────────────────────────────────────────────────

function HeroBackdrop({
  hue,
  thumbnailUrl,
  thumbnailObjectPosition,
}: {
  hue: number
  thumbnailUrl: string | null
  thumbnailObjectPosition: string | null
}) {
  if (thumbnailUrl) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: thumbnailObjectPosition ?? 'center',
          }}
        />
      </div>
    )
  }
  // Procedural placeholder backdrop, identical to the design's HeroBackdrop.
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 25% 35%, oklch(0.45 0.12 ${hue}) 0%, oklch(0.18 0.05 ${(hue + 20) % 360}) 55%, oklch(0.06 0.01 280) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '8%',
          top: '0%',
          width: '45%',
          height: '70%',
          background:
            'radial-gradient(ellipse, oklch(0.88 0.08 75 / 0.30) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-5%',
          top: '20%',
          width: '40%',
          height: '60%',
          background: `radial-gradient(circle, oklch(0.50 0.14 ${(hue + 40) % 360} / 0.22) 0%, transparent 70%)`,
          filter: 'blur(50px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '38%',
          height: '78%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            width: '32%',
            aspectRatio: '1',
            background: `linear-gradient(180deg, oklch(0.50 0.06 ${hue}), oklch(0.32 0.04 ${hue}))`,
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '72%',
            background: `linear-gradient(180deg, oklch(0.30 0.04 ${hue}), oklch(0.12 0.02 ${hue}))`,
            clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0% 100%)',
            borderRadius: '46% 46% 0 0',
          }}
        />
      </div>
    </div>
  )
}

function Hero({
  data,
  totalLessons,
  totalDurationSeconds,
  overallPct,
  continueLesson,
  continueModuleTitle,
  continueLessonNumber,
  continuePill,
  instructorName,
  tagline,
  heroHue,
  onResume,
}: {
  data: CustomerCourseDetail
  totalLessons: number
  totalDurationSeconds: number
  overallPct: number
  continueLesson: CustomerLessonRead | null
  continueModuleTitle: string | null
  continueLessonNumber: number | null
  continuePill: string | null
  instructorName: string | null
  tagline: string
  heroHue: number
  onResume: () => void
}) {
  const course = data.course
  // We don't yet track partial watch progress, so "remaining" is just the
  // full lesson duration when present.
  const remainingMin = continueLesson?.duration_seconds
    ? Math.max(1, Math.ceil(continueLesson.duration_seconds / 60))
    : null

  return (
    <section style={heroStyles.wrap}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <HeroBackdrop
          hue={heroHue}
          thumbnailUrl={course.thumbnail_url ?? null}
          thumbnailObjectPosition={course.thumbnail_object_position ?? null}
        />
        <div style={heroStyles.vignette} />
      </div>

      <div style={heroStyles.topTag}>
        <span style={heroStyles.topTagDot} />
        <span>SPAIRE ORIGINAL</span>
      </div>

      <div style={heroStyles.topRight}>
        <span style={heroStyles.progressLabel}>YOUR PROGRESS</span>
        <span style={heroStyles.progressValue}>{overallPct}%</span>
      </div>

      <div style={heroStyles.contentWrap}>
        <div style={heroStyles.metaRow}>
          <span style={heroStyles.metaPill}>
            {continuePill ?? 'START LEARNING'}
          </span>
          <span style={heroStyles.metaText}>{totalLessons} lessons</span>
          <span style={heroStyles.metaDot}>·</span>
          <span style={heroStyles.metaText}>
            {formatHrMin(totalDurationSeconds)}
          </span>
          <span style={heroStyles.metaDot}>·</span>
          <span style={heroStyles.metaText}>All levels</span>
        </div>

        <h1 style={heroStyles.title}>{course.title ?? 'Course'}</h1>

        <div style={heroStyles.tagline}>
          {tagline}
          {instructorName ? (
            <span style={heroStyles.taglineDim}>
              {' '}
              — with {instructorName}
            </span>
          ) : null}
        </div>

        <div style={heroStyles.continueRow}>
          {continueLesson ? (
            <div style={heroStyles.continueInfo}>
              <div style={heroStyles.continueLabel}>
                UP NEXT · LESSON {continueLessonNumber}
              </div>
              <div style={heroStyles.continueTitle}>{continueLesson.title}</div>
              <div style={heroStyles.continueMeta}>
                {continueModuleTitle && <span>{continueModuleTitle}</span>}
                {continueModuleTitle && remainingMin !== null && (
                  <span style={heroStyles.metaDot}>·</span>
                )}
                {remainingMin !== null && <span>{remainingMin} min</span>}
              </div>
            </div>
          ) : (
            <div style={heroStyles.continueInfo} />
          )}

          <div style={heroStyles.ctas}>
            <button
              type="button"
              style={heroStyles.ctaPlay}
              onClick={onResume}
              disabled={
                !continueLesson && continuePill !== 'COURSE COMPLETE'
              }
            >
              <span style={heroStyles.ctaPlayIcon}>
                <IconPlay size={14} />
              </span>
              <span style={heroStyles.ctaPlayLabel}>
                {continuePill === 'COURSE COMPLETE'
                  ? 'Replay course'
                  : continueLesson
                    ? `Play lesson ${continueLessonNumber}`
                    : 'Start course'}
              </span>
            </button>
            <button type="button" style={heroStyles.ctaGhost} title="My List">
              <IconBookmark size={15} />
            </button>
            <button
              type="button"
              style={heroStyles.ctaGhost}
              title="Course details"
            >
              <IconMore size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function LessonThumb({
  hue,
  thumbnailUrl,
  thumbnailObjectPosition,
  muxPlaybackId,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
}: {
  hue: number
  thumbnailUrl: string | null
  thumbnailObjectPosition: string | null
  muxPlaybackId?: string | null
  fallbackThumbnailUrl?: string | null
  fallbackObjectPosition?: string | null
}) {
  // Prefer the lesson's own thumbnail, then a Mux-derived still, then the
  // course thumbnail so every card shows real imagery instead of the
  // procedural placeholder.
  const usingFallback = !thumbnailUrl && !muxPlaybackId && !!fallbackThumbnailUrl
  const src =
    thumbnailUrl ||
    (muxPlaybackId
      ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=1`
      : null) ||
    fallbackThumbnailUrl ||
    null
  const position = usingFallback
    ? (fallbackObjectPosition ?? '50% 50%')
    : (thumbnailObjectPosition ?? '50% 50%')

  if (src) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: position,
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 30% 40%, oklch(0.42 0.10 ${hue}) 0%, oklch(0.18 0.05 ${(hue + 25) % 360}) 55%, oklch(0.07 0.01 280) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '5%',
          width: '50%',
          height: '70%',
          background:
            'radial-gradient(ellipse, oklch(0.85 0.07 75 / 0.22) 0%, transparent 65%)',
          filter: 'blur(24px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '55%',
          height: '80%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            width: '36%',
            aspectRatio: '1',
            background: `linear-gradient(180deg, oklch(0.48 0.05 ${hue}), oklch(0.28 0.03 ${hue}))`,
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '68%',
            background: `linear-gradient(180deg, oklch(0.26 0.04 ${hue}), oklch(0.10 0.02 ${hue}))`,
            clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0% 100%)',
            borderRadius: '40% 40% 0 0',
          }}
        />
      </div>
    </div>
  )
}

export function LessonCard({
  lesson,
  globalIndex,
  hue,
  isInProgress,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
  onSelect,
}: {
  lesson: CustomerLessonRead
  globalIndex: number
  hue: number
  isInProgress: boolean
  fallbackThumbnailUrl: string | null
  fallbackObjectPosition: string | null
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isWatched = lesson.completed
  const isLocked = !!lesson.locked

  return (
    <button
      type="button"
      style={{
        ...lessonStyles.card,
        ...(hovered && !isLocked ? lessonStyles.cardHover : null),
        cursor: isLocked ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !isLocked && onSelect()}
      disabled={isLocked}
    >
      <div style={lessonStyles.thumb}>
        <LessonThumb
          hue={hue}
          thumbnailUrl={lesson.thumbnail_url ?? null}
          thumbnailObjectPosition={lesson.thumbnail_object_position ?? null}
          muxPlaybackId={lesson.mux_playback_id ?? null}
          fallbackThumbnailUrl={fallbackThumbnailUrl}
          fallbackObjectPosition={fallbackObjectPosition}
        />

        {isWatched && <div style={lessonStyles.watchedDim} />}

        {!isLocked && (
          <div
            style={{
              ...lessonStyles.playOverlay,
              opacity: hovered ? 1 : 0,
            }}
          >
            <div style={lessonStyles.playBtn}>
              <IconPlay size={20} />
            </div>
          </div>
        )}

        {/* Top-left badge: WATCHED if completed (even when locked), else
            the lesson number — always shown so locked cards still
            communicate their position in the sequence. */}
        {isWatched ? (
          <div style={lessonStyles.watchedPill}>
            <IconCheck size={10} />
            <span>Watched</span>
          </div>
        ) : (
          <div style={lessonStyles.epBadge}>LESSON {globalIndex}</div>
        )}

        {/* Bottom-right duration badge — show even on locked cards so
            customers know how long the lesson runs before unlocking. */}
        {lesson.duration_seconds ? (
          <div style={lessonStyles.durBadge}>
            <IconClock size={10} />
            <span>{formatMinSec(lesson.duration_seconds)}</span>
          </div>
        ) : null}

        {isLocked && (
          <div style={lessonStyles.lockOverlay}>
            <IconLock size={26} />
          </div>
        )}
      </div>

      <div style={lessonStyles.info}>
        <div style={lessonStyles.epLabel}>Lesson {globalIndex}</div>
        <div style={lessonStyles.title}>{lesson.title}</div>
        {lesson.description ? (
          <div style={lessonStyles.desc}>{lesson.description}</div>
        ) : null}
        <div style={lessonStyles.metaLine}>
          {lesson.duration_seconds ? (
            <>
              <IconClock size={12} />
              <span>{formatMinSec(lesson.duration_seconds)}</span>
            </>
          ) : null}
          {isInProgress && (
            <span
              style={{
                color: 'oklch(0.55 0.18 25)',
                fontWeight: 600,
                marginLeft: 6,
              }}
            >
              · Up next
            </span>
          )}
          {isLocked && lesson.locked_until && (
            <span style={{ color: '#fb923c', marginLeft: 6 }}>
              · Unlocks{' '}
              {new Date(lesson.locked_until).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function ModuleRow({
  module,
  moduleIndex,
  positionToGlobalIndex,
  inProgressLessonId,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
  onSelectLesson,
}: {
  module: CustomerModuleRead
  moduleIndex: number
  positionToGlobalIndex: Map<string, number>
  inProgressLessonId: string | null
  fallbackThumbnailUrl: string | null
  fallbackObjectPosition: string | null
  onSelectLesson: (lesson: CustomerLessonRead) => void
}) {
  const hue = moduleHue(moduleIndex)
  const watched = module.lessons.filter((l) => l.completed).length
  const total = module.lessons.length
  const allDone = total > 0 && watched === total
  const inProg = module.lessons.some(
    (l) => !l.completed && l.id === inProgressLessonId,
  )

  return (
    <div style={modStyles.row}>
      <div style={modStyles.rowHeader}>
        <h2 style={modStyles.rowTitle}>{module.title}</h2>
        <IconChevronRight size={18} style={{ color: C.fg1 }} />
        <span style={modStyles.rowCount}>
          {allDone ? (
            <span style={modStyles.rowDone}>
              <IconCheck size={11} /> Complete
            </span>
          ) : inProg ? (
            <span style={modStyles.rowProg}>
              In progress · {watched}/{total}
            </span>
          ) : (
            <span>
              {watched}/{total} watched
            </span>
          )}
        </span>
      </div>

      <div style={modStyles.rowGrid}>
        {module.lessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            globalIndex={positionToGlobalIndex.get(lesson.id) ?? lesson.position}
            hue={hue}
            isInProgress={lesson.id === inProgressLessonId}
            fallbackThumbnailUrl={fallbackThumbnailUrl}
            fallbackObjectPosition={fallbackObjectPosition}
            onSelect={() => onSelectLesson(lesson)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export interface CoursePortalViewProps {
  data: CustomerCourseDetail
  organizationName: string
  onSelectLesson: (lesson: CustomerLessonRead) => void
}

export function CoursePortalView(props: CoursePortalViewProps) {
  const { isMobile } = useIsMobile()
  // The mobile layout is structurally different (vertical hero, horizontal-
  // scroll module rows, larger touch targets) so we render a dedicated
  // component instead of trying to collapse the desktop layout via CSS.
  if (isMobile) return <CoursePortalViewMobile {...props} />
  return <CoursePortalViewDesktop {...props} />
}

function CoursePortalViewDesktop({
  data,
  organizationName,
  onSelectLesson,
}: CoursePortalViewProps) {
  const course = data.course
  const modules: CustomerModuleRead[] = course.modules

  // Build a position-by-id map so each lesson card can render its global
  // "LESSON N" label even when the modules are presented separately.
  const positionToGlobalIndex = new Map<string, number>()
  let runningIndex = 0
  for (const m of modules) {
    for (const lesson of m.lessons) {
      runningIndex += 1
      positionToGlobalIndex.set(lesson.id, runningIndex)
    }
  }

  const totalDurationSeconds = modules.reduce(
    (acc, m) =>
      acc +
      m.lessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0),
    0,
  )

  const totalLessons = data.progress.total_lessons
  const overallPct = Math.round(data.progress.completion_percent)

  const cont = pickContinueLesson(modules)
  const courseComplete = cont?.kind === 'complete'
  const continueLesson =
    cont && cont.kind !== 'complete' ? cont.lesson : null
  const continueModuleTitle =
    cont && cont.kind !== 'complete' ? cont.module.title : null
  const continueLessonNumber = continueLesson
    ? (positionToGlobalIndex.get(continueLesson.id) ?? null)
    : null
  const continuePill =
    cont?.kind === 'complete'
      ? 'COURSE COMPLETE'
      : cont?.kind === 'start'
        ? 'START LEARNING'
        : cont?.kind === 'continue'
          ? 'CONTINUE WATCHING'
          : null

  const inProgressLessonId =
    continueLesson && !continueLesson.completed ? continueLesson.id : null

  // Tagline: prefer the AI landing tagline if present, otherwise fall back to
  // the course's plain description (truncated). This way the cinematic hero
  // surfaces the "actual" landing copy as requested.
  const aiLanding = (course.landing_overrides?.ai_landing ?? null) as
    | { tagline?: string; eyebrow?: string }
    | null
  const tagline =
    (aiLanding?.tagline && aiLanding.tagline.trim()) ||
    (course.description ? course.description.split('\n')[0]! : '') ||
    'Your purchased course.'

  const heroHue = moduleHue(0)

  return (
    <div
      data-screen-label="Spaire Course Portal"
      style={{
        background: C.bg0,
        minHeight: '100vh',
        color: C.fg0,
        fontFamily: FONT,
      }}
    >
      <Hero
        data={data}
        totalLessons={totalLessons}
        totalDurationSeconds={totalDurationSeconds}
        overallPct={overallPct}
        continueLesson={continueLesson}
        continueModuleTitle={continueModuleTitle}
        continueLessonNumber={continueLessonNumber}
        continuePill={continuePill}
        instructorName={course.instructor_name ?? null}
        tagline={tagline}
        heroHue={heroHue}
        onResume={() => {
          if (continueLesson) onSelectLesson(continueLesson)
          else if (courseComplete && modules[0]?.lessons[0])
            onSelectLesson(modules[0].lessons[0])
        }}
      />

      <section style={modStyles.wrap}>
        {modules.map((m, i) => (
          <ModuleRow
            key={m.id}
            module={m}
            moduleIndex={i}
            positionToGlobalIndex={positionToGlobalIndex}
            inProgressLessonId={inProgressLessonId}
            fallbackThumbnailUrl={course.thumbnail_url ?? null}
            fallbackObjectPosition={course.thumbnail_object_position ?? null}
            onSelectLesson={onSelectLesson}
          />
        ))}
      </section>

      <footer
        style={{
          padding: '40px 32px',
          maxWidth: 1320,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 24,
            borderTop: `1px solid ${C.line}`,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: C.fg0,
              }}
            >
              Spaire
            </span>
            <span style={{ fontSize: 11.5, color: C.fg3 }}>
              {organizationName}
            </span>
          </div>
          <span style={{ fontSize: 12, color: C.fg3 }}>
            Premium courses, sold by creators.
          </span>
        </div>
      </footer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Mobile layout (≤ 720px)
// ────────────────────────────────────────────────────────────────────────────
//
// Mirrors the Spaire Course Portal Mobile design hand-off:
//
//   • Vertical cinematic hero with eyebrow + progress %, big title,
//     tagline + instructor, "Up Next" mini-card, Resume + bookmark CTA
//   • Per-module rows with horizontal scroll-snap lesson cards (16:9 thumb
//     + duration pill + completion check / in-progress bar)
//   • Plain footer (no inner tab bar — the global `MobileTabBar` from
//     PortalShell handles cross-portal navigation)
//
// All data flows through the same `CustomerCourseDetail` the desktop view
// uses; helpers (HeroBackdrop, LessonThumb, formatHrMin, pickContinueLesson,
// moduleHue, icons) are reused above to keep the two layouts in sync.

function CoursePortalViewMobile({
  data,
  organizationName,
  onSelectLesson,
}: CoursePortalViewProps) {
  const course = data.course
  const modules: CustomerModuleRead[] = course.modules

  const positionToGlobalIndex = new Map<string, number>()
  let runningIndex = 0
  for (const m of modules) {
    for (const lesson of m.lessons) {
      runningIndex += 1
      positionToGlobalIndex.set(lesson.id, runningIndex)
    }
  }

  const totalDurationSeconds = modules.reduce(
    (acc, m) =>
      acc + m.lessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0),
    0,
  )
  const totalLessons = data.progress.total_lessons
  const overallPct = Math.round(data.progress.completion_percent)

  const cont = pickContinueLesson(modules)
  const courseComplete = cont?.kind === 'complete'
  const continueLesson = cont && cont.kind !== 'complete' ? cont.lesson : null
  const continueModuleTitle =
    cont && cont.kind !== 'complete' ? cont.module.title : null
  const continueLessonNumber = continueLesson
    ? (positionToGlobalIndex.get(continueLesson.id) ?? null)
    : null
  const continuePill =
    cont?.kind === 'complete'
      ? 'COURSE COMPLETE'
      : cont?.kind === 'start'
        ? 'START LEARNING'
        : cont?.kind === 'continue'
          ? 'CONTINUE WATCHING'
          : null

  const aiLanding = (course.landing_overrides?.ai_landing ?? null) as
    | { tagline?: string }
    | null
  const tagline =
    (aiLanding?.tagline && aiLanding.tagline.trim()) ||
    (course.description ? course.description.split('\n')[0]! : '') ||
    'Your purchased course.'

  const heroHue = moduleHue(0)

  return (
    <div
      data-screen-label="Spaire Course Portal (Mobile)"
      style={{
        background: C.bg0,
        color: C.fg0,
        fontFamily: FONT,
      }}
    >
      <MobileHero
        course={course}
        heroHue={heroHue}
        overallPct={overallPct}
        totalLessons={totalLessons}
        totalDurationSeconds={totalDurationSeconds}
        continueLesson={continueLesson}
        continueModuleTitle={continueModuleTitle}
        continueLessonNumber={continueLessonNumber}
        continuePill={continuePill}
        tagline={tagline}
        onResume={() => {
          if (continueLesson) onSelectLesson(continueLesson)
          else if (courseComplete && modules[0]?.lessons[0])
            onSelectLesson(modules[0].lessons[0])
        }}
      />

      <div style={{ height: 8 }} />

      {modules.map((m, i) => (
        <MobileModuleRow
          key={m.id}
          module={m}
          moduleIndex={i}
          positionToGlobalIndex={positionToGlobalIndex}
          fallbackThumbnailUrl={course.thumbnail_url ?? null}
          fallbackObjectPosition={course.thumbnail_object_position ?? null}
          onSelectLesson={onSelectLesson}
        />
      ))}

      <footer
        style={{
          padding: '28px 20px 24px',
          borderTop: `1px solid ${C.line}`,
          marginTop: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: C.fg0,
            }}
          >
            Spaire
          </span>
          <span style={{ fontSize: 11, color: C.fg3 }}>{organizationName}</span>
        </div>
        <span style={{ fontSize: 11.5, color: C.fg3 }}>
          Premium courses, sold by creators.
        </span>
      </footer>
    </div>
  )
}

function MobileHero({
  course,
  heroHue,
  overallPct,
  totalLessons,
  totalDurationSeconds,
  continueLesson,
  continueModuleTitle,
  continueLessonNumber,
  continuePill,
  tagline,
  onResume,
}: {
  course: CustomerCourseDetail['course']
  heroHue: number
  overallPct: number
  totalLessons: number
  totalDurationSeconds: number
  continueLesson: CustomerLessonRead | null
  continueModuleTitle: string | null
  continueLessonNumber: number | null
  continuePill: string | null
  tagline: string
  onResume: () => void
}) {
  const remainingMin = continueLesson?.duration_seconds
    ? Math.max(1, Math.ceil(continueLesson.duration_seconds / 60))
    : null

  return (
    <section
      style={{
        position: 'relative',
        // Hero sits below the global TopBar (sticky white) so it doesn't try
        // to extend behind a status bar like the standalone design did.
        paddingTop: 14,
        paddingBottom: 24,
        minHeight: 620,
        overflow: 'hidden',
        background: '#000',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <HeroBackdrop
          hue={heroHue}
          thumbnailUrl={course.thumbnail_url ?? null}
          thumbnailObjectPosition={course.thumbnail_object_position ?? null}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, oklch(0 0 0 / 0.55) 0%, oklch(0 0 0 / 0) 22%, oklch(0 0 0 / 0) 38%, oklch(0 0 0 / 0.75) 78%, oklch(0 0 0 / 0.96) 100%)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '4px 20px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 10,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'oklch(0.72 0.16 25)',
            boxShadow: '0 0 8px oklch(0.72 0.16 25)',
          }}
        />
        <span>SPAIRE ORIGINAL</span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          YOUR PROGRESS
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'white',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {overallPct}%
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{ position: 'relative', zIndex: 2, padding: '0 20px 12px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.62)',
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          {continuePill && (
            <span
              style={{
                padding: '3px 9px',
                background: 'rgba(255,255,255,0.13)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
                fontSize: 9.5,
                letterSpacing: '0.12em',
                fontWeight: 600,
                color: 'white',
              }}
            >
              {continuePill}
            </span>
          )}
          <span>
            {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
          </span>
          {totalDurationSeconds > 0 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
              <span>{formatHrMin(totalDurationSeconds)}</span>
            </>
          )}
        </div>

        <h1
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            margin: '0 0 12px',
            color: 'white',
            textShadow: '0 2px 24px oklch(0 0 0 / 0.35)',
            textWrap: 'balance',
          }}
        >
          {course.title}
        </h1>

        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.4,
            marginBottom: continueLesson ? 18 : 0,
          }}
        >
          {tagline}
          {course.instructor_name && (
            <span style={{ color: 'rgba(255,255,255,0.48)' }}>
              {' '}— with {course.instructor_name}
            </span>
          )}
        </div>

        {continueLesson && (
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(18px) saturate(180%)',
              WebkitBackdropFilter: 'blur(18px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                letterSpacing: '0.16em',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                marginBottom: 4,
              }}
            >
              UP NEXT
              {continueLessonNumber != null && (
                <> · LESSON {continueLessonNumber}</>
              )}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                marginBottom: 4,
                letterSpacing: '-0.015em',
              }}
            >
              {continueLesson.title}
            </div>
            {(continueModuleTitle || remainingMin != null) && (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  flexWrap: 'wrap',
                }}
              >
                {continueModuleTitle && <span>{continueModuleTitle}</span>}
                {continueModuleTitle && remainingMin != null && (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                )}
                {remainingMin != null && <span>{remainingMin} min</span>}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onResume}
            style={{
              flex: 1,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              paddingLeft: 6,
              paddingRight: 14,
              background: 'white',
              color: 'oklch(0.14 0.006 280)',
              borderRadius: 999,
              border: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: '0 8px 24px oklch(0 0 0 / 0.35)',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'oklch(0.14 0.006 280)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 2,
              }}
            >
              <IconPlay size={14} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {continuePill === 'COURSE COMPLETE'
                ? 'Watch again'
                : continueLessonNumber != null
                  ? `Resume lesson ${continueLessonNumber}`
                  : 'Start course'}
            </span>
          </button>
          <button
            type="button"
            aria-label="Bookmark"
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'white',
              borderRadius: '50%',
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            <IconBookmark size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}

function MobileModuleRow({
  module: mod,
  moduleIndex,
  positionToGlobalIndex,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
  onSelectLesson,
}: {
  module: CustomerModuleRead
  moduleIndex: number
  positionToGlobalIndex: Map<string, number>
  fallbackThumbnailUrl: string | null
  fallbackObjectPosition: string | null
  onSelectLesson: (lesson: CustomerLessonRead) => void
}) {
  const hue = moduleHue(moduleIndex)
  const total = mod.lessons.length
  const watched = mod.lessons.filter((l) => l.completed).length
  const allDone = total > 0 && watched === total
  const inProg = !allDone && watched > 0

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '0 20px',
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: C.fg0,
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {mod.title}
          <IconChevronRight
            size={16}
            style={{ color: C.fg1, marginLeft: 2 }}
          />
        </h2>
        <span
          style={{
            fontSize: 11,
            color: C.fg3,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
          }}
        >
          {allDone ? (
            <span
              style={{
                color: C.fg1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <IconCheck size={10} /> Complete
            </span>
          ) : inProg ? (
            <span style={{ color: 'oklch(0.55 0.18 25)' }}>
              In progress · {watched}/{total}
            </span>
          ) : (
            <span>
              {watched}/{total}
            </span>
          )}
        </span>
      </div>
      <div
        className="m-hscroll"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '0 20px 4px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {mod.lessons.map((lesson) => {
          const globalIndex = positionToGlobalIndex.get(lesson.id) ?? null
          return (
            <MobileLessonCard
              key={lesson.id}
              lesson={lesson}
              hue={hue}
              globalIndex={globalIndex}
              fallbackThumbnailUrl={fallbackThumbnailUrl}
              fallbackObjectPosition={fallbackObjectPosition}
              onSelect={() => onSelectLesson(lesson)}
            />
          )
        })}
      </div>
    </div>
  )
}

function MobileLessonCard({
  lesson,
  hue,
  globalIndex,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
  onSelect,
}: {
  lesson: CustomerLessonRead
  hue: number
  globalIndex: number | null
  fallbackThumbnailUrl: string | null
  fallbackObjectPosition: string | null
  onSelect: () => void
}) {
  const watched = lesson.completed
  const locked = !!lesson.locked
  const durationLabel = lesson.duration_seconds
    ? formatMinSec(lesson.duration_seconds)
    : null

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        // Apple-TV-style portrait card — same shape and treatment as the
        // public landing's free-preview cards so an enrolled customer
        // browsing their course feels continuous with the storefront they
        // bought from. Copy + duration pill sit overlaid on the thumb so
        // each card reads as a single object.
        flex: '0 0 auto',
        width: 280,
        scrollSnapAlign: 'start',
        appearance: 'none',
        background: '#0a0a0a',
        border: '1px solid oklch(0.20 0.005 280)',
        borderRadius: 18,
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'inherit',
        boxShadow:
          '0 1px 2px oklch(0 0 0 / 0.06), 0 12px 32px oklch(0 0 0 / 0.10)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 5',
          overflow: 'hidden',
        }}
      >
        <LessonThumb
          hue={hue}
          thumbnailUrl={lesson.thumbnail_url ?? null}
          thumbnailObjectPosition={lesson.thumbnail_object_position ?? null}
          muxPlaybackId={lesson.mux_playback_id ?? null}
          fallbackThumbnailUrl={fallbackThumbnailUrl}
          fallbackObjectPosition={fallbackObjectPosition}
        />

        {/* Dim wash → ensures the bottom copy stack stays readable
            against any thumbnail. Watched cards get an extra full-tile
            overlay so they read as "done", and a centred lock + heavy
            saturation drop on locked lessons. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: locked
              ? 'rgba(0,0,0,0.55)'
              : 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.92) 100%)',
            backdropFilter: locked ? 'saturate(0.6)' : undefined,
            WebkitBackdropFilter: locked ? 'saturate(0.6)' : undefined,
            pointerEvents: 'none',
          }}
        />
        {watched && !locked && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Copy stack — episode label, title, optional description */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 48,
            color: 'white',
            zIndex: 2,
          }}
        >
          {globalIndex != null && (
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.16em',
                color: 'rgba(255,255,255,0.65)',
                marginBottom: 6,
              }}
            >
              LESSON {globalIndex}
            </div>
          )}
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: 'white',
              marginBottom: lesson.description ? 8 : 0,
              textShadow: '0 2px 14px rgba(0,0,0,0.5)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {lesson.title}
          </div>
          {lesson.description && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.78)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textWrap: 'pretty',
              }}
            >
              {lesson.description}
            </div>
          )}
        </div>

        {/* Footer row — duration pill (left), state badge (right) */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 3,
          }}
        >
          {durationLabel ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.92)',
                padding: '5px 9px 5px 8px',
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 999,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <IconPlay size={11} />
              <span>{durationLabel}</span>
            </div>
          ) : (
            <span />
          )}

          {locked ? (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              aria-label="Locked"
            >
              <IconLock size={12} />
            </div>
          ) : watched ? (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.97)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
              aria-label="Completed"
            >
              <IconCheck size={12} />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}
