'use client'

// EditableCourseLandingView — mirrors the public landing layout from the design
// bundle (Spaire Course Landing.html / landing-hero.jsx / landing-curriculum.jsx
// / landing-lessons.jsx / landing-instructor.jsx) and weaves EditText, EditMedia,
// and EditBlock through the sections so every visible string is click-to-edit
// and every media tile gets a hover Replace button.
//
// In `preview` mode the wrappers fall through to plain rendering — same tree,
// no affordances.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useEditor } from './EditorContext'
import { EditBlock, EditMedia, EditText } from './EditPrimitives'
import type React from 'react'

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'

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
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Numbered section label ("01" + "OFFICIAL TRAILER")
function NumberLabel({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '1px solid rgba(0,0,0,0.08)',
          color: 'oklch(0.32 0.008 280)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <EditText
        path={`label.${label.toLowerCase().replace(/\s+/g, '_')}`}
        defaultValue={label}
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'oklch(0.52 0.008 280)',
          textTransform: 'uppercase',
        }}
      />
    </div>
  )
}

// ── Top-level ──────────────────────────────────────────────────────────────

export type EditableLandingProps = {
  course: CourseRead
  organizationName: string
  flatLessons: CourseLessonRead[]
}

export function EditableCourseLandingView({
  course,
  organizationName,
  flatLessons,
}: EditableLandingProps) {
  const ed = useEditor()

  const sectionMap: Record<string, { label: string; node: React.ReactNode }> = {
    hero: { label: 'Hero', node: <Hero course={course} flatLessons={flatLessons} /> },
    value: { label: "What's included", node: <ValueStrip /> },
    trailer: { label: 'Trailer', node: <TrailerBlock course={course} /> },
    curriculum: { label: 'Curriculum', node: <CurriculumTimeline /> },
    lessons: {
      label: 'All lessons',
      node: <FullLessonList course={course} flatLessons={flatLessons} />,
    },
    instructor: { label: 'Instructor', node: <Instructor course={course} /> },
    reviews: { label: 'Reviews', node: <Reviews /> },
    finalCta: { label: 'Final CTA', node: <FinalCta /> },
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
      {ed.overrides.order.map((id) => {
        const s = sectionMap[id]
        if (!s) return null
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
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
}) {
  const ed = useEditor()
  const totalDurationSeconds = flatLessons.reduce(
    (a, l) => a + (l.duration_seconds ?? 0),
    0,
  )

  return (
    <section
      style={{
        position: 'relative',
        height: 'min(88vh, 760px)',
        minHeight: 600,
        margin: '20px 20px 0',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
      }}
    >
      <EditMedia
        id="hero.backdrop"
        label="hero backdrop"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
      >
        {/* Default placeholder backdrop: gradient + window light */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 25% 35%, oklch(0.45 0.12 35) 0%, oklch(0.18 0.05 65) 55%, oklch(0.08 0.02 280) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.85) 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      </EditMedia>

      {/* SPAIRE ORIGINAL pill */}
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
            background: 'oklch(0.78 0.16 25)',
            boxShadow: '0 0 12px oklch(0.78 0.16 25)',
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

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          padding: '40px 48px 44px',
          color: 'white',
          fontFamily: FONT_VAR,
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
          <EditText
            path="hero.series_label"
            defaultValue="NEW SERIES"
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
          />
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {flatLessons.length} lessons
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {fmtDuration(totalDurationSeconds)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <EditText
            path="hero.level"
            defaultValue="All levels"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          />
        </div>

        <EditText
          as="h1"
          path="hero.title"
          defaultValue={course.title ?? 'Untitled course'}
          multiline
          style={{
            fontSize: `calc(clamp(56px, 8vw, 104px) * var(--type-scale, 1))`,
            fontWeight: 'var(--h-weight, 700)',
            fontStyle: 'var(--h-italic, normal)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.045em)',
            lineHeight: 'calc(var(--h-leading, 1) * 0.95)',
            margin: '0 0 20px',
            color: 'white',
            maxWidth: '14ch',
            textShadow: '0 2px 30px oklch(0 0 0 / 0.4)',
            fontFamily: 'var(--font-heading, ' + FONT_VAR + ')',
          }}
        />

        <div
          style={{
            fontSize: 'clamp(15px, 1.4vw, 19px)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.92)',
            maxWidth: 600,
            marginBottom: 32,
            lineHeight: 1.4,
          }}
        >
          <EditText
            path="hero.tagline"
            defaultValue="Build arguments that move people"
          />{' '}
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>
            — with{' '}
            <EditText
              path="hero.instructor"
              defaultValue={course.instructor_name ?? ''}
            />
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 24px 12px 14px',
                background: 'white',
                color: 'oklch(0.18 0.008 280)',
                borderRadius: 999,
                border: 'none',
                cursor: ed.mode === 'edit' ? 'default' : 'pointer',
                boxShadow: '0 8px 24px oklch(0 0 0 / 0.3)',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'oklch(0.18 0.008 280)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: 2,
                }}
              >
                ▶
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>
                  Watch trailer
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    color: 'oklch(0.55 0.012 280)',
                    fontWeight: 500,
                    marginTop: 1,
                  }}
                >
                  1 min 34 sec
                </span>
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
              }}
            >
              <EditText path="hero.cta_primary" defaultValue="Enroll · $79" /> →
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 999,
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 500,
            }}
          >
            <span>
              ★{' '}
              <EditText
                path="hero.rating"
                defaultValue="4.9"
                style={{ fontWeight: 700 }}
              />{' '}
              (
              <EditText path="hero.rating_count" defaultValue="2,814" />)
            </span>
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />
            <EditText path="hero.students" defaultValue="38,200 enrolled" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Value strip ─────────────────────────────────────────────────────────────

