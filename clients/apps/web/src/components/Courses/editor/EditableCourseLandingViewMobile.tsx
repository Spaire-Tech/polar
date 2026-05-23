'use client'

// Mobile landing — vertical, cinematic, Apple-TV-flavored layout that maps
// onto the same `landing_overrides` / `course` / `flatLessons` props as the
// desktop view. Edit affordances (EditText / EditMedia) are reused so values
// the creator edits in the studio flow through when the device toggle is set
// to mobile or when the page is viewed on a real phone.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import type { schemas } from '@spaire/client'
import { useMemo, useState } from 'react'
import { TrailerModal } from './EditableCourseLandingView'
import { useEditor } from './EditorContext'
import { EditMedia, EditText } from './EditPrimitives'
import { EpisodeCarousel } from './EpisodeCarousel'
import { LearnItemSheet } from './LearnItemSheet'
import { SectionModuleSheet } from './SectionModuleSheet'

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'
const HEADING_VAR = 'var(--font-heading, ' + FONT_VAR + ')'

const SECTION_HUES = [35, 195, 285, 145, 25, 320]

function fmtDuration(secs: number) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function fmtMinutes(secs?: number | null) {
  if (!secs) return '—'
  const m = Math.max(1, Math.round(secs / 60))
  return `${m}m`
}

// ── Hero ───────────────────────────────────────────────────────────────────

export function MobileHero({
  course,
  flatLessons,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
  priceLabel: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
}) {
  const ed = useEditor()
  const [trailerOpen, setTrailerOpen] = useState(false)
  const totalDurationSeconds = flatLessons.reduce(
    (a, l) => a + (l.duration_seconds ?? 0),
    0,
  )
  const totalDuration = totalDurationSeconds
    ? fmtDuration(totalDurationSeconds)
    : null

  const heroImage = ed.m('hero.backdrop')
  const heroTrailer = ed.m('hero.trailer')
  const trailerUrl =
    (heroTrailer && heroTrailer.kind === 'video' ? heroTrailer.url : null) ??
    (heroImage && heroImage.kind === 'video' ? heroImage.url : null) ??
    course.trailer_url ??
    null
  const backdropUrl =
    (heroImage && heroImage.kind === 'image' ? heroImage.url : null) ??
    course.thumbnail_url ??
    null
  const backdropObjectPosition =
    (heroImage && heroImage.kind === 'image'
      ? heroImage.objectPosition
      : null) ??
    course.thumbnail_object_position ??
    null
  const canPlayTrailer = !!trailerUrl

  return (
    <section
      style={{
        position: 'relative',
        // Apple-TV-app-style hero: cover artwork extends to every edge of
        // the screen including BEHIND the status bar at the top.
        //
        // The page sits inside a wrapper (`PublicLayout`) that adds
        // `px-4 py-4` on mobile, so to actually reach the screen edges we
        // break out of that wrapper with viewport-relative values:
        //   - width: 100vw + marginLeft: calc(50% - 50vw) → ignores the
        //     wrapper's 16px horizontal padding and any max-width / center
        //     constraints.
        //   - marginTop pulls up by the wrapper's 16px top padding PLUS
        //     env(safe-area-inset-top) so the image extends behind the
        //     iOS status bar (the route's layout sets viewportFit=cover so
        //     Safari actually allows this).
        // Height is a reasonable portion of the viewport — NOT 100svh —
        // so the rest of the page (CTAs, description, FAQ, etc.) still
        // sits below in the natural document flow, mirroring Apple TV's
        // "image + title overlay above, dark content section below"
        // structure.
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginTop: 'calc(-1 * (env(safe-area-inset-top, 0px) + 24px))',
        height: 'clamp(560px, 82svh, 760px)',
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
      }}
    >
      <EditMedia
        id="hero.backdrop"
        label="hero image"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
        renderMedia={() => null}
      >
        <MobileHeroBackdrop
          imageUrl={backdropUrl}
          objectPosition={backdropObjectPosition}
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
            'linear-gradient(180deg, oklch(0 0 0 / 0.45) 0%, oklch(0 0 0 / 0.05) 22%, oklch(0 0 0 / 0) 40%, oklch(0 0 0 / 0.55) 75%, oklch(0 0 0 / 0.92) 100%)',
        }}
      />

      {/* Top tag — pushed below the status bar / notch on real devices */}
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 'calc(env(safe-area-inset-top, 0px) + 18px)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10,
          letterSpacing: '0.20em',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.82)',
          fontFamily: FONT_VAR,
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
        <EditText path="hero.eyebrow" defaultValue="SPAIRE ORIGINAL" />
      </div>

      {/* Bottom content stack — bottom padding includes the home-indicator
          inset so the CTA isn't hidden behind it on a real device */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding:
            '24px 22px calc(env(safe-area-inset-bottom, 0px) + 30px)',
          color: 'white',
          zIndex: 3,
          fontFamily: FONT_VAR,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 14,
            fontSize: 11,
            color: 'rgba(255,255,255,0.65)',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              padding: '3px 9px',
              background: 'rgba(255,255,255,0.13)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.20)',
              fontSize: 9,
              letterSpacing: '0.14em',
              fontWeight: 600,
              color: 'white',
            }}
          >
            <EditText path="hero.series_label" defaultValue="NEW SERIES" />
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>
            {flatLessons.length} lessons
          </span>
          {totalDuration && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
              <span style={{ whiteSpace: 'nowrap' }}>{totalDuration}</span>
            </>
          )}
        </div>

        <h1
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-0.045em',
            lineHeight: 0.95,
            margin: '0 0 14px',
            color: 'white',
            textWrap: 'balance',
            textShadow: '0 2px 30px oklch(0 0 0 / 0.40)',
            fontFamily: HEADING_VAR,
          }}
        >
          <EditText path="hero.title" defaultValue={course.title ?? ''} multiline />
        </h1>

        <div
          style={{
            fontSize: 13.5,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.86)',
            marginBottom: 22,
            letterSpacing: '-0.005em',
            lineHeight: 1.4,
            textWrap: 'pretty',
          }}
        >
          <EditText
            path="hero.tagline"
            defaultValue={course.description ?? ''}
            multiline
          />
          {course.instructor_name && (
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>
              {' — with '}
              <EditText
                path="hero.instructor"
                defaultValue={course.instructor_name ?? ''}
              />
            </span>
          )}
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <button
            type="button"
            onClick={() => canPlayTrailer && setTrailerOpen(true)}
            disabled={!canPlayTrailer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px 11px 11px',
              background: 'white',
              color: 'oklch(0.14 0.006 280)',
              borderRadius: 999,
              boxShadow: '0 6px 22px oklch(0 0 0 / 0.40)',
              border: 'none',
              cursor: canPlayTrailer ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              flex: '1 1 auto',
              minWidth: 0,
              justifyContent: 'center',
              opacity: canPlayTrailer ? 1 : 0.55,
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'oklch(0.14 0.006 280)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 2,
                flexShrink: 0,
              }}
            >
              <PlayIcon size={12} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>
              Watch trailer
            </span>
          </button>
          <button
            type="button"
            onClick={onEnroll}
            disabled={enrolling || !canEnroll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.20)',
              color: 'white',
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: enrolling || !canEnroll ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              flex: '1 1 auto',
              minWidth: 0,
              justifyContent: 'center',
              opacity: enrolling || !canEnroll ? 0.7 : 1,
            }}
          >
            <span>
              {enrolling ? 'Enrolling…' : `Enroll · ${priceLabel || ''}`.trim()}
            </span>
            <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>
      {trailerOpen && trailerUrl && (
        <TrailerModal url={trailerUrl} onClose={() => setTrailerOpen(false)} />
      )}
    </section>
  )
}

