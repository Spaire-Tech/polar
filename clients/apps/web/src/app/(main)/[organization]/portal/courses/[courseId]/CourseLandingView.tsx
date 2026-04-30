'use client'

import {
  CurriculumTimeline,
  FinalCta,
  FullLessonList,
  InstructorBlock,
  Reviews,
  TrailerBlock,
  ValueStrip,
} from '@/components/Courses/CourseWizard.preview'
import type { StoredLanding } from '@/components/Courses/landingStorage'
import type { FlatLesson } from './MasterClassLessonList'

const FONT = "'Poppins', var(--font-poppins), system-ui, sans-serif"
const C = {
  bg0: '#ffffff',
  fg0: 'oklch(0.18 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  line: 'oklch(0.92 0.003 280)',
  lineSoft: 'oklch(0.945 0.003 280)',
}

interface CourseLandingViewProps {
  organizationName: string
  instructorName: string | null
  instructorBio: string | null
  courseTitle: string
  courseDescription: string | null
  thumbnailUrl: string | null
  thumbnailObjectPosition?: string | null
  trailerUrl: string | null
  isStarted: boolean
  paywallEnabled: boolean
  paywallPosition: number | null
  flatLessons: FlatLesson[]
  landing: StoredLanding
  onStart: () => void
  onTrailer: () => void
}

// Renders the AI-generated landing page on the portal/storefront. Reuses the
// section components from the wizard preview so the wizard preview and the
// real landing page stay visually identical.
export function CourseLandingView({
  organizationName,
  instructorName,
  instructorBio,
  courseTitle,
  courseDescription,
  thumbnailUrl,
  thumbnailObjectPosition,
  trailerUrl,
  isStarted,
  paywallEnabled,
  paywallPosition,
  flatLessons,
  landing,
  onStart,
  onTrailer,
}: CourseLandingViewProps) {
  // Adapt portal types to the wizard preview's prop shapes.
  const draft = {
    name: instructorName ?? '',
    courseTitle,
    desc: courseDescription ?? '',
    nameItalic: false,
    nameBold: true,
    nameUppercase: true,
  }
  const instructor = {
    name: instructorName ?? organizationName,
    bio: instructorBio ?? '',
  }
  const course = { title: courseTitle, desc: courseDescription ?? '' }

  // Pricing surface used by FullLessonList + FinalCta. Only paywall_enabled
  // and the free preview count drive UI; price is rendered by the storefront
  // checkout, not here.
  const pricing = {
    paywallEnabled,
    priceCents: 0,
    freePreviewLessons: paywallPosition ?? 0,
  }

  // Outline shape expected by CurriculumTimeline + FullLessonList. We don't
  // have modules at the portal layer (everything is flat lessons), so wrap
  // them into a single synthetic module for now.
  const outline = {
    modules: [
      {
        title: courseTitle,
        lessons: flatLessons.map((l) => ({
          title: l.title,
          content_type: (l.content_type === 'video' ? 'video' : 'text') as
            | 'text'
            | 'video',
        })),
      },
    ],
  }

  const totalDurationSeconds = flatLessons.reduce(
    (acc, l) => acc + (l.duration_seconds ?? 0),
    0,
  )

  return (
    <div
      style={{
        background: C.bg0,
        color: C.fg0,
        fontFamily: FONT,
        minHeight: '100vh',
      }}
    >
      <Hero
        thumbnailUrl={thumbnailUrl}
        thumbnailObjectPosition={thumbnailObjectPosition}
        trailerUrl={trailerUrl}
        title={courseTitle}
        instructorName={instructorName ?? organizationName}
        landing={landing}
        paywallEnabled={paywallEnabled}
        isStarted={isStarted}
        totalDurationSeconds={totalDurationSeconds}
        lessonCount={flatLessons.length}
        onStart={onStart}
        onTrailer={onTrailer}
      />
      <TrailerBlock
        trailerUrl={trailerUrl}
        thumbnailUrl={thumbnailUrl}
        thumbPosition={thumbnailObjectPosition ?? null}
        onReplaceTrailer={() => {}}
      />
      <ValueStrip landing={landing} />
      <CurriculumTimeline outline={outline} landing={landing} />
      <FullLessonList outline={outline} pricing={pricing} landing={landing} />
      <InstructorBlock
        instructor={instructor}
        draft={draft}
        landing={landing}
      />
      <Reviews landing={landing} />
      <FinalCta landing={landing} pricing={pricing} onCreate={onStart} />

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

// Public hero, lighter than the wizard's Hero (no edit affordances).
function Hero({
  thumbnailUrl,
  thumbnailObjectPosition,
  trailerUrl,
  title,
  instructorName,
  landing,
  paywallEnabled,
  isStarted,
  totalDurationSeconds,
  lessonCount,
  onStart,
  onTrailer,
}: {
  thumbnailUrl: string | null
  thumbnailObjectPosition?: string | null
  trailerUrl: string | null
  title: string
  instructorName: string
  landing: StoredLanding
  paywallEnabled: boolean
  isStarted: boolean
  totalDurationSeconds: number
  lessonCount: number
  onStart: () => void
  onTrailer: () => void
}) {
  const eyebrow = landing.eyebrow ?? 'SPAIRE ORIGINAL'
  const series = landing.series_label ?? 'NEW SERIES'
  const tagline = landing.tagline ?? ''
  const level = landing.level ?? 'All levels'

  const fmtDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h} hr ${m} min` : `${m} min`
  }

  const primaryLabel = isStarted
    ? 'Continue'
    : paywallEnabled
      ? 'Enroll'
      : 'Start free'

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
      <div style={{ position: 'absolute', inset: 0 }}>
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 25% 35%, oklch(0.42 0.12 35) 0%, oklch(0.18 0.05 280) 55%, oklch(0.08 0.02 280) 100%)',
            }}
          />
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.88) 100%)',
        }}
      />
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
        {eyebrow}
      </div>

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
            {lessonCount} lessons
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {totalDurationSeconds > 0 ? fmtDuration(totalDurationSeconds) : '—'}
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
          {instructorName && (
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>
              — with {instructorName}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onStart}
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
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {primaryLabel}
            </span>
          </button>
          {trailerUrl && (
            <button
              type="button"
              onClick={onTrailer}
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
              Watch trailer
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
