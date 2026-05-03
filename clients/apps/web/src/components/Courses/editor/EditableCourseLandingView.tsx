'use client'

// Apple TV-style course landing — mirrors the Spaire Course Landing v2 design
// (light page, dark cinematic hero in a rounded box, free preview episode grid,
// dark paywall block, light instructor section, dark final CTA).
//
// Inline editing is provided by EditText, EditMedia and EditBlock — every
// visible string is click-to-edit and every media tile gets a hover Replace
// button. Live values that come from elsewhere in the editor (paywall position,
// product price) flow through props so the landing always reflects what the
// creator chose during onboarding.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import type { schemas } from '@spaire/client'
import { useRef, useState } from 'react'
import { useEditor } from './EditorContext'
import { EditBlock, EditMedia, EditText } from './EditPrimitives'
import { HeroMedia } from './HeroMedia'

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'
const HEADING_VAR = 'var(--font-heading, ' + FONT_VAR + ')'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(secs: number) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}

function fmtLessonTime(secs?: number | null) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

export function formatProductPrice(
  product: schemas['Product'] | undefined,
): string {
  if (!product) return ''
  const fixed = product.prices.find((p) => p.amount_type === 'fixed')
  if (!fixed || !('price_amount' in fixed)) {
    const free = product.prices.find((p) => p.amount_type === 'free')
    if (free) return 'Free'
    const custom = product.prices.find((p) => p.amount_type === 'custom')
    if (custom) return 'Pay what you want'
    return ''
  }
  const cents = fixed.price_amount as number
  const dollars = cents / 100
  if (dollars === Math.floor(dollars)) return `$${dollars.toFixed(0)}`
  return `$${dollars.toFixed(2)}`
}

// ── Top-level ──────────────────────────────────────────────────────────────

export type EditableLandingProps = {
  course: CourseRead
  organizationName: string
  organizationSlug?: string
  flatLessons: CourseLessonRead[]
  product?: schemas['Product']
}