function MobileHeroBackdrop({
  imageUrl,
  objectPosition,
}: {
  imageUrl: string | null
  objectPosition?: string | null
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: objectPosition ?? '50% 50%',
        }}
      />
    )
  }
  const hue = 35
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 28%, oklch(0.46 0.12 ${hue}) 0%, oklch(0.18 0.05 ${(hue + 20) % 360}) 55%, oklch(0.05 0.01 280) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          top: '5%',
          width: '60%',
          height: '60%',
          background:
            'radial-gradient(ellipse, oklch(0.88 0.08 75 / 0.30) 0%, transparent 65%)',
          filter: 'blur(40px)',
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
    </div>
  )
}

// ── Sections roadmap ──────────────────────────────────────────────────────

export function MobileSectionsRoadmap({
  course,
  flatLessons,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
}) {
  const modules = [...course.modules].sort((a, b) => a.position - b.position)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  // Hide the sections roadmap entirely for series — flat episode list only.
  if (course.format === 'series') return null

  // Group lessons by module so we can show the per-section list when the
  // user taps a card, and so the lesson count under each card stays
  // accurate on the public landing (where mod.lessons is empty and the
  // real lesson list lives in `flatLessons` only).
  const lessonsByModule = useMemo(() => {
    const map = new Map<string, CourseLessonRead[]>()
    for (const lesson of flatLessons) {
      if (!lesson.module_id) continue
      const list = map.get(lesson.module_id)
      if (list) list.push(lesson)
      else map.set(lesson.module_id, [lesson])
    }
    return map
  }, [flatLessons])
  const lessonsFor = (mod: CourseRead['modules'][number]) => {
    const grouped = lessonsByModule.get(mod.id)
    if (grouped && grouped.length > 0) return grouped
    return mod.lessons ?? []
  }
  const openModule = openIdx !== null ? modules[openIdx] : null

  return (
    <section
      style={{
        padding: '48px 20px 32px',
        background: 'var(--bg-0, white)',
        fontFamily: FONT_VAR,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: 'var(--fg-3, oklch(0.66 0.006 280))',
            marginBottom: 10,
          }}
        >
          <EditText path="sections.eyebrow" defaultValue="The course" />
        </div>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            margin: '0 0 8px',
            color: 'var(--fg-0, oklch(0.18 0.008 280))',
            textWrap: 'balance',
            fontFamily: HEADING_VAR,
          }}
        >
          <EditText
            path="sections.heading"
            defaultValue={`${modules.length} sections, in order`}
            multiline
          />
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--fg-2, oklch(0.52 0.008 280))',
            margin: 0,
            fontWeight: 400,
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          <EditText
            path="sections.subheading"
            defaultValue="Each section builds on the last."
            multiline
          />
        </p>
      </div>

      <div style={{ position: 'relative', paddingTop: 6 }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 12,
            bottom: 12,
            width: 1.5,
            background: 'var(--line, oklch(0.92 0.003 280))',
            transform: 'translateX(-50%)',
          }}
        />
        {modules.map((mod, i) => {
          const hue = SECTION_HUES[i % SECTION_HUES.length]
          const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right'
          const lessonCount = lessonsFor(mod).length
          return (
            <div
              key={mod.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 24px 1fr',
                alignItems: 'center',
                marginBottom: 20,
                position: 'relative',
              }}
            >
              <div
                style={{
                  gridColumn: '2 / 3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'var(--bg-0, white)',
                    border: '1.5px solid var(--fg-3, oklch(0.66 0.006 280))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--fg-3, oklch(0.66 0.006 280))',
                    }}
                  />
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenIdx(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpenIdx(i)
                  }
                }}
                style={{
                  position: 'relative',
                  gridColumn: side === 'left' ? '1 / 2' : '3 / 4',
                  background: 'var(--bg-1, white)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid var(--line-soft, oklch(0.945 0.003 280))',
                  boxShadow:
                    '0 1px 2px oklch(0 0 0 / 0.04), 0 10px 24px oklch(0 0 0 / 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                }}
              >
                <EditMedia
                  id={`sections.module.${mod.id}.image`}
                  label={`Section ${i + 1} image`}
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '5 / 3',
                    background: '#111',
                    overflow: 'hidden',
                  }}
                  placeholder={<SectionThumbFallback hue={hue} n={i + 1} />}
                />
                <div style={{ padding: '12px 12px' }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--fg-3, oklch(0.66 0.006 280))',
                      marginBottom: 4,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Section {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      color: 'var(--fg-0, oklch(0.18 0.008 280))',
                      lineHeight: 1.25,
                      marginBottom: 4,
                    }}
                  >
                    <EditText
                      path={`sections.module.${mod.id}.title`}
                      defaultValue={mod.title}
                      multiline
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--fg-3, oklch(0.66 0.006 280))',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
                  </div>
                </div>

                {/* Pointer toward center line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 24,
                    width: 0,
                    height: 0,
                    borderTop: '8px solid transparent',
                    borderBottom: '8px solid transparent',
                    filter:
                      'drop-shadow(0 1px 0 var(--line-soft, oklch(0.945 0.003 280)))',
                    ...(side === 'left'
                      ? {
                          right: -8,
                          borderLeft: '8px solid var(--bg-1, white)',
                          borderRight: 'none',
                        }
                      : {
                          left: -8,
                          borderRight: '8px solid var(--bg-1, white)',
                          borderLeft: 'none',
                        }),
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {openModule && openIdx !== null && (
        <SectionModuleSheet
          module={openModule}
          index={openIdx}
          lessons={lessonsFor(openModule)}
          onClose={() => setOpenIdx(null)}
          placeholder={
            <SectionThumbFallback
              hue={SECTION_HUES[openIdx % SECTION_HUES.length]}
              n={openIdx + 1}
            />
          }
        />
      )}
    </section>
  )
}

function SectionThumbFallback({ hue, n }: { hue: number; n: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: `linear-gradient(135deg, oklch(0.34 0.07 ${hue}) 0%, oklch(0.18 0.04 ${
          (hue + 30) % 360
        }) 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 8.5,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 500,
        }}
      >
        §{n}
      </div>
    </div>
  )
}

// ── Episodes (free preview) + paywall ─────────────────────────────────────

export function MobileEpisodes({
  course,
  product,
  freeLessons,
  paidLessons,
  lockedCount,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
  onOpenLesson,
  courseThumbnailUrl,
  courseThumbnailObjectPosition,
}: {
  course: CourseRead
  product?: schemas['Product']
  freeLessons: CourseLessonRead[]
  paidLessons: CourseLessonRead[]
  lockedCount: number
  priceLabel: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
  onOpenLesson?: (lesson: CourseLessonRead) => void
  /** Fallback cover when a paid lesson has no thumbnail of its own. */
  courseThumbnailUrl?: string | null
  courseThumbnailObjectPosition?: string | null
}) {
  return (
    <section
      style={{
        padding: '40px 0 24px',
        background: 'var(--bg-0, white)',
        fontFamily: FONT_VAR,
      }}
    >
      <div style={{ padding: '0 20px', marginBottom: 18 }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            margin: '0 0 6px',
            color: 'var(--fg-0, oklch(0.18 0.008 280))',
            fontFamily: HEADING_VAR,
          }}
        >
          <EditText path="lessons.heading" defaultValue="Free preview" />
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--fg-2, oklch(0.52 0.008 280))',
            margin: 0,
            fontWeight: 400,
          }}
        >
          <EditText
            path="lessons.subheading"
            defaultValue={`Watch the first ${freeLessons.length} ${
              freeLessons.length === 1 ? 'episode' : 'episodes'
            } before you enroll.`}
            multiline
          />
        </p>
      </div>

      {/* WebKit scrollbar hide for the horizontal episode strip */}
      <style>{`
        .spaire-mobile-h-snap::-webkit-scrollbar { display: none; }
      `}</style>

      {freeLessons.length > 0 && (
        <div
          className="spaire-mobile-h-snap"
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            padding: '0 20px 8px',
            scrollbarWidth: 'none',
          }}
        >
          {freeLessons.map((lesson, i) => {
            const hue = SECTION_HUES[i % SECTION_HUES.length]
            return (
              <article
                key={lesson.id}
                onClick={() => onOpenLesson?.(lesson)}
                style={{
                  width: 280,
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  borderRadius: 18,
                  overflow: 'hidden',
                  background: '#0a0a0a',
                  boxShadow:
                    '0 1px 2px oklch(0 0 0 / 0.06), 0 12px 32px oklch(0 0 0 / 0.10)',
                  border: '1px solid oklch(0.20 0.005 280)',
                  cursor: onOpenLesson ? 'pointer' : 'default',
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
                  <EpisodeThumb
                    imageUrl={lesson.thumbnail_url ?? null}
                    objectPosition={lesson.thumbnail_object_position ?? null}
                    hue={hue}
                    n={i + 1}
                  />
                  {/* dim wash for legibility */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.92) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* copy stack */}
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
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        letterSpacing: '0.16em',
                        color: 'rgba(255,255,255,0.65)',
                        marginBottom: 6,
                      }}
                    >
                      EPISODE {i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                        color: 'white',
                        marginBottom: 8,
                        textShadow: '0 2px 14px rgba(0,0,0,0.5)',
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
                  {/* footer row */}
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
                      }}
                    >
                      <PlayIcon size={11} />
                      <span>{fmtMinutes(lesson.duration_seconds)}</span>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
          <div style={{ width: 6, flexShrink: 0 }} aria-hidden />
        </div>
      )}

      {/* Series replaces the members-only paywall card with a horizontal
          carousel of the locked episodes (clicking a card opens the
          enroll-to-watch modal). Courses keep the standard paywall card. */}
      {course.format === 'series' && lockedCount > 0 && (
        <EpisodeCarousel
          course={course}
          product={product}
          paidLessons={paidLessons}
          priceLabel={priceLabel}
          onEnroll={onEnroll}
          enrolling={enrolling}
          canEnroll={canEnroll}
          variant="mobile"
        />
      )}
      {course.format !== 'series' && lockedCount > 0 && (
        <div style={{ padding: '32px 16px 0' }}>
          <MobilePaywall
            paidLessons={paidLessons}
            lockedCount={lockedCount}
            priceLabel={priceLabel}
            onEnroll={onEnroll}
            enrolling={enrolling}
            canEnroll={canEnroll}
            courseThumbnailUrl={courseThumbnailUrl}
            courseThumbnailObjectPosition={courseThumbnailObjectPosition}
          />
        </div>
      )}
    </section>
  )
}

