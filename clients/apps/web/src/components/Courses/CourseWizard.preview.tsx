'use client'

import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useMemo, useState } from 'react'
import type { CourseLanding } from './schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftState = {
  name: string
  courseTitle: string
  desc: string
  // styling flags kept for backwards-compat on save; the preview no longer
  // exposes italic and never renders italic text.
  nameItalic: boolean
  nameBold: boolean
  nameUppercase: boolean
}

type MediaState = {
  format: 'thumbnail' | 'trailer' | null
  thumbFile: File | null
  videoFile: File | null
  thumbName: string
  videoName: string
}

type PricingState = {
  paywallEnabled: boolean
  priceCents: number
  freePreviewLessons: number
}

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}
type PartialOutline = { modules?: PartialModule[] }

type PartialLanding = Partial<CourseLanding>

// ─── Color & font tokens (Apple-TV-inspired light theme) ─────────────────────

const FONT = "'Poppins', var(--font-poppins), system-ui, sans-serif"
const C = {
  bg0: '#ffffff',
  bg1: '#ffffff',
  bg2: 'oklch(0.975 0.002 280)',
  bg3: 'oklch(0.95 0.003 280)',
  line: 'oklch(0.92 0.003 280)',
  lineSoft: 'oklch(0.945 0.003 280)',
  fg0: 'oklch(0.18 0.008 280)',
  fg1: 'oklch(0.32 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  accent: 'oklch(0.55 0.20 265)',
  accent2: 'oklch(0.62 0.16 285)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceString(cents: number) {
  if (!cents || cents <= 0) return ''
  if (cents % 100 === 0) return `$${Math.round(cents / 100)}`
  return `$${(cents / 100).toFixed(2)}`
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}

function Skeleton({
  width = '70%',
  height = 14,
}: {
  width?: string | number
  height?: number
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        width,
        height,
        background: C.bg3,
        borderRadius: 4,
        animation: 'soPulseBg 1.4s ease-in-out infinite',
        verticalAlign: 'middle',
      }}
    />
  )
}