const VALUE_DEFAULTS = [
  { title: '22 lessons, structured', desc: 'Six sections that build on each other.' },
  { title: 'Workshops & assignments', desc: 'Three real projects with feedback.' },
  { title: 'Peer feedback', desc: 'A small, moderated cohort reads your drafts.' },
  { title: 'Certificate on completion', desc: 'Issued when you finish all assignments.' },
]

function ValueStrip() {
  return (
    <section style={{ padding: '96px 32px 48px', maxWidth: 1320, margin: '0 auto' }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'oklch(0.66 0.006 280)',
          marginBottom: 32,
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      >
        <EditText path="value.label" defaultValue="WHAT'S INCLUDED" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {VALUE_DEFAULTS.map((v, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              padding: '24px 28px 28px',
              borderLeft: i === 0 ? 'none' : '1px solid oklch(0.92 0.003 280)',
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
                background: 'oklch(0.18 0.008 280)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              ◇
            </div>
            <EditText
              path={`value.${i}.title`}
              defaultValue={v.title}
              multiline
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: 'oklch(0.18 0.008 280)',
                marginTop: 6,
              }}
            />
            <EditText
              path={`value.${i}.desc`}
              defaultValue={v.desc}
              multiline
              style={{
                fontSize: 13,
                color: 'oklch(0.52 0.008 280)',
                lineHeight: 1.55,
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: 20,
                top: 20,
                fontSize: 11,
                fontWeight: 600,
                color: 'oklch(0.66 0.006 280)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Trailer ─────────────────────────────────────────────────────────────────

function TrailerBlock({ course: _course }: { course: CourseRead }) {
  return (
    <section
      id="preview-trailer"
      style={{ padding: '64px 32px 24px', maxWidth: 1180, margin: '0 auto' }}
    >
      <NumberLabel n="01" label="OFFICIAL TRAILER" />
      <EditMedia
        id="trailer.video"
        label="trailer video"
        style={{
          position: 'relative',
          aspectRatio: '21 / 9',
          background: '#000',
          borderRadius: 'calc(28px * var(--radius-mul, 1))',
          overflow: 'hidden',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.12)',
        }}
      >
        {/* Default placeholder scene */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 35% 45%, oklch(0.40 0.10 25) 0%, oklch(0.16 0.04 280) 60%, #000 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 24,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.04em',
            zIndex: 4,
          }}
        >
          trailer placeholder
        </div>
        <button
          type="button"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            color: 'oklch(0.18 0.008 280)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 4,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            zIndex: 4,
            border: 'none',
            fontSize: 28,
            cursor: 'default',
          }}
        >
          ▶
        </button>
      </EditMedia>
    </section>
  )
}

// ── Curriculum timeline ────────────────────────────────────────────────────

const CHAPTER_DEFAULTS = [
  { title: 'Foundations', lessons: 4, hue: 35 },
  { title: 'Reading the Reader', lessons: 3, hue: 195 },
  { title: 'Structure & Cadence', lessons: 4, hue: 285 },
  { title: 'Concession & Pressure', lessons: 3, hue: 145 },
  { title: 'Workshops', lessons: 4, hue: 25 },
  { title: 'Voice on the Page', lessons: 4, hue: 320 },
]

function CurriculumTimeline() {
  return (
    <section style={{ padding: '64px 32px 48px', maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <NumberLabel n="02" label="CURRICULUM" />
        <EditText
          as="h2"
          path="curriculum.heading"
          defaultValue="Six chapters, built to compound."
          multiline
          style={{
            fontSize: 'calc(clamp(36px, 5vw, 56px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.035em)',
            lineHeight: 'calc(var(--h-leading, 1) * 1.05)',
            margin: 0,
            color: 'oklch(0.18 0.008 280)',
            fontFamily: 'var(--font-heading, ' + FONT_VAR + ')',
          }}
        />
        <EditText
          as="p"
          path="curriculum.subheading"
          defaultValue="Every chapter assumes the last. Watch in order — or don't. The lessons unlock the moment you enroll."
          multiline
          style={{
            fontSize: 16,
            color: 'oklch(0.52 0.008 280)',
            margin: '20px 0 0',
            lineHeight: 1.55,
            maxWidth: 560,
          }}
        />
      </div>
      <div style={{ overflowX: 'auto', margin: '0 -32px', padding: '0 32px 12px' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {CHAPTER_DEFAULTS.map((s, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 280px',
                background: 'white',
                border: '1px solid oklch(0.92 0.003 280)',
                borderRadius: 'calc(20px * var(--radius-mul, 1))',
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              <EditMedia
                id={`curriculum.${i + 1}`}
                label={`Chapter ${i + 1} cover`}
                style={{
                  aspectRatio: '4 / 3',
                  background: `linear-gradient(150deg, oklch(0.45 0.12 ${s.hue}) 0%, oklch(0.20 0.05 ${(s.hue + 30) % 360}) 100%)`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: 'white',
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      opacity: 0.85,
                      textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                    }}
                  >
                    CHAPTER {String(i + 1).padStart(2, '0')}
                  </div>
                  <EditText
                    path={`curriculum.${i + 1}.title`}
                    defaultValue={s.title}
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                    }}
                  />
                </div>
              </EditMedia>
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
                    color: 'oklch(0.32 0.008 280)',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: `oklch(0.55 0.15 ${s.hue})`,
                    }}
                  />
                  {s.lessons} lessons
                </div>
                <span style={{ color: 'oklch(0.66 0.006 280)' }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Full lesson list (real lessons from course) ────────────────────────────

function FullLessonList({
  course,
  flatLessons,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
}) {
  const ed = useEditor()
  const paywallAt = course.paywall_position ?? null
  const free = paywallAt != null ? flatLessons.slice(0, paywallAt) : []
  const paid = paywallAt != null ? flatLessons.slice(paywallAt) : flatLessons

  return (
    <section style={{ padding: '64px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 40, maxWidth: 640 }}>
        <NumberLabel n="03" label="EVERY LESSON" />
        <EditText
          as="h2"
          path="lessons.heading"
          defaultValue="The full arc."
          style={{
            fontSize: 'calc(clamp(36px, 5vw, 56px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.035em)',
            lineHeight: 1.05,
            margin: 0,
            color: 'oklch(0.18 0.008 280)',
            fontFamily: 'var(--font-heading, ' + FONT_VAR + ')',
          }}
        />
        <EditText
          as="p"
          path="lessons.subheading"
          defaultValue="The first lessons are free to preview. Enroll to unlock the rest."
          multiline
          style={{
            fontSize: 15,
            color: 'oklch(0.52 0.008 280)',
            margin: '20px 0 0',
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        />
      </div>
      <div
        style={{
          border: '1px solid oklch(0.92 0.003 280)',
          borderRadius: 'calc(20px * var(--radius-mul, 1))',
          overflow: 'hidden',
          background: 'white',
        }}
      >
        {free.length > 0 && (
          <div>
            {free.map((l, i) => (
              <LessonRow key={l.id} lesson={l} index={i + 1} locked={false} />
            ))}
          </div>
        )}
        {free.length > 0 && paid.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 28px',
              background: 'oklch(0.96 0.005 280)',
              borderTop: '1px solid oklch(0.92 0.003 280)',
              borderBottom: '1px solid oklch(0.92 0.003 280)',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'oklch(0.45 0.18 265)',
            }}
          >
            🔒 Members only
          </div>
        )}
        {paid.map((l, i) => (
          <LessonRow
            key={l.id}
            lesson={l}
            index={(free.length || 0) + i + 1}
            locked={paywallAt != null && i + free.length >= paywallAt}
          />
        ))}
      </div>
      {/* Paywall callout (rendered when paywall is set) */}
      {paywallAt != null && course.paywall_enabled && ed.mode === 'edit' && (
        <div
          style={{
            position: 'relative',
            marginTop: 24,
            borderRadius: 'calc(20px * var(--radius-mul, 1))',
            overflow: 'hidden',
            background: 'oklch(0.18 0.008 280)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 12px 32px rgba(0,0,0,0.08)',
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
                fontSize: 20,
              }}
            >
              🔒
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <EditText
                path="paywall.title"
                defaultValue={`Unlock all ${flatLessons.length} lessons`}
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'white',
                  display: 'block',
                }}
              />
              <EditText
                path="paywall.subtitle"
                defaultValue="Lifetime · Workshops · Certificate · 30-day refund"
                style={{
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.65)',
                  marginTop: 3,
                  display: 'block',
                }}
              />
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
                color: 'oklch(0.18 0.008 280)',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
              }}
            >
              <EditText path="paywall.cta" defaultValue="Enroll" /> →
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function LessonRow({
  lesson,
  index,
  locked,
}: {
  lesson: CourseLessonRead
  index: number
  locked: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px 14px 70px',
        borderBottom: '1px solid oklch(0.945 0.003 280)',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'oklch(0.66 0.006 280)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(index).padStart(2, '0')}
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'oklch(0.18 0.008 280)',
            }}
          >
            {lesson.title}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              color: 'oklch(0.52 0.008 280)',
              marginTop: 3,
            }}
          >
            ⏱ <span>{fmtLessonTime(lesson.duration_seconds)}</span>
            {!locked && lesson.is_free_preview && (
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
            )}
          </div>
        </div>
      </div>
      <div>
        {locked ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'oklch(0.95 0.003 280)',
              color: 'oklch(0.66 0.006 280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🔒
          </div>
        ) : (
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 14px',
              borderRadius: 999,
              background: 'oklch(0.18 0.008 280)',
              color: 'white',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              cursor: 'default',
            }}
          >
            ▶ Watch
          </button>
        )}
      </div>
    </div>
  )
}

// ── Instructor ──────────────────────────────────────────────────────────────

function Instructor({ course }: { course: CourseRead }) {
  return (
    <section style={{ padding: '64px 32px', maxWidth: 1180, margin: '0 auto' }}>
      <NumberLabel n="04" label="YOUR INSTRUCTOR" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.85fr 1fr',
          gap: 48,
          alignItems: 'center',
        }}
      >
        <EditMedia
          id="instructor.portrait"
          label="portrait"
          style={{
            position: 'relative',
            aspectRatio: '4 / 5',
            borderRadius: 'calc(28px * var(--radius-mul, 1))',
            overflow: 'hidden',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(160deg, oklch(0.45 0.10 35), oklch(0.20 0.05 65))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 18,
              top: 18,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              zIndex: 3,
            }}
          >
            portrait placeholder
          </div>
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
              zIndex: 3,
            }}
          >
            <EditText
              path="hero.instructor"
              defaultValue={course.instructor_name ?? ''}
            />
          </div>
        </EditMedia>
        <div>
          <EditText
            as="h2"
            path="instructor.quote"
            defaultValue={'"Persuasion isn’t convincing. It’s giving someone a way to change their mind without losing face."'}
            multiline
            style={{
              fontSize: 'calc(clamp(28px, 3.4vw, 42px) * var(--type-scale, 1))',
              fontWeight: 'var(--h-weight, 500)',
              letterSpacing: 'calc(var(--h-tracking, 0em) - 0.025em)',
              lineHeight: 1.15,
              margin: '0 0 16px',
              color: 'oklch(0.18 0.008 280)',
              fontFamily: 'var(--font-heading, ' + FONT_VAR + ')',
            }}
          />
          <div
            style={{
              fontSize: 12.5,
              color: 'oklch(0.52 0.008 280)',
              letterSpacing: '0.04em',
              marginBottom: 28,
            }}
          >
            —{' '}
            <EditText
              path="hero.instructor"
              defaultValue={course.instructor_name ?? ''}
            />
            , on lesson 02
          </div>
          <EditText
            as="p"
            path="instructor.bio"
            defaultValue={course.instructor_bio ?? ''}
            multiline
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: 'oklch(0.32 0.008 280)',
              margin: '0 0 32px',
              maxWidth: 540,
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 40,
              paddingTop: 24,
              borderTop: '1px solid oklch(0.92 0.003 280)',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <EditText
                  path={`cred${i}.num`}
                  defaultValue={['3', '12', '02'][i - 1]}
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    letterSpacing: '-0.025em',
                    color: 'oklch(0.18 0.008 280)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <EditText
                  path={`cred${i}.label`}
                  defaultValue={
                    ['Published novels', 'Years in court', 'Spaire courses'][
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

// ── Reviews ────────────────────────────────────────────────────────────────

const REVIEW_DEFAULTS = [
  {
    name: 'Marisol Quan',
    role: 'Communications lead',
    text: "I came in skeptical and left rewriting an email I'd been avoiding for three weeks.",
  },
  {
    name: 'Theo Vance',
    role: 'Founder, early-stage',
    text: 'The "three-beat" framing has quietly reorganized how I plan every memo.',
  },
  {
    name: 'Nadia Okonkwo',
    role: 'Litigator',
    text: 'For legal writing — the chapter on concession is the most useful 10 minutes I’ve spent on rhetoric in years.',
  },
]

function Reviews() {
  return (
    <section style={{ padding: '64px 32px', maxWidth: 1320, margin: '0 auto' }}>
      <NumberLabel n="05" label="FROM STUDENTS" />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 40,
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontSize: 'calc(clamp(48px, 7vw, 88px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.04em)',
            lineHeight: 0.95,
            margin: 0,
            color: 'oklch(0.18 0.008 280)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: 'var(--font-heading, ' + FONT_VAR + ')',
          }}
        >
          Rated{' '}
          <EditText
            path="reviews.rating"
            defaultValue="4.9"
            style={{ fontStyle: 'italic', fontWeight: 300 }}
          />
          <span style={{ fontWeight: 300, color: 'oklch(0.66 0.006 280)' }}>/</span>
          <span style={{ fontWeight: 300, color: 'oklch(0.66 0.006 280)' }}>5</span>
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {REVIEW_DEFAULTS.map((r, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              background: 'white',
              border: '1px solid oklch(0.92 0.003 280)',
              borderRadius: 'calc(20px * var(--radius-mul, 1))',
              padding: 28,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 80,
                lineHeight: 0.6,
                color: 'var(--accent, oklch(0.55 0.20 265))',
                opacity: 0.3,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              "
            </div>
            <EditText
              as="p"
              path={`reviews.${i}.text`}
              defaultValue={r.text}
              multiline
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: 'oklch(0.18 0.008 280)',
                margin: '0 0 24px',
                fontWeight: 400,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingTop: 16,
                borderTop: '1px solid oklch(0.92 0.003 280)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background:
                    'linear-gradient(135deg, var(--accent, oklch(0.55 0.20 265)), var(--accent-2, oklch(0.62 0.16 285)))',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {r.name[0]}
              </div>
              <div>
                <EditText
                  path={`reviews.${i}.name`}
                  defaultValue={r.name}
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: 'oklch(0.18 0.008 280)',
                    display: 'block',
                  }}
                />
                <EditText
                  path={`reviews.${i}.role`}
                  defaultValue={r.role}
                  style={{
                    fontSize: 12,
                    color: 'oklch(0.52 0.008 280)',
                    display: 'block',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section
      style={{
        position: 'relative',
        margin: '64px 20px 0',
        padding: '88px 32px 80px',
        background: 'oklch(0.18 0.008 280)',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        overflow: 'hidden',
        isolation: 'isolate',
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
      </EditMedia>
      <div
        style={{
          position: 'relative',
          zIndex: 2,
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
          <EditText path="finalCta.label" defaultValue="READY WHEN YOU ARE" />
        </div>
        <EditText
          as="h2"
          path="finalCta.title"
          defaultValue="Start free. Continue when you're ready."
          multiline
          style={{
            fontSize: 'calc(clamp(40px, 6vw, 72px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.04em)',
            lineHeight: 1.02,
            margin: '0 0 16px',
            color: 'white',
            fontFamily: 'var(--font-heading, ' + FONT_VAR + ')',
          }}
        />
        <EditText
          as="p"
          path="finalCta.subtitle"
          defaultValue="The first three lessons are free to preview. No card required."
          multiline
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.7)',
            margin: '0 0 36px',
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginBottom: 36,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 22px 14px 24px',
              borderRadius: 999,
              background: 'white',
              color: 'oklch(0.18 0.008 280)',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              border: 'none',
              cursor: 'default',
            }}
          >
            <EditText path="finalCta.primary" defaultValue="Enroll for $79" /> →
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
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'default',
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
      style={{ padding: '48px 32px', maxWidth: 1320, margin: '0 auto' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 28,
          borderTop: '1px solid oklch(0.92 0.003 280)',
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
              color: 'oklch(0.18 0.008 280)',
            }}
          >
            Spaire
          </span>
          <span style={{ fontSize: 11.5, color: 'oklch(0.66 0.006 280)' }}>
            {organizationName}
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'oklch(0.66 0.006 280)' }}>
          Premium courses, sold by creators.
        </span>
      </div>
    </footer>
  )
}