function EpisodeThumb({
  imageUrl,
  objectPosition,
  hue,
  n,
}: {
  imageUrl: string | null
  objectPosition: string | null
  hue: number
  n: number
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: objectPosition ?? '50% 50%',
        }}
      />
    )
  }
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 35%, oklch(0.46 0.10 ${hue}) 0%, oklch(0.18 0.05 ${
            (hue + 25) % 360
          }) 55%, oklch(0.07 0.01 280) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, monospace',
          color: 'rgba(255,255,255,0.20)',
          fontSize: 11,
          letterSpacing: '0.08em',
        }}
      >
        EP {n}
      </div>
    </div>
  )
}

function MobilePaywall({
  paidLessons,
  lockedCount,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
  courseThumbnailUrl,
  courseThumbnailObjectPosition,
}: {
  paidLessons: CourseLessonRead[]
  lockedCount: number
  priceLabel: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
  courseThumbnailUrl?: string | null
  courseThumbnailObjectPosition?: string | null
}) {
  const peek = paidLessons.slice(0, 3)
  const remaining = lockedCount - peek.length
  const hues = SECTION_HUES

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 22,
        overflow: 'hidden',
        isolation: 'isolate',
        padding: '28px 22px 22px',
        background: `
          linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 100%),
          radial-gradient(140% 100% at 12% -10%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%),
          radial-gradient(120% 90% at 100% 110%, oklch(0.96 0.003 280) 0%, oklch(0.92 0.004 280) 80%)
        `,
        backdropFilter: 'blur(30px) saturate(170%)',
        WebkitBackdropFilter: 'blur(30px) saturate(170%)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,1),
          inset 0 0 0 1px rgba(255,255,255,0.55),
          inset 0 -1px 0 rgba(255,255,255,0.55),
          0 1px 1px rgba(0,0,0,0.04),
          0 2px 6px rgba(0,0,0,0.05),
          0 12px 28px rgba(20,18,40,0.08),
          0 28px 64px rgba(20,18,40,0.10)
        `,
        fontFamily: FONT_VAR,
      }}
    >
      {/* speculars */}
      <div
        style={{
          position: 'absolute',
          left: '-25%',
          top: '-40%',
          width: '90%',
          height: '160%',
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.70) 0%, transparent 60%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-30%',
          bottom: '-40%',
          width: '80%',
          height: '150%',
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 65%)',
          filter: 'blur(24px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 1.5,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--fg-3, oklch(0.66 0.006 280))',
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        <EditText path="paywall.eyebrow" defaultValue="Members only" />
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.18,
          color: 'var(--fg-0, oklch(0.18 0.008 280))',
          marginBottom: 8,
          textWrap: 'balance',
          textAlign: 'center',
          fontFamily: HEADING_VAR,
        }}
      >
        <EditText
          path="paywall.title"
          defaultValue={`${lockedCount} more lessons, unlocked when you enroll`}
          multiline
        />
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 12.5,
          color: 'var(--fg-2, oklch(0.52 0.008 280))',
          lineHeight: 1.5,
          textWrap: 'pretty',
          textAlign: 'center',
        }}
      >
        <EditText
          path="paywall.subtitle"
          defaultValue="Lifetime access. Workshops with feedback. 30-day refund."
          multiline
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: 1,
          margin: '20px -22px 18px',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.07) 50%, transparent 100%)',
        }}
      />

      {priceLabel && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--fg-0, oklch(0.18 0.008 280))',
              lineHeight: 1,
              fontFamily: HEADING_VAR,
            }}
          >
            {priceLabel}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--fg-3, oklch(0.66 0.006 280))',
            }}
          >
            <EditText path="paywall.priceSub" defaultValue="one-time" />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onEnroll}
        disabled={enrolling || !canEnroll}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          padding: '15px 24px',
          borderRadius: 999,
          background:
            'linear-gradient(180deg, oklch(0.28 0.008 280) 0%, oklch(0.14 0.008 280) 100%)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          border: 'none',
          cursor: enrolling || !canEnroll ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          opacity: enrolling || !canEnroll ? 0.7 : 1,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.18),
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 2px 4px rgba(0,0,0,0.15),
            0 8px 20px rgba(0,0,0,0.18)
          `,
        }}
      >
        <EditText path="paywall.cta" defaultValue={enrolling ? 'Enrolling…' : 'Enroll now'} />
      </button>

      {peek.length > 0 && (
        <>
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fg-3, oklch(0.66 0.006 280))',
              margin: '22px 0 10px',
              textAlign: 'center',
            }}
          >
            Continues with
          </div>
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {peek.map((lesson, i) => (
              <LockedLessonRow
                key={lesson.id}
                lesson={lesson}
                hue={hues[i % hues.length]}
                index={i}
                fallbackThumbnailUrl={courseThumbnailUrl ?? null}
                fallbackObjectPosition={courseThumbnailObjectPosition ?? null}
              />
            ))}
          </div>
          {remaining > 0 && (
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: 11.5,
                color: 'var(--fg-3, oklch(0.66 0.006 280))',
                textAlign: 'center',
                marginTop: 12,
                fontWeight: 500,
              }}
            >
              +{remaining} more {remaining === 1 ? 'lesson' : 'lessons'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LockedLessonRow({
  lesson,
  hue,
  index,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
}: {
  lesson: CourseLessonRead
  hue: number
  index: number
  fallbackThumbnailUrl?: string | null
  fallbackObjectPosition?: string | null
}) {
  const coverUrl = lesson.thumbnail_url ?? fallbackThumbnailUrl ?? null
  const coverPosition =
    lesson.thumbnail_object_position ?? fallbackObjectPosition ?? '50% 50%'
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        background: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 12,
        alignItems: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 56,
          aspectRatio: '4 / 3',
          borderRadius: 7,
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(255,255,255,0.7)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: coverPosition,
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(150deg, oklch(0.78 0.05 ${hue}) 0%, oklch(0.86 0.02 280) 100%)`,
            }}
          />
        )}
        {/* Darken when we have a real cover so the image reads as
            "members only"; soft-blur the placeholder when we don't. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: coverUrl
              ? 'rgba(0,0,0,0.50)'
              : 'rgba(255,255,255,0.45)',
            backdropFilter: coverUrl
              ? 'saturate(0.7)'
              : 'blur(8px) saturate(150%)',
            WebkitBackdropFilter: coverUrl
              ? 'saturate(0.7)'
              : 'blur(8px) saturate(150%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            color: coverUrl
              ? 'rgba(255,255,255,0.92)'
              : 'var(--fg-2, oklch(0.52 0.008 280))',
            display: 'flex',
            filter: coverUrl
              ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))'
              : undefined,
          }}
        >
          <LockIcon size={11} />
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.10em',
            color: 'var(--fg-3, oklch(0.66 0.006 280))',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          EP {index + 1}
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--fg-1, oklch(0.32 0.008 280))',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            letterSpacing: '-0.005em',
          }}
        >
          {lesson.title}
        </div>
      </div>
    </div>
  )
}

// ── Instructor ────────────────────────────────────────────────────────────

// ── Created by ────────────────────────────────────────────────────────────

// Author-intro section that sits right under the hero. Same primitives as
// desktop, stacked single-column for narrow widths: pill eyebrow, headline
// quote, identity (avatar + name + tagline), bio, then the cinematic still
// with the blue placeholder.
export function MobileCreatedBy({
  course,
  organizationAvatarUrl,
}: {
  course: CourseRead
  organizationAvatarUrl: string | null
}) {
  const ed = useEditor()
  const instructorName = course.instructor_name?.trim() || ''
  const defaultEyebrow = instructorName
    ? `CREATED BY ${instructorName.toUpperCase()}`
    : 'CREATED BY THE TEAM'
  const bioFirstSentence =
    course.instructor_bio?.split(/(?<=\.)\s+/)[0]?.trim() ?? ''
  const defaultQuote = bioFirstSentence
    ? `“${bioFirstSentence}”`
    : '“I built this course to share the work I wish I’d had when I started.”'
  const avatarMedia = ed.m('createdBy.avatar')
  const avatarSrc = avatarMedia?.url ?? organizationAvatarUrl ?? null

  return (
    <section
      style={{
        padding: '56px 20px 40px',
        background: 'var(--bg-0, white)',
        fontFamily: FONT_VAR,
      }}
    >
      {/* Headline quote */}
      <EditText
        as="h2"
        path="createdBy.quote"
        defaultValue={defaultQuote}
        multiline
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: 'var(--fg-0, oklch(0.18 0.008 280))',
          margin: '0 0 36px',
          textWrap: 'balance',
          fontFamily: HEADING_VAR,
        }}
      />

      {/* Identity — avatar + name + tagline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <EditMedia
          id="createdBy.avatar"
          label="creator avatar"
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 64,
            height: 64,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid oklch(0.92 0.003 280)',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.06), 0 8px 22px rgba(0,0,0,0.10)',
          }}
          placeholder={
            avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 50% 30%, oklch(0.46 0.10 40) 0%, oklch(0.22 0.05 50) 80%)',
                }}
              />
            )
          }
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {instructorName && (
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.018em',
                color: 'var(--fg-0, oklch(0.18 0.008 280))',
                marginBottom: 4,
                lineHeight: 1.15,
                fontFamily: HEADING_VAR,
              }}
            >
              {instructorName}
            </div>
          )}
          <EditText
            as="div"
            path="createdBy.headline"
            defaultValue={course.instructor_bio ?? ''}
            multiline
            style={{
              fontSize: 12.5,
              color: 'var(--fg-2, oklch(0.32 0.008 280))',
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          />
        </div>
      </div>

      {/* Bio */}
      <div
        style={{
          paddingTop: 18,
          borderTop: '1px solid oklch(0.92 0.003 280)',
          marginBottom: 24,
        }}
      >
        <EditText
          as="p"
          path="createdBy.bio"
          defaultValue=""
          multiline
          style={{
            fontSize: 13.5,
            lineHeight: 1.7,
            color: 'var(--fg-1, oklch(0.32 0.008 280))',
            margin: 0,
            whiteSpace: 'pre-line',
            textWrap: 'pretty',
          }}
        />
      </div>

      {/* Cinematic still */}
      <EditMedia
        id="createdBy.image"
        label="creator still"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 11',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid oklch(0.92 0.003 280)',
          boxShadow:
            '0 2px 6px oklch(0 0 0 / 0.06), 0 18px 40px oklch(0 0 0 / 0.12)',
        }}
        placeholder={
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(160deg, oklch(0.62 0.06 250), oklch(0.22 0.04 280))',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 14,
                bottom: 12,
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                fontSize: 9.5,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.30)',
                zIndex: 5,
              }}
            >
              creator still · placeholder
            </div>
          </>
        }
      />
    </section>
  )
}

// ── What you'll learn ──────────────────────────────────────────────────────

// Four cards on a vertical spine — mobile mirror of the desktop zigzag.
// Spine runs down the left edge with nodes; title-only cards on the right
// open a sheet with the description on tap.
// Placeholder challenge titles + prompts shown when no real
// AI-generated / creator-written challenges have flowed in yet. Same
// shape + slot path as their desktop counterpart (see
// CHALLENGE_DEFAULTS in EditableCourseLandingView.tsx) — keeping the
// strings parallel keeps the section consistent across breakpoints.
const MOBILE_LEARN_DEFAULTS: { title: string; desc: string }[] = [
  {
    title: 'Ship your first attempt.',
    desc: 'Take what the first module covered and post one photo of your result — even if it didn’t go to plan.',
  },
  {
    title: 'Try the harder version.',
    desc: 'Push past the basics with the technique from module two. Capture it on video and share what changed.',
  },
  {
    title: 'Make it your own.',
    desc: 'Combine the moves from module three into something only you would make. One image, one paragraph on the choices.',
  },
  {
    title: 'Show the finished piece.',
    desc: 'Post the final result from module four — plated, packaged, shipped, whatever finished looks like for you.',
  },
]

const MOBILE_LEARN_HUES = [195, 35, 285, 145]

function MobileLearnThumbPlaceholder({ hue, n }: { hue: number; n: number }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, oklch(0.32 0.06 ${hue}) 0%, oklch(0.18 0.04 ${(hue + 30) % 360}) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '10%',
          width: '55%',
          height: '70%',
          background: `radial-gradient(ellipse, oklch(0.85 0.06 ${hue} / 0.18), transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 9,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.50)',
          fontWeight: 500,
        }}
      >
        challenge · §{n}
      </div>
    </>
  )
}