function NumberLabel({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `1px solid ${C.line}`,
          color: C.fg1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: C.fg2,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function PreviewTopBar({
  onBack,
  onClose,
  onEdit,
  onCreate,
  isStreaming,
}: {
  onBack: () => void
  onClose: () => void
  onEdit: () => void
  onCreate: () => void
  isStreaming: boolean
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${C.lineSoft}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 28px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              color: C.fg1,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            ← Back to outline
          </button>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: C.fg3,
              textTransform: 'uppercase',
              marginLeft: 8,
            }}
          >
            Landing preview
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onEdit}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              color: C.fg0,
              background: C.bg1,
              border: `1px solid ${C.line}`,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            Edit page
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={isStreaming}
            style={{
              padding: '9px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: 'white',
              background: C.fg0,
              border: 'none',
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              opacity: isStreaming ? 0.5 : 1,
              fontFamily: FONT,
            }}
          >
            {isStreaming ? 'Generating…' : 'Create course'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.fg2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Hero (cinematic full-bleed) ─────────────────────────────────────────────

function Hero({
  bgUrl,
  isVideo,
  thumbPosition,
  draft,
  course,
  instructor,
  landing,
  pricing,
  outline,
  totalDurationSeconds,
  onWatchTrailer,
  onReplaceMedia,
}: {
  bgUrl: string | null
  isVideo: boolean
  thumbPosition: string | null
  draft: DraftState
  course: { title: string; desc: string }
  instructor: { name: string; bio: string }
  landing: PartialLanding
  pricing: PricingState
  outline: PartialOutline
  totalDurationSeconds: number
  onWatchTrailer: () => void
  onReplaceMedia: () => void
}) {
  const title = draft.courseTitle || course.title || 'Your Course Title'
  const instructorName = draft.name || instructor.name || 'Your Name'
  const tagline =
    landing.tagline ?? (course.desc || 'A short, punchy course tagline.')
  const eyebrow = landing.eyebrow ?? 'SPAIRE ORIGINAL'
  const series = landing.series_label ?? 'NEW SERIES'
  const level = landing.level ?? 'All levels'

  const lessonCount =
    outline.modules?.reduce((acc, m) => acc + (m?.lessons?.length ?? 0), 0) ?? 0
  const priceLabel = priceString(pricing.priceCents)

  return (
    <section
      style={{
        position: 'relative',
        height: 'min(86vh, 720px)',
        minHeight: 560,
        margin: '20px 20px 0',
        borderRadius: 24,
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
      }}
    >
      {/* Backdrop media */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {bgUrl ? (
          isVideo ? (
            <video
              src={bgUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bgUrl}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: thumbPosition ?? 'center',
              }}
            />
          )
        ) : (
          <PlaceholderBackdrop />
        )}
      </div>

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.88) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top-left tag */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
          fontFamily: FONT,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'oklch(0.78 0.16 25)',
            boxShadow: '0 0 12px oklch(0.78 0.16 25)',
          }}
        />
        <span>{eyebrow}</span>
      </div>

      {/* Replace-media button (top-right) */}
      <button
        type="button"
        onClick={onReplaceMedia}
        style={{
          position: 'absolute',
          right: 24,
          top: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.14)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 999,
          color: 'white',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: FONT,
        }}
      >
        {bgUrl ? 'Replace media' : 'Add hero image or trailer'}
      </button>

      {/* Bottom content */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '40px 48px 44px',
          color: 'white',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontWeight: 600,
              color: 'white',
            }}
          >
            {series}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {lessonCount > 0 ? (
              `${lessonCount} lessons`
            ) : (
              <Skeleton width={70} />
            )}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {totalDurationSeconds > 0
              ? formatDuration(totalDurationSeconds)
              : '—'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{level}</span>
        </div>

        <h1
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(48px, 7vw, 88px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.96,
            margin: '0 0 18px',
            color: 'white',
            maxWidth: '14ch',
            textShadow: '0 2px 30px rgba(0,0,0,0.4)',
          }}
        >
          {title}
        </h1>

        <div
          style={{
            fontSize: 'clamp(15px, 1.3vw, 18px)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.92)',
            maxWidth: 600,
            marginBottom: 28,
            lineHeight: 1.4,
          }}
        >
          {tagline}{' '}
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>
            — with {instructorName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onWatchTrailer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 22px 12px 14px',
              background: 'white',
              color: C.fg0,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              fontFamily: FONT,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: C.fg0,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 2,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M3 1.5l6 4-6 4V1.5z" fill="currentColor" />
              </svg>
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Watch trailer</span>
          </button>
          {pricing.paywallEnabled && priceLabel && (
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 20px',
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'white',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              Enroll · {priceLabel}
            </button>
          )}
          {!pricing.paywallEnabled && (
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 20px',
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'white',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              Start free
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function PlaceholderBackdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 25% 35%, oklch(0.42 0.12 35) 0%, oklch(0.18 0.05 280) 55%, oklch(0.08 0.02 280) 100%)',
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
            'radial-gradient(ellipse, oklch(0.88 0.08 75 / 0.35) 0%, transparent 65%)',
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
          background:
            'radial-gradient(circle, oklch(0.50 0.14 285 / 0.25) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
    </div>
  )
}

// ─── Trailer block (separate full-bleed video player) ────────────────────────