export function EditableCourseLandingView({
  course,
  organizationName,
  organizationSlug,
  flatLessons,
  product,
}: EditableLandingProps) {
  const ed = useEditor()
  const priceLabel = formatProductPrice(product)

  const paywallAt =
    course.paywall_enabled && course.paywall_position != null
      ? Math.min(course.paywall_position, flatLessons.length)
      : null
  const freeLessons =
    paywallAt != null ? flatLessons.slice(0, paywallAt) : flatLessons
  const paidLessons =
    paywallAt != null ? flatLessons.slice(paywallAt) : []
  const lockedCount = paidLessons.length

  const sectionMap: Record<string, { label: string; node: React.ReactNode }> = {
    hero: {
      label: 'Hero',
      node: (
        <Hero
          course={course}
          flatLessons={flatLessons}
          freeCount={freeLessons.length}
          priceLabel={priceLabel}
        />
      ),
    },
    lessons: {
      label: 'Free preview',
      node: (
        <EpisodeGrid
          course={course}
          freeLessons={freeLessons}
          paidLessons={paidLessons}
          lockedCount={lockedCount}
          priceLabel={priceLabel}
          organizationSlug={organizationSlug}
        />
      ),
    },
    instructor: { label: 'Instructor', node: <Instructor course={course} /> },
    finalCta: {
      label: 'Final CTA',
      node: (
        <FinalCta
          freeCount={freeLessons.length}
          priceLabel={priceLabel}
        />
      ),
    },
  }

  return (
    <div
      data-spaire-editor
      style={{
        background: 'var(--bg-0, #fff)',
        color: 'var(--fg-0, oklch(0.18 0.008 280))',
        fontFamily: FONT_VAR,
        minHeight: '100%',
      }}
    >
      {ed.overrides.order
        .filter((id) => sectionMap[id])
        .map((id) => {
          const s = sectionMap[id]
          return (
            <EditBlock key={id} id={id} label={s.label}>
              {s.node}
            </EditBlock>
          )
        })}
      <Footer organizationName={organizationName} />
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({
  course,
  flatLessons,
  freeCount,
  priceLabel,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
  freeCount: number
  priceLabel: string
}) {
  const totalDurationSeconds = flatLessons.reduce(
    (a, l) => a + (l.duration_seconds ?? 0),
    0,
  )

  return (
    <section
      style={{
        position: 'relative',
        height: 'min(88vh, 760px)',
        minHeight: 580,
        margin: '20px 20px 0',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
        border: '1px solid oklch(0.92 0.003 280)',
        boxShadow:
          '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.10)',
      }}
    >
      <EditMedia
        id="hero.backdrop"
        label="hero media"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
        renderMedia={() => null}
      >
        <HeroMedia
          imageUrl={course.thumbnail_url ?? null}
          trailerUrl={course.trailer_url ?? null}
          peekSeconds={10}
        />
      </EditMedia>

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0) 30%, oklch(0 0 0 / 0) 45%, oklch(0 0 0 / 0.6) 80%, oklch(0 0 0 / 0.92) 100%)',
        }}
      />

      {/* SPAIRE ORIGINAL pill (top-left) */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 28,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'oklch(0.72 0.16 25)',
            boxShadow: '0 0 12px oklch(0.72 0.16 25)',
          }}
        />
        <EditText
          path="hero.eyebrow"
          defaultValue="SPAIRE ORIGINAL"
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            fontFamily: FONT_VAR,
          }}
        />
      </div>

      {/* Hero media controls (top-right) — explicit Add/Replace + info */}
      <HeroMediaControls hasMedia={!!course.thumbnail_url || !!course.trailer_url} />

      {/* Bottom content */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          padding: '40px 48px 52px',
          color: 'white',
          fontFamily: FONT_VAR,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            fontSize: 12,
            color: 'rgba(255,255,255,0.65)',
            fontWeight: 500,
          }}
        >
          <EditText
            path="hero.series_label"
            defaultValue="NEW SERIES"
            style={{
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
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {flatLessons.length} {plural(flatLessons.length, 'lesson', 'lessons')}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {fmtDuration(totalDurationSeconds)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <EditText
            path="hero.level"
            defaultValue="All levels"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          />
        </div>

        <EditText
          as="h1"
          path="hero.title"
          defaultValue={course.title ?? 'Untitled course'}
          multiline
          style={{
            fontSize: `calc(clamp(52px, 7.5vw, 96px) * var(--type-scale, 1))`,
            fontWeight: 'var(--h-weight, 700)',
            fontStyle: 'var(--h-italic, normal)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.045em)',
            lineHeight: 'calc(var(--h-leading, 1) * 0.95)',
            margin: '0 0 18px',
            color: 'white',
            maxWidth: '14ch',
            textShadow: '0 2px 30px oklch(0 0 0 / 0.35)',
            fontFamily: HEADING_VAR,
          }}
        />

        <div
          style={{
            fontSize: 'clamp(14px, 1.3vw, 18px)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.88)',
            maxWidth: 560,
            marginBottom: 30,
            lineHeight: 1.4,
          }}
        >
          <EditText
            path="hero.tagline"
            defaultValue="Build arguments that move people"
          />
          {course.instructor_name && (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              {' '}— with{' '}
              <EditText
                path="hero.instructor"
                defaultValue={course.instructor_name}
              />
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '13px 22px 13px 14px',
              background: 'white',
              color: 'oklch(0.14 0.006 280)',
              borderRadius: 999,
              boxShadow: '0 8px 28px oklch(0 0 0 / 0.4)',
              border: 'none',
              cursor: 'default',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'oklch(0.14 0.006 280)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 2,
                fontSize: 11,
              }}
            >
              ▶
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
              <EditText path="hero.cta_secondary" defaultValue="Watch trailer" />
            </span>
          </button>
          <button
            type="button"
            style={{
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
              cursor: 'default',
              fontFamily: 'inherit',
            }}
          >
            Enroll{priceLabel ? ` · ${priceLabel}` : ''} →
          </button>
        </div>
      </div>
    </section>
  )
}

// Hero media controls — sits in the top-right corner of the hero. Always
// visible (in edit mode) so creators can find the upload affordance even when
// EditMedia's hover Replace button isn't discoverable. Includes an info icon
// that explains the trailer-then-image peek behaviour (Netflix/YouTube style).
function HeroMediaControls({ hasMedia }: { hasMedia: boolean }) {
  const ed = useEditor()
  const [tipOpen, setTipOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  if (ed.mode !== 'edit') return null

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const upload = ed.uploaderForSlot?.('hero.backdrop') ?? ed.uploadMedia
      const next = await upload(file)
      ed.setMedia('hero.backdrop', { ...next, name: file.name })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 24,
        top: 24,
        zIndex: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={onFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 999,
          background: 'rgba(20,20,22,0.92)',
          color: 'white',
          fontSize: 11.5,
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.10)',
          fontFamily: 'Inter, system-ui, sans-serif',
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Uploading…' : hasMedia ? '↺ Replace media' : '＋ Add media'}
      </button>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="How hero media works"
          onClick={() => setTipOpen((p) => !p)}
          onMouseEnter={() => setTipOpen(true)}
          onMouseLeave={() => setTipOpen(false)}
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.20)',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'help',
            fontFamily: 'inherit',
          }}
        >
          ?
        </button>
        {tipOpen && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              right: 0,
              top: 34,
              width: 260,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(20,20,22,0.95)',
              color: 'white',
              fontSize: 11.5,
              lineHeight: 1.5,
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              fontFamily: 'Inter, system-ui, sans-serif',
              zIndex: 10,
            }}
          >
            <strong style={{ fontSize: 11, letterSpacing: '0.06em' }}>
              UPLOAD A TRAILER + IMAGE
            </strong>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.78)' }}>
              Like Netflix or YouTube — your hero plays the first ~10 seconds of
              the trailer as a peek, then settles on the cover image. Upload
              both for the best effect; one of them works on its own too.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Episode grid (free preview) + paywall ─────────────────────────────────