export function MobileWhatYoullLearn({
  challenges = [],
}: {
  /** Same shape as LandingChallenge in EditableCourseLandingView —
   *  re-typed locally to avoid a circular import between the desktop +
   *  mobile views. */
  challenges?: { id: string; title: string; prompt: string; position: number }[]
}) {
  const ed = useEditor()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  // 4 cards, AI-first with placeholder fallbacks — mirrors the desktop
  // WhatYoullLearn resolution exactly.
  const items = Array.from({ length: 4 }, (_, i) => {
    const ch = challenges[i]
    const fallback = MOBILE_LEARN_DEFAULTS[i]
    return {
      title: ed.t(`learn.item${i + 1}.title`, ch?.title ?? fallback.title),
      desc: ed.t(`learn.item${i + 1}.desc`, ch?.prompt ?? fallback.desc),
    }
  })
  return (
    <section
      style={{
        padding: '56px 20px 24px',
        background: 'var(--bg-0, white)',
        fontFamily: FONT_VAR,
      }}
    >
      <EditText
        path="learn.eyebrow"
        defaultValue="Challenges"
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--fg-3, oklch(0.66 0.006 280))',
          marginBottom: 12,
        }}
      />
      <h2
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1.08,
          margin: '0 0 32px',
          color: 'var(--fg-0, oklch(0.18 0.008 280))',
          textWrap: 'balance',
          fontFamily: HEADING_VAR,
        }}
      >
        <EditText
          as="span"
          path="learn.title"
          defaultValue="Four things you’ll actually make,"
          multiline
        />
        <br />
        <EditText
          as="span"
          path="learn.titleEm"
          defaultValue="and share with the class."
          multiline
          style={{
            color: 'var(--fg-2, oklch(0.42 0.008 280))',
            fontWeight: 500,
          }}
        />
      </h2>
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        <div
          style={{
            position: 'absolute',
            left: 5,
            top: 14,
            bottom: 14,
            width: 1.5,
            background: 'oklch(0.92 0.003 280)',
          }}
        />
        {items.map((d, i) => {
          const hue = MOBILE_LEARN_HUES[i % MOBILE_LEARN_HUES.length]
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                marginBottom: i === items.length - 1 ? 0 : 14,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -28,
                  top: 18,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--bg-0, #fff)',
                  border: '1.5px solid oklch(0.66 0.006 280)',
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenIdx(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpenIdx(i)
                  }
                }}
                style={{
                  cursor: 'pointer',
                  background: 'white',
                  border: '1px solid oklch(0.945 0.003 280)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 22px rgba(0,0,0,0.06)',
                }}
              >
                <EditMedia
                  id={`learn.item${i + 1}.image`}
                  label={`Moment ${i + 1} image`}
                  style={{
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    overflow: 'hidden',
                    background: '#111',
                  }}
                  placeholder={<MobileLearnThumbPlaceholder hue={hue} n={i + 1} />}
                />
                <div style={{ padding: '14px 16px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: `oklch(0.58 0.12 ${hue})`,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        fontSize: 10.5,
                        fontWeight: 500,
                        color: 'var(--fg-3, oklch(0.52 0.008 280))',
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Challenge {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <EditText
                    as="div"
                    path={`learn.item${i + 1}.title`}
                    defaultValue={d.title}
                    multiline
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: '-0.018em',
                      lineHeight: 1.28,
                      color: 'var(--fg-0, oklch(0.18 0.008 280))',
                      textWrap: 'balance',
                      fontFamily: HEADING_VAR,
                    }}
                  />
                  <div
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11.5,
                      color: 'var(--fg-3, oklch(0.52 0.008 280))',
                    }}
                  >
                    <span>Read more</span>
                    <span style={{ fontSize: 12, lineHeight: 1 }}>→</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {openIdx !== null && (
        <LearnItemSheet
          index={openIdx}
          title={items[openIdx].title}
          description={items[openIdx].desc}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </section>
  )
}