export function TrailerBlock({
  trailerUrl,
  thumbnailUrl,
  thumbPosition,
  onReplaceTrailer,
}: {
  trailerUrl: string | null
  thumbnailUrl: string | null
  thumbPosition: string | null
  onReplaceTrailer: () => void
}) {
  const [playing, setPlaying] = useState(false)
  return (
    <section
      id="preview-trailer"
      style={{
        padding: '64px 32px 24px',
        maxWidth: 1180,
        margin: '0 auto',
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <NumberLabel n="01" label="OFFICIAL TRAILER" />
      </div>
      <div
        style={{
          position: 'relative',
          aspectRatio: '21 / 9',
          background: '#000',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 24px 48px rgba(0,0,0,0.18)',
        }}
      >
        {trailerUrl ? (
          playing ? (
            <video
              src={trailerUrl}
              autoPlay
              controls
              playsInline
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#000',
              }}
            />
          ) : (
            <>
              <video
                src={trailerUrl}
                muted
                playsInline
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <button
                type="button"
                onClick={() => setPlaying(true)}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)',
                  color: C.fg0,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: 4,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 11 11" fill="none">
                  <path d="M3 1.5l6 4-6 4V1.5z" fill="currentColor" />
                </svg>
              </button>
            </>
          )
        ) : thumbnailUrl ? (
          <>
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
                objectPosition: thumbPosition ?? 'center',
                filter: 'brightness(0.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 13,
                letterSpacing: '0.04em',
                opacity: 0.8,
                fontFamily: FONT,
              }}
            >
              Trailer placeholder — upload a trailer to play it here
            </div>
          </>
        ) : (
          <PlaceholderBackdrop />
        )}
        <button
          type="button"
          onClick={onReplaceTrailer}
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 999,
            color: 'white',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          {trailerUrl ? 'Replace trailer' : 'Upload trailer'}
        </button>
      </div>
    </section>
  )
}

// ─── Value strip ──────────────────────────────────────────────────────────────

export function ValueStrip({ landing }: { landing: PartialLanding }) {
  const items = landing.value_props ?? []
  // Render placeholders while streaming so layout doesn't reflow.
  const renderItems =
    items.length > 0
      ? items
      : Array.from({ length: 4 }, () => ({ title: '', description: '' }))
  return (
    <section
      style={{
        padding: '96px 32px 48px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: C.fg3,
          marginBottom: 32,
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      >
        {landing.value_props_label || <Skeleton width={140} height={11} />}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(2, renderItems.length)}, 1fr)`,
          gap: 0,
        }}
      >
        {renderItems.map((v, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              padding: '24px 28px 28px',
              borderLeft: i === 0 ? 'none' : `1px solid ${C.line}`,
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: C.fg0,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: C.fg0,
                marginTop: 6,
                minHeight: 22,
              }}
            >
              {v.title || <Skeleton width="60%" height={16} />}
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.fg2,
                lineHeight: 1.55,
                minHeight: 40,
              }}
            >
              {v.description || (
                <>
                  <Skeleton width="95%" height={12} />
                  <br />
                  <Skeleton width="80%" height={12} />
                </>
              )}
            </div>
            <div
              style={{
                position: 'absolute',
                right: 20,
                top: 20,
                fontSize: 11,
                fontWeight: 600,
                color: C.fg3,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
              }}
            >
              0{i + 1}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Curriculum timeline ─────────────────────────────────────────────────────

export function CurriculumTimeline({
  outline,
  landing,
}: {
  outline: PartialOutline
  landing: PartialLanding
}) {
  const modules = (outline.modules ?? []).filter((m): m is PartialModule => !!m)
  const heading = landing.curriculum_heading ?? ''
  const sub = landing.curriculum_subheading ?? ''
  const eyebrow = landing.curriculum_label ?? 'CURRICULUM'

  // Stable hue per module index
  const huesByIdx = useMemo(() => [35, 195, 285, 145, 25, 320, 95, 215], [])

  return (
    <section
      style={{
        padding: '64px 32px 48px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <div style={{ marginBottom: 24 }}>
          <NumberLabel n="02" label={eyebrow.toUpperCase()} />
        </div>
        <h2
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            margin: 0,
            color: C.fg0,
          }}
        >
          {heading || <Skeleton width="80%" height={36} />}
        </h2>
        <p
          style={{
            fontSize: 16,
            color: C.fg2,
            margin: '20px 0 0',
            lineHeight: 1.55,
            maxWidth: 560,
            minHeight: 24,
          }}
        >
          {sub || (
            <>
              <Skeleton width="100%" height={14} />
              <br />
              <Skeleton width="70%" height={14} />
            </>
          )}
        </p>
      </div>

      <div
        style={{
          overflowX: 'auto',
          margin: '0 -32px',
          padding: '0 32px 12px',
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          {(modules.length > 0
            ? modules
            : Array.from({ length: 3 }, () => ({}) as PartialModule)
          ).map((mod, i) => {
            const hue = huesByIdx[i % huesByIdx.length]
            const lessonsCount = mod.lessons?.length ?? 0
            return (
              <div
                key={i}
                style={{
                  flex: '0 0 280px',
                  background: C.bg1,
                  border: `1px solid ${C.line}`,
                  borderRadius: 20,
                  overflow: 'hidden',
                  boxShadow:
                    '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    aspectRatio: '4 / 3',
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: 'white',
                    background: `linear-gradient(150deg, oklch(0.45 0.12 ${hue}) 0%, oklch(0.20 0.05 ${(hue + 30) % 360}) 100%)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      opacity: 0.85,
                    }}
                  >
                    CHAPTER {String(i + 1).padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      minHeight: 30,
                    }}
                  >
                    {mod.title || <Skeleton width="80%" height={18} />}
                  </div>
                </div>
                <div
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: C.fg1,
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: `oklch(0.55 0.15 ${hue})`,
                      }}
                    />
                    {lessonsCount > 0
                      ? `${lessonsCount} lesson${lessonsCount === 1 ? '' : 's'}`
                      : '—'}
                  </div>
                  <span style={{ color: C.fg3, fontSize: 14 }}>→</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Full lesson list + paywall callout ──────────────────────────────────────