function EpisodeGrid({
  course,
  freeLessons,
  paidLessons,
  lockedCount,
  priceLabel,
  organizationSlug,
}: {
  course: CourseRead
  freeLessons: CourseLessonRead[]
  paidLessons: CourseLessonRead[]
  lockedCount: number
  priceLabel: string
  organizationSlug?: string
}) {
  const thumbHues = [35, 195, 285, 145, 25, 320]
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <section
      style={{
        padding: '72px 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <EditText
          as="h2"
          path="lessons.heading"
          defaultValue="Free preview"
          style={{
            fontSize: 'calc(clamp(26px, 3vw, 38px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.03em)',
            lineHeight: 1.05,
            margin: '0 0 8px',
            color: 'oklch(0.18 0.008 280)',
            fontFamily: HEADING_VAR,
          }}
        />
        <EditText
          as="p"
          path="lessons.subheading"
          defaultValue={
            freeLessons.length > 0
              ? `Watch the first ${freeLessons.length} ${plural(
                  freeLessons.length,
                  'episode',
                  'episodes',
                )} before you enroll.`
              : 'Mark a lesson as free preview to show it here.'
          }
          multiline
          style={{
            fontSize: 14.5,
            color: 'oklch(0.52 0.008 280)',
            margin: 0,
            fontWeight: 400,
          }}
        />
      </div>

      {freeLessons.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18,
            marginBottom: 40,
          }}
        >
          {freeLessons.map((lesson, i) => {
            const hue = thumbHues[i % thumbHues.length]
            const isHovered = hovered === lesson.id
            return (
              <div
                key={lesson.id}
                onMouseEnter={() => setHovered(lesson.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: 'white',
                  borderRadius: 'calc(20px * var(--radius-mul, 1))',
                  overflow: 'hidden',
                  border: '1px solid oklch(0.92 0.003 280)',
                  cursor: 'pointer',
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: isHovered
                    ? '0 16px 48px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)'
                    : '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)',
                  transition:
                    'transform 250ms cubic-bezier(0.34,1.3,0.64,1), box-shadow 250ms ease',
                }}
              >
                <EpisodeThumb
                  lesson={lesson}
                  index={i + 1}
                  hue={hue}
                  hovered={isHovered}
                />
                <EpisodeInfo
                  course={course}
                  lesson={lesson}
                  index={i + 1}
                  organizationSlug={organizationSlug}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Paywall block */}
      {course.paywall_enabled && lockedCount > 0 && (
        <div
          style={{
            background: 'oklch(0.18 0.008 280)',
            borderRadius: 'calc(20px * var(--radius-mul, 1))',
            overflow: 'hidden',
            marginBottom: 72,
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: '26px 28px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              flexWrap: 'wrap',
              background:
                'radial-gradient(ellipse at 80% 50%, oklch(0.40 0.18 265 / 0.35), transparent 60%)',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 18,
              }}
            >
              🔒
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <EditText
                path="paywall.title"
                defaultValue={`${lockedCount} more ${plural(
                  lockedCount,
                  'lesson',
                  'lessons',
                )}, unlocked when you enroll`}
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'white',
                  display: 'block',
                  marginBottom: 4,
                }}
              />
              <EditText
                path="paywall.subtitle"
                defaultValue="Lifetime access · Workshops · Certificate · 30-day refund"
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  display: 'block',
                  lineHeight: 1.4,
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                flexShrink: 0,
              }}
            >
              {priceLabel && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: '-0.025em',
                      color: 'white',
                    }}
                  >
                    {priceLabel}
                  </span>
                </div>
              )}
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 999,
                  background: 'white',
                  color: 'oklch(0.18 0.008 280)',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'default',
                  fontFamily: 'inherit',
                }}
              >
                <EditText path="paywall.cta" defaultValue="Enroll" /> →
              </button>
            </div>
          </div>

          {/* Locked episode previews */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              padding: '20px 28px 22px',
              overflowX: 'auto',
              alignItems: 'flex-start',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {paidLessons.slice(0, 5).map((lesson, i) => (
              <LockedRowItem
                key={lesson.id}
                lesson={lesson}
                index={freeLessons.length + i + 1}
                hue={thumbHues[i % thumbHues.length]}
              />
            ))}
            {lockedCount > 5 && (
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  paddingLeft: 4,
                  alignSelf: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.28)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  +{lockedCount - 5}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'rgba(255,255,255,0.20)',
                  }}
                >
                  more {plural(lockedCount - 5, 'lesson', 'lessons')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function EpisodeThumb({
  lesson,
  index,
  hue,
  hovered,
}: {
  lesson: CourseLessonRead
  index: number
  hue: number
  hovered: boolean
}) {
  return (
    <EditMedia
      id={`lesson.${lesson.id}.thumb`}
      label={`Episode ${index} thumbnail`}
      style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        background: '#111',
        overflow: 'hidden',
      }}
    >
      {/* Default placeholder gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 30% 40%, oklch(0.42 0.10 ${hue}) 0%, oklch(0.18 0.05 ${
            (hue + 25) % 360
          }) 55%, oklch(0.07 0.01 280) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: 10,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.80)',
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(8px)',
          padding: '3px 7px',
          borderRadius: 4,
          zIndex: 4,
        }}
      >
        EPISODE {index}
      </div>
      <div
        style={{
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
          padding: '3px 8px',
          borderRadius: 5,
          zIndex: 4,
        }}
      >
        ⏱ <span>{fmtLessonTime(lesson.duration_seconds)}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 200ms ease',
          zIndex: 3,
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            color: 'oklch(0.18 0.008 280)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontSize: 16,
          }}
        >
          ▶
        </div>
      </div>
    </EditMedia>
  )
}

function EpisodeInfo({
  course,
  lesson,
  index,
  organizationSlug,
}: {
  course: CourseRead
  lesson: CourseLessonRead
  index: number
  organizationSlug?: string
}) {
  const ed = useEditor()
  const descPath = `lesson.${lesson.id}.description`
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!organizationSlug) {
      setError('AI needs an organization context.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/dashboard/${organizationSlug}/courses/landing-rewrite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'free_preview_description',
            current: ed.t(descPath, ''),
            hint: `Episode ${index} description`,
            intent:
              'Write a single 2-sentence description that hooks the reader. No quotes.',
            context: {
              courseTitle: course.title,
              instructor: course.instructor_name,
              lessonTitle: lesson.title,
              lessonIndex: index,
            },
          }),
        },
      )
      if (!res.ok || !res.body) {
        setError(`Generation failed (${res.status}).`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
      }
      ed.setText(descPath, acc.trim().replace(/^["']|["']$/g, ''))
    } catch (e) {
      setError((e as Error).message ?? 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '16px 18px 18px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'oklch(0.66 0.006 280)',
          marginBottom: 4,
          textTransform: 'uppercase',
        }}
      >
        Episode {index}
      </div>
      <div
        style={{
          fontSize: 15.5,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: 'oklch(0.18 0.008 280)',
          lineHeight: 1.25,
          marginBottom: 7,
        }}
      >
        {lesson.title}
      </div>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <EditText
          path={descPath}
          defaultValue={lesson.description ?? ''}
          multiline
          style={{
            fontSize: 12.5,
            color: 'oklch(0.52 0.008 280)',
            lineHeight: 1.6,
            display: 'block',
            minHeight: '1.6em',
          }}
        />
        {ed.mode === 'edit' && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 999,
                background:
                  'linear-gradient(135deg, oklch(0.96 0.04 280), oklch(0.95 0.05 320))',
                border: '1px solid oklch(0.90 0.04 280)',
                color: 'oklch(0.35 0.18 280)',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✦ {busy ? 'Generating…' : 'Generate description'}
            </button>
            {error && (
              <span style={{ fontSize: 10.5, color: 'oklch(0.55 0.18 25)' }}>
                {error}
              </span>
            )}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11.5,
          color: 'oklch(0.66 0.006 280)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ⏱ <span>{fmtLessonTime(lesson.duration_seconds)}</span>
      </div>
    </div>
  )
}

function LockedRowItem({
  lesson,
  index,
  hue,
}: {
  lesson: CourseLessonRead
  index: number
  hue: number
}) {
  return (
    <div
      style={{
        flex: '0 0 200px',
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        paddingRight: 20,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        marginRight: 20,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 68,
          height: 44,
          borderRadius: 7,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(150deg, oklch(0.80 0.06 ${hue}) 0%, oklch(0.88 0.02 280) 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
          }}
        >
          🔒
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          Episode {index}
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.3,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lesson.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            color: 'rgba(255,255,255,0.24)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ⏱ <span>{fmtLessonTime(lesson.duration_seconds)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Instructor (light) ──────────────────────────────────────────────────────

function Instructor({ course }: { course: CourseRead }) {
  return (
    <section
      style={{
        padding: '72px 32px 80px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'oklch(0.66 0.006 280)',
          marginBottom: 36,
          textTransform: 'uppercase',
        }}
      >
        <EditText path="instructor.eyebrow" defaultValue="YOUR INSTRUCTOR" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.75fr 1fr',
          gap: 60,
          alignItems: 'center',
        }}
      >
        <EditMedia
          id="instructor.portrait"
          label="instructor portrait"
          style={{
            position: 'relative',
            aspectRatio: '4 / 5',
            borderRadius: 'calc(28px * var(--radius-mul, 1))',
            overflow: 'hidden',
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(160deg, oklch(0.42 0.09 35), oklch(0.18 0.05 65))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: 16,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              zIndex: 3,
            }}
          >
            portrait placeholder
          </div>
          {course.instructor_name && (
            <div
              style={{
                position: 'absolute',
                left: 20,
                bottom: 18,
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                textShadow: '0 2px 12px rgba(0,0,0,0.7)',
                zIndex: 3,
              }}
            >
              {course.instructor_name}
            </div>
          )}
        </EditMedia>

        <div>
          <EditText
            as="blockquote"
            path="instructor.quote"
            defaultValue={
              '"Persuasion isn’t convincing. It’s giving someone a way to change their mind without losing face."'
            }
            multiline
            style={{
              fontSize: 'calc(clamp(22px, 2.6vw, 34px) * var(--type-scale, 1))',
              fontWeight: 'var(--h-weight, 500)',
              fontStyle: 'var(--h-italic, normal)',
              letterSpacing: 'calc(var(--h-tracking, 0em) - 0.022em)',
              lineHeight: 1.2,
              margin: '0 0 14px',
              color: 'oklch(0.18 0.008 280)',
              fontFamily: HEADING_VAR,
            }}
          />
          {course.instructor_name && (
            <div
              style={{
                fontSize: 12,
                color: 'oklch(0.66 0.006 280)',
                letterSpacing: '0.04em',
                marginBottom: 28,
              }}
            >
              — {course.instructor_name}
            </div>
          )}
          <EditText
            as="p"
            path="instructor.bio"
            defaultValue={course.instructor_bio ?? ''}
            multiline
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: 'oklch(0.32 0.008 280)',
              margin: '0 0 36px',
              maxWidth: 520,
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: 0,
              paddingTop: 28,
              borderTop: '1px solid oklch(0.92 0.003 280)',
              alignItems: 'flex-start',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  flex: 1,
                  paddingLeft: i === 1 ? 0 : 32,
                  borderLeft:
                    i === 1
                      ? 'none'
                      : '1px solid oklch(0.92 0.003 280)',
                }}
              >
                <EditText
                  path={`cred${i}.num`}
                  defaultValue={['3', '12', '02'][i - 1]}
                  style={{
                    fontSize: 36,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    color: 'oklch(0.18 0.008 280)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <EditText
                  path={`cred${i}.label`}
                  defaultValue={
                    ['Published works', 'Years of practice', 'Spaire courses'][
                      i - 1
                    ]
                  }
                  style={{
                    fontSize: 11.5,
                    color: 'oklch(0.52 0.008 280)',
                    letterSpacing: '0.02em',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────────

function FinalCta({
  freeCount,
  priceLabel,
}: {
  freeCount: number
  priceLabel: string
}) {
  return (
    <section
      style={{
        position: 'relative',
        margin: '0 20px 0',
        padding: '88px 48px 80px',
        background: 'oklch(0.18 0.008 280)',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        overflow: 'hidden',
        isolation: 'isolate',
        textAlign: 'center',
        fontFamily: FONT_VAR,
      }}
    >
      <EditMedia
        id="finalCta.backdrop"
        label="CTA backdrop"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '-10%',
            top: '-40%',
            width: '70%',
            height: '130%',
            background:
              'radial-gradient(ellipse, oklch(0.45 0.18 265 / 0.50) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '-10%',
            bottom: '-40%',
            width: '60%',
            height: '130%',
            background:
              'radial-gradient(ellipse, oklch(0.50 0.15 25 / 0.32) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />
      </EditMedia>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10.5,
            letterSpacing: '0.20em',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'oklch(0.72 0.16 25)',
              boxShadow: '0 0 10px oklch(0.72 0.16 25)',
            }}
          />
          <EditText path="finalCta.label" defaultValue="READY WHEN YOU ARE" />
        </div>
        <EditText
          as="h2"
          path="finalCta.title"
          defaultValue="Start free. Continue when you're ready."
          multiline
          style={{
            fontSize: 'calc(clamp(36px, 5vw, 64px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.04em)',
            lineHeight: 1.02,
            margin: '0 0 14px',
            color: 'white',
            fontFamily: HEADING_VAR,
          }}
        />
        <EditText
          as="p"
          path="finalCta.subtitle"
          defaultValue={
            freeCount > 0
              ? `The first ${freeCount} ${plural(
                  freeCount,
                  'lesson is',
                  'lessons are',
                )} free to preview. No card required.`
              : 'Enroll any time. No card required to peek.'
          }
          multiline
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.50)',
            margin: '0 0 36px',
            lineHeight: 1.55,
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 24px',
              borderRadius: 999,
              background: 'white',
              color: 'oklch(0.18 0.008 280)',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              cursor: 'default',
              fontFamily: 'inherit',
            }}
          >
            Enroll{priceLabel ? ` for ${priceLabel}` : ''} →
          </button>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '14px 22px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'default',
              fontFamily: 'inherit',
            }}
          >
            ▶{' '}
            <EditText
              path="finalCta.secondary"
              defaultValue="Start free preview"
            />
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer({ organizationName }: { organizationName: string }) {
  return (
    <footer
      style={{
        padding: '40px 32px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 24,
          borderTop: '1px solid oklch(0.92 0.003 280)',
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
              color: 'oklch(0.18 0.008 280)',
            }}
          >
            Spaire
          </span>
          <span style={{ fontSize: 11.5, color: 'oklch(0.66 0.006 280)' }}>
            {organizationName} · © {new Date().getFullYear()}
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'oklch(0.66 0.006 280)' }}>
          Premium courses, sold by creators.
        </span>
      </div>
    </footer>
  )
}