export function MobileInstructor({ course }: { course: CourseRead }) {
  if (!course.instructor_name && !course.instructor_bio) return null
  return (
    <section
      style={{
        padding: '48px 20px 40px',
        background: 'var(--bg-0, white)',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          fontWeight: 600,
          color: 'var(--fg-3, oklch(0.66 0.006 280))',
          marginBottom: 18,
          textTransform: 'uppercase',
        }}
      >
        <EditText
          path="instructor.eyebrow"
          defaultValue="YOUR INSTRUCTOR"
        />
      </div>

      <EditMedia
        id="instructor.portrait"
        label="instructor portrait"
        style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          width: '100%',
          borderRadius: 22,
          overflow: 'hidden',
          marginBottom: 24,
          boxShadow:
            '0 2px 6px oklch(0 0 0 / 0.06), 0 18px 40px oklch(0 0 0 / 0.12)',
        }}
        placeholder={<InstructorPortraitFallback />}
      >
        <div
          style={{
            position: 'absolute',
            left: 18,
            bottom: 16,
            color: 'white',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.018em',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            {course.instructor_name}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
      </EditMedia>

      <blockquote
        style={{
          fontSize: 21,
          fontWeight: 500,
          letterSpacing: '-0.022em',
          lineHeight: 1.22,
          margin: '0 0 10px',
          color: 'var(--fg-0, oklch(0.18 0.008 280))',
          textWrap: 'pretty',
          fontFamily: HEADING_VAR,
        }}
      >
        <EditText
          path="instructor.quote"
          defaultValue={`"${course.instructor_bio?.split('. ')[0] ?? ''}"`}
          multiline
        />
      </blockquote>
      {course.instructor_name && (
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--fg-3, oklch(0.66 0.006 280))',
            letterSpacing: '0.04em',
            marginBottom: 22,
          }}
        >
          — {course.instructor_name}
        </div>
      )}

      {course.instructor_bio && (
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.65,
            color: 'var(--fg-1, oklch(0.32 0.008 280))',
            margin: 0,
            textWrap: 'pretty',
          }}
        >
          <EditText
            path="instructor.bio"
            defaultValue={course.instructor_bio ?? ''}
            multiline
          />
        </p>
      )}
    </section>
  )
}