export function FullLessonList({
  outline,
  pricing,
  landing,
}: {
  outline: PartialOutline
  pricing: PricingState
  landing: PartialLanding
}) {
  const [openIdx, setOpenIdx] = useState(0)
  const modules = (outline.modules ?? []).filter((m): m is PartialModule => !!m)
  const flatLessons: { title: string; moduleIdx: number; lessonIdx: number }[] =
    []
  modules.forEach((m, mi) => {
    ;(m.lessons ?? []).forEach((l, li) => {
      if (l?.title)
        flatLessons.push({ title: l.title, moduleIdx: mi, lessonIdx: li })
    })
  })

  const total = flatLessons.length
  const free = pricing.paywallEnabled
    ? Math.min(pricing.freePreviewLessons, total)
    : total

  return (
    <section
      style={{
        padding: '64px 32px',
        maxWidth: 1100,
        margin: '0 auto',
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 40, maxWidth: 640 }}>
        <div style={{ marginBottom: 24 }}>
          <NumberLabel
            n="03"
            label={(landing.lessons_label ?? 'EVERY LESSON').toUpperCase()}
          />
        </div>
        <h2
          style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            margin: 0,
            color: C.fg0,
            minHeight: 56,
          }}
        >
          {landing.lessons_heading || <Skeleton width="60%" height={36} />}
        </h2>
        <p
          style={{
            fontSize: 15,
            color: C.fg2,
            margin: '20px 0 0',
            lineHeight: 1.55,
            maxWidth: 520,
            minHeight: 24,
          }}
        >
          {landing.lessons_subheading || (
            <>
              <Skeleton width="100%" height={14} />
              <br />
              <Skeleton width="70%" height={14} />
            </>
          )}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          overflow: 'hidden',
          background: C.bg1,
        }}
      >
        {modules.map((m, i) => {
          const open = openIdx === i
          const lessons = m.lessons ?? []
          return (
            <div key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '22px 28px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: C.fg3,
                      letterSpacing: '0.04em',
                      minWidth: 24,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        letterSpacing: '-0.015em',
                        color: C.fg0,
                      }}
                    >
                      {m.title || <Skeleton width={220} height={18} />}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: C.fg2,
                        marginTop: 3,
                      }}
                    >
                      {lessons.length} lesson
                      {lessons.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `1px solid ${C.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: C.fg1,
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 200ms ease',
                  }}
                >
                  ▾
                </div>
              </button>
              {open && lessons.length > 0 && (
                <div
                  style={{
                    background: C.bg2,
                    borderTop: `1px solid ${C.line}`,
                  }}
                >
                  {lessons.map((l, li) => {
                    // Compute global lesson index
                    const globalIdx = flatLessons.findIndex(
                      (f) => f.moduleIdx === i && f.lessonIdx === li,
                    )
                    const isFree = pricing.paywallEnabled
                      ? globalIdx >= 0 && globalIdx < free
                      : true
                    return (
                      <div
                        key={li}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 28px 14px 70px',
                          borderBottom: `1px solid ${C.lineSoft}`,
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.fg3,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {String(li + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: C.fg0,
                              }}
                            >
                              {l?.title || <Skeleton width={180} height={14} />}
                            </div>
                            {pricing.paywallEnabled && isFree && (
                              <div style={{ marginTop: 4 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    letterSpacing: '0.06em',
                                    color: 'oklch(0.45 0.14 155)',
                                    border: '1px solid oklch(0.85 0.10 155)',
                                    padding: '1px 6px',
                                    borderRadius: 3,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Free preview
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          {isFree ? (
                            <button
                              type="button"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '7px 14px',
                                borderRadius: 999,
                                background: C.fg0,
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 500,
                                border: 'none',
                                cursor: 'pointer',
                                fontFamily: FONT,
                              }}
                            >
                              Watch
                            </button>
                          ) : (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: C.bg3,
                                color: C.fg3,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                              }}
                            >
                              🔒
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {pricing.paywallEnabled && pricing.priceCents > 0 && (
        <div
          style={{
            position: 'relative',
            marginTop: 24,
            borderRadius: 20,
            overflow: 'hidden',
            background: C.fg0,
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.05), 0 12px 32px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 80% 50%, oklch(0.40 0.18 265 / 0.4), transparent 60%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '20px 24px',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              🔒
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'white',
                }}
              >
                Unlock all {total} lesson{total === 1 ? '' : 's'}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.65)',
                  marginTop: 3,
                }}
              >
                Lifetime access · 30-day refund · Any device
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'white',
                }}
              >
                {priceString(pricing.priceCents)}
              </span>
            </div>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '12px 20px',
                borderRadius: 999,
                background: 'white',
                color: C.fg0,
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              Enroll →
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Instructor pull-quote block ─────────────────────────────────────────────

export function InstructorBlock({
  instructor,
  draft,
  landing,
}: {
  instructor: { name: string; bio: string }
  draft: DraftState
  landing: PartialLanding
}) {
  const name = draft.name || instructor.name || 'Your name'
  const bio = instructor.bio
  const quote = landing.instructor_pull_quote ?? ''
  const creds = landing.instructor_credentials ?? []

  return (
    <section
      style={{
        padding: '64px 32px',
        maxWidth: 1180,
        margin: '0 auto',
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 36 }}>
        <NumberLabel
          n="04"
          label={(landing.instructor_label ?? 'YOUR INSTRUCTOR').toUpperCase()}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.85fr 1fr',
          gap: 48,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              position: 'relative',
              aspectRatio: '4 / 5',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow:
                '0 1px 2px rgba(0,0,0,0.05), 0 12px 32px rgba(0,0,0,0.08)',
              background:
                'linear-gradient(160deg, oklch(0.45 0.10 35), oklch(0.20 0.05 65))',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '8%',
                transform: 'translateX(-50%)',
                width: '32%',
                aspectRatio: '1',
                background:
                  'linear-gradient(180deg, oklch(0.55 0.05 35), oklch(0.36 0.04 35))',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '20%',
                bottom: 0,
                right: '20%',
                height: '60%',
                background:
                  'linear-gradient(180deg, oklch(0.30 0.04 35), oklch(0.16 0.03 35))',
                clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0% 100%)',
                borderRadius: '40% 40% 0 0',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 20,
                bottom: 18,
                color: 'white',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}
            >
              {name}
            </div>
          </div>
        </div>
        <div>
          <h2
            style={{
              fontSize: 'clamp(28px, 3.4vw, 42px)',
              fontWeight: 500,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              margin: '0 0 16px',
              color: C.fg0,
            }}
          >
            {quote ? `"${quote}"` : <Skeleton width="90%" height={28} />}
          </h2>
          <div
            style={{
              fontSize: 12.5,
              color: C.fg2,
              letterSpacing: '0.04em',
              marginBottom: 28,
            }}
          >
            — {name}
          </div>
          {bio && (
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: C.fg1,
                margin: '0 0 32px',
                maxWidth: 540,
              }}
            >
              {bio}
            </p>
          )}
          {creds.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 40,
                paddingTop: 24,
                borderTop: `1px solid ${C.line}`,
              }}
            >
              {creds.map((cred, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 600,
                      letterSpacing: '-0.025em',
                      color: C.fg0,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {cred.number}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: C.fg2,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {cred.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function Reviews({ landing }: { landing: PartialLanding }) {
  const reviews = landing.reviews ?? []
  if (reviews.length === 0) return null
  return (
    <section
      style={{
        padding: '64px 32px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <NumberLabel
          n="05"
          label={(landing.reviews_label ?? 'FROM STUDENTS').toUpperCase()}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(3, reviews.length)}, 1fr)`,
          gap: 16,
        }}
      >
        {reviews.map((r, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              background: C.bg1,
              border: `1px solid ${C.line}`,
              borderRadius: 20,
              padding: 28,
              boxShadow:
                '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 80,
                lineHeight: 0.6,
                color: C.accent,
                opacity: 0.3,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              &ldquo;
            </div>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: C.fg0,
                margin: '0 0 24px',
              }}
            >
              {r.text}
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingTop: 16,
                borderTop: `1px solid ${C.line}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {(r.name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.fg0 }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 12, color: C.fg2 }}>{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

export function FinalCta({
  landing,
  pricing,
  onCreate,
}: {
  landing: PartialLanding
  pricing: PricingState
  onCreate: () => void
}) {
  const label = landing.final_cta_label ?? 'READY WHEN YOU ARE'
  const titleRaw = landing.final_cta_title ?? ''
  const subtitle = landing.final_cta_subtitle ?? ''
  const primaryLabel =
    landing.final_cta_primary ??
    (pricing.paywallEnabled ? 'Enroll' : 'Start watching')

  // Render \n as a real line break.
  const titleLines = titleRaw ? titleRaw.split(/\\n|\n/) : []

  return (
    <section
      style={{
        position: 'relative',
        margin: '64px 20px 0',
        padding: '88px 32px 80px',
        background: C.fg0,
        borderRadius: 24,
        overflow: 'hidden',
        isolation: 'isolate',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          top: '-30%',
          width: '70%',
          height: '120%',
          background:
            'radial-gradient(ellipse, oklch(0.45 0.18 265 / 0.55) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-10%',
          bottom: '-30%',
          width: '60%',
          height: '120%',
          background:
            'radial-gradient(ellipse, oklch(0.50 0.15 25 / 0.35) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 700,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            letterSpacing: '0.18em',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'oklch(0.78 0.16 25)',
              boxShadow: '0 0 12px oklch(0.78 0.16 25)',
            }}
          />
          {label}
        </div>
        <h2
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            margin: '0 0 16px',
            color: 'white',
          }}
        >
          {titleLines.length > 0 ? (
            titleLines.map((line, i) => (
              <span key={i} style={{ display: 'block' }}>
                {line}
              </span>
            ))
          ) : (
            <Skeleton width="60%" height={48} />
          )}
        </h2>
        <p
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.7)',
            margin: '0 0 36px',
            minHeight: 22,
          }}
        >
          {subtitle || (
            <span style={{ opacity: 0.5 }}>
              <Skeleton width="60%" height={14} />
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 24px',
            borderRadius: 999,
            background: 'white',
            color: C.fg0,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            fontFamily: FONT,
          }}
        >
          {primaryLabel} →
        </button>
      </div>
    </section>
  )
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

function EditPanel({
  open,
  draft,
  setDraft,
  media,
  onMediaChange,
  thumbPosition,
  onThumbPositionChange,
  onClose,
}: {
  open: boolean
  draft: DraftState
  setDraft: (updater: (prev: DraftState) => DraftState) => void
  media: MediaState
  onMediaChange: (next: MediaState) => void
  thumbPosition: string | null
  onThumbPositionChange: (v: string | null) => void
  onClose: () => void
}) {
  const handleHero = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    onMediaChange({
      ...media,
      format: 'thumbnail',
      thumbFile: f,
      thumbName: f.name,
    })
  }
  const handleTrailer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    onMediaChange({
      ...media,
      format: 'trailer',
      videoFile: f,
      videoName: f.name,
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: 'rgba(12,12,12,0.94)',
        backdropFilter: 'blur(32px) saturate(160%)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 300,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.5)',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Edit landing
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <PanelSection label="Hero image">
          <UploadControl
            currentName={media.format === 'thumbnail' ? media.thumbName : ''}
            accept="image/*"
            cta={
              media.format === 'thumbnail' && media.thumbName
                ? 'Replace image'
                : 'Upload image'
            }
            onPick={handleHero}
          />
          {thumbPosition !== null && media.format === 'thumbnail' && (
            <button
              type="button"
              onClick={() => onThumbPositionChange(null)}
              style={{
                marginTop: 6,
                fontSize: 11,
                color: 'rgba(255,255,255,0.5)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
                fontFamily: FONT,
              }}
            >
              Reset position
            </button>
          )}
        </PanelSection>

        <PanelSection label="Trailer video">
          <UploadControl
            currentName={media.format === 'trailer' ? media.videoName : ''}
            accept="video/*"
            cta={
              media.format === 'trailer' && media.videoName
                ? 'Replace trailer'
                : 'Upload trailer'
            }
            onPick={handleTrailer}
          />
        </PanelSection>

        <PanelSection label="Instructor name">
          <PanelInput
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <StyleToggle
              active={draft.nameBold}
              onClick={() => setDraft((d) => ({ ...d, nameBold: !d.nameBold }))}
              label="Bold"
              bold
            />
            <StyleToggle
              active={draft.nameUppercase}
              onClick={() =>
                setDraft((d) => ({ ...d, nameUppercase: !d.nameUppercase }))
              }
              label="ALL CAPS"
            />
          </div>
        </PanelSection>

        <PanelSection label="Course title">
          <PanelInput
            value={draft.courseTitle}
            onChange={(v) => setDraft((d) => ({ ...d, courseTitle: v }))}
          />
        </PanelSection>

        <PanelSection label="Description">
          <PanelTextarea
            value={draft.desc}
            onChange={(v) => setDraft((d) => ({ ...d, desc: v }))}
          />
        </PanelSection>
      </div>
      <div
        style={{
          padding: '20px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: 13,
            background: '#fff',
            color: '#080808',
            border: 'none',
            borderRadius: 999,
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        {label}
      </label>
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: 400,
        color: '#f2f1ee',
        outline: 'none',
      }}
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: 400,
        color: '#f2f1ee',
        outline: 'none',
        resize: 'none',
        lineHeight: 1.6,
      }}
    />
  )
}

function StyleToggle({
  active,
  onClick,
  label,
  bold,
}: {
  active: boolean
  onClick: () => void
  label: string
  bold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border py-1.5 text-xs transition-all ${
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
      }`}
      style={{
        flex: 1,
        padding: 8,
        background: active
          ? 'rgba(255,255,255,0.14)'
          : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8,
        color: active ? '#fff' : 'rgba(242,241,238,0.5)',
        fontFamily: FONT,
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: bold ? 700 : 400,
      }}
    >
      {label}
    </button>
  )
}