function InstructorPortraitFallback() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, oklch(0.42 0.09 35), oklch(0.18 0.05 65))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '12%',
          transform: 'translateX(-50%)',
          width: '34%',
          aspectRatio: '1',
          background: 'linear-gradient(180deg, oklch(0.52 0.05 35), oklch(0.34 0.04 35))',
          borderRadius: '50%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '18%',
          bottom: 0,
          right: '18%',
          height: '60%',
          background: 'linear-gradient(180deg, oklch(0.28 0.04 35), oklch(0.13 0.03 35))',
          clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0% 100%)',
          borderRadius: '40% 40% 0 0',
        }}
      />
    </div>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────

const MOBILE_FAQ_DEFAULTS: { q: string; a: string }[] = [
  {
    q: 'Who is this course for?',
    a: 'Anyone whose work depends on writing that gets read. No prior craft experience required.',
  },
  {
    q: 'How much time should I plan for?',
    a: 'Around four hours of video plus three writing assignments. Most students finish across two or three weeks at an hour a day.',
  },
  {
    q: 'Do I get feedback on what I write?',
    a: 'Yes — three of the lessons include a workshop assignment read by a small, moderated peer group.',
  },
  {
    q: 'Is there a certificate?',
    a: 'A shareable certificate is issued when you complete all three workshop assignments.',
  },
  {
    q: 'What if it’s not for me?',
    a: 'Full refund within 30 days, no questions, no forms.',
  },
  {
    q: 'Will I be able to watch on my phone?',
    a: 'Yes — the player works on any device. Downloads for offline viewing are included on mobile.',
  },
  {
    q: 'How is this different from a writing book?',
    a: 'Books teach you what good writing looks like. This course teaches you the moves — concrete, named, replicable.',
  },
]