function UploadControl({
  currentName,
  accept,
  cta,
  onPick,
}: {
  currentName: string
  accept: string
  cta: string
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px dashed rgba(255,255,255,0.18)',
        borderRadius: 10,
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontFamily: FONT,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {currentName || cta}
      </span>
      <span
        style={{
          padding: '4px 10px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.12)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Choose
      </span>
      <input
        type="file"
        accept={accept}
        onChange={onPick}
        style={{ display: 'none' }}
      />
    </label>
  )
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

export function LandingPreview({
  instructor,
  course,
  pricing,
  draft,
  setDraft,
  pricing,
  thumbPosition,
  onThumbPositionChange,
  onMediaChange,
  outline,
  landing,
  isLandingStreaming,
  totalDurationSeconds,
  editOpen,
  setEditOpen,
  onCreate,
  onBack,
  onClose,
  error,
}: LandingPreviewProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const isVideo = media.format === 'trailer' && !!media.videoFile
  const file = media.format === 'trailer' ? media.videoFile : media.thumbFile

  const pricingLabel = pricing.model === 'free'
    ? 'Free'
    : pricing.amount
    ? `$${pricing.amount}`
    : 'Paid'

  const onWatchTrailer = () => {
    if (typeof document === 'undefined') return
    document
      .getElementById('preview-trailer')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: C.bg0,
        overflow: 'auto',
        fontFamily: FONT,
        color: C.fg0,
        zIndex: 50,
      }}
    >
      <PreviewTopBar
        onBack={onBack}
        onClose={onClose}
        onEdit={() => setEditOpen(true)}
        onCreate={onCreate}
        isStreaming={isLandingStreaming}
      />
      {error && (
        <div
          style={{
            margin: '12px 20px 0',
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fff5f5',
            border: '1.5px solid #fecaca',
            color: '#dc2626',
            fontSize: 13,
            fontFamily: FONT,
          }}
        >
          {error}
        </div>
      )}
      <Hero
        bgUrl={bgUrl}
        isVideo={isVideo}
        thumbPosition={thumbPosition}
        draft={draft}
        course={course}
        instructor={instructor}
        landing={landing}
        pricing={pricing}
        outline={outline}
        totalDurationSeconds={totalDurationSeconds}
        onWatchTrailer={onWatchTrailer}
        onReplaceMedia={() => setEditOpen(true)}
      />
      <TrailerBlock
        trailerUrl={isVideo ? bgUrl : null}
        thumbnailUrl={!isVideo ? bgUrl : null}
        thumbPosition={thumbPosition}
        onReplaceTrailer={() => setEditOpen(true)}
      />
      <ValueStrip landing={landing} />
      <div id="preview-curriculum">
        <CurriculumTimeline outline={outline} landing={landing} />
      </div>
      <FullLessonList outline={outline} pricing={pricing} landing={landing} />
      <InstructorBlock
        instructor={instructor}
        draft={draft}
        landing={landing}
      />
      <Reviews landing={landing} />
      <FinalCta landing={landing} pricing={pricing} onCreate={onCreate} />
      <footer
        style={{
          padding: '48px 32px',
          maxWidth: 1320,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 28,
            borderTop: `1px solid ${C.line}`,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: C.fg0,
              }}
            >
              Spaire
            </span>
            <span style={{ fontSize: 11.5, color: C.fg3 }}>
              Preview · not yet published
            </span>
          </div>
          <span style={{ fontSize: 12, color: C.fg3 }}>
            Premium courses, sold by creators.
          </span>
        </div>
      </footer>

      <EditPanel
        open={editOpen}
        draft={draft}
        setDraft={setDraft}
        media={media}
        onMediaChange={onMediaChange}
        thumbPosition={thumbPosition}
        onThumbPositionChange={onThumbPositionChange}
        onClose={() => setEditOpen(false)}
      />

      <style jsx global>{`
        @keyframes soPulseBg {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export type LandingPreviewProps = {
  instructor: { name: string; bio: string }
  course: { title: string; desc: string }
  media: MediaState
  draft: DraftState
  setDraft: (updater: (prev: DraftState) => DraftState) => void
  pricing: PricingState
  thumbPosition: string | null
  onThumbPositionChange: (v: string | null) => void
  onMediaChange: (next: MediaState) => void
  outline: PartialOutline
  landing: PartialLanding
  isLandingStreaming: boolean
  totalDurationSeconds: number
  editOpen: boolean
  setEditOpen: (open: boolean) => void
  onCreate: () => void
  onBack: () => void
  onClose: () => void
  error: string | null
}

/* SECTION_ANCHOR */