export function MobileFaq() {
  const ed = useEditor()
  const isEdit = ed.mode === 'edit'
  const [open, setOpen] = useState(0)

  return (
    <section
      style={{
        padding: '56px 20px 24px',
        background: 'var(--bg-0, white)',
        fontFamily: FONT_VAR,
      }}
    >
      <EditText
        path="faq.eyebrow"
        defaultValue="Questions, answered"
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--fg-3, oklch(0.66 0.006 280))',
          marginBottom: 12,
        }}
      />
      <h2
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1.08,
          margin: '0 0 36px',
          color: 'var(--fg-0, oklch(0.18 0.008 280))',
          textWrap: 'balance',
          fontFamily: HEADING_VAR,
        }}
      >
        <EditText
          as="span"
          path="faq.title"
          defaultValue="Everything you might want to know"
          multiline
        />
        <br />
        <EditText
          as="span"
          path="faq.titleEm"
          defaultValue="before enrolling."
          multiline
          style={{
            color: 'var(--fg-2, oklch(0.42 0.008 280))',
            fontWeight: 500,
          }}
        />
      </h2>

      <div style={{ borderTop: '1px solid oklch(0.92 0.003 280)' }}>
        {MOBILE_FAQ_DEFAULTS.map((it, i) => {
          const isOpen = isEdit || open === i
          return (
            <div
              key={i}
              style={{
                borderBottom: '1px solid oklch(0.92 0.003 280)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '20px 2px',
                }}
              >
                <EditText
                  as="span"
                  path={`faq.item${i + 1}.q`}
                  defaultValue={it.q}
                  multiline
                  style={{
                    fontSize: 15.5,
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                    color: 'var(--fg-0, oklch(0.18 0.008 280))',
                    lineHeight: 1.35,
                    textWrap: 'balance',
                    flex: 1,
                    minWidth: 0,
                    fontFamily: HEADING_VAR,
                  }}
                />
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: '1px solid oklch(0.92 0.003 280)',
                      background: isOpen
                        ? 'oklch(0.18 0.008 280)'
                        : 'oklch(0.97 0.003 280)',
                      color: isOpen ? 'white' : 'oklch(0.32 0.008 280)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition:
                        'transform 220ms cubic-bezier(0.34, 1.3, 0.64, 1), background 150ms ease, border-color 150ms ease',
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      borderColor: isOpen
                        ? 'oklch(0.18 0.008 280)'
                        : 'oklch(0.92 0.003 280)',
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line
                        x1="12"
                        y1="5"
                        x2="12"
                        y2="19"
                        style={{
                          opacity: isOpen ? 0 : 1,
                          transition: 'opacity 200ms ease',
                        }}
                      />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                )}
              </div>
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isOpen ? '500px' : '0',
                  opacity: isOpen ? 1 : 0,
                  paddingBottom: isOpen ? 22 : 0,
                  transition:
                    'max-height 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease, padding 220ms ease',
                }}
              >
                <EditText
                  as="p"
                  path={`faq.item${i + 1}.a`}
                  defaultValue={it.a}
                  multiline
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: 'var(--fg-2, oklch(0.42 0.008 280))',
                    margin: 0,
                    padding: '0 2px',
                    textWrap: 'pretty',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────

export function MobileFinalCta({
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
}: {
  priceLabel: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
}) {
  return (
    <section style={{ padding: '24px 16px 32px', fontFamily: FONT_VAR }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 22,
          overflow: 'hidden',
          isolation: 'isolate',
          padding: '36px 22px 26px',
          textAlign: 'center',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 100%),
            radial-gradient(140% 100% at 12% -10%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%),
            radial-gradient(120% 90% at 100% 110%, oklch(0.96 0.003 280) 0%, oklch(0.92 0.004 280) 80%)
          `,
          backdropFilter: 'blur(30px) saturate(170%)',
          WebkitBackdropFilter: 'blur(30px) saturate(170%)',
          border: '1px solid rgba(255,255,255,0.75)',
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,1),
            inset 0 0 0 1px rgba(255,255,255,0.55),
            inset 0 -1px 0 rgba(255,255,255,0.55),
            0 1px 1px rgba(0,0,0,0.04),
            0 2px 6px rgba(0,0,0,0.05),
            0 12px 28px rgba(20,18,40,0.08),
            0 28px 64px rgba(20,18,40,0.10)
          `,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '-25%',
            top: '-40%',
            width: '90%',
            height: '160%',
            background:
              'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 60%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 1.5,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--fg-3, oklch(0.66 0.006 280))',
            marginBottom: 16,
          }}
        >
          <EditText
            path="finalCta.label"
            defaultValue="Ready when you are"
          />
        </div>
        <h2
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            margin: '0 0 12px',
            color: 'var(--fg-0, oklch(0.18 0.008 280))',
            textWrap: 'balance',
            fontFamily: HEADING_VAR,
          }}
        >
          <EditText
            path="finalCta.title"
            defaultValue="Start free. Continue when you're ready."
            multiline
          />
        </h2>
        <p
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 13.5,
            color: 'var(--fg-2, oklch(0.52 0.008 280))',
            margin: '0 auto 22px',
            textWrap: 'pretty',
            lineHeight: 1.5,
          }}
        >
          <EditText
            path="finalCta.subtitle"
            defaultValue="The first few lessons are free to preview. No card required."
            multiline
          />
        </p>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 22,
          }}
        >
          <button
            type="button"
            onClick={onEnroll}
            disabled={enrolling || !canEnroll}
            style={{
              padding: '14px 22px',
              borderRadius: 999,
              background:
                'linear-gradient(180deg, oklch(0.28 0.008 280) 0%, oklch(0.14 0.008 280) 100%)',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              border: 'none',
              cursor: enrolling || !canEnroll ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              width: '100%',
              opacity: enrolling || !canEnroll ? 0.7 : 1,
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.18),
                inset 0 -1px 0 rgba(0,0,0,0.4),
                0 2px 4px rgba(0,0,0,0.15),
                0 8px 20px rgba(0,0,0,0.18)
              `,
            }}
          >
            {enrolling
              ? 'Enrolling…'
              : priceLabel
                ? `Enroll for ${priceLabel}`
                : 'Enroll'}
          </button>
        </div>
        <FinalCtaGuarantees />
      </div>
    </section>
  )
}

function FinalCtaGuarantees() {
  const ed = useEditor()
  const items = [
    ed.t('finalCta.guarantee1', '30-day refund'),
    ed.t('finalCta.guarantee2', 'Lifetime access'),
    ed.t('finalCta.guarantee3', 'Any device'),
  ]
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 11,
        color: 'var(--fg-3, oklch(0.66 0.006 280))',
      }}
    >
      {items.map((label, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && (
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'var(--line, oklch(0.92 0.003 280))',
                display: 'inline-block',
              }}
            />
          )}
          <span>{label}</span>
        </span>
      ))}
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────

export function MobileFooter({ organizationName }: { organizationName: string }) {
  return (
    <footer style={{ padding: '0 20px 24px', fontFamily: FONT_VAR }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 4,
          paddingTop: 20,
          borderTop: '1px solid var(--line, oklch(0.92 0.003 280))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--fg-0, oklch(0.18 0.008 280))',
            }}
          >
            {organizationName}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--fg-3, oklch(0.66 0.006 280))',
            }}
          >
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────

function PlayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 2.5v7l6-3.5z" />
    </svg>
  )
}

function ArrowRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      <path d="M4 5.5V3.8a2 2 0 014 0v1.7" />
    </svg>
  )
}

