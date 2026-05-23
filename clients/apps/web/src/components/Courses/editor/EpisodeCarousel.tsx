'use client'

// EpisodeCarousel — horizontal swipeable carousel of "locked" episode
// cards, used in place of the standard members-only paywall card on the
// series landing format. Each card uses the lesson's own thumbnail (or
// the course thumbnail as fallback), with a bottom-anchored gradient
// scrim so the title text stays legible without fully covering the
// artwork. Clicking a card opens EnrollToWatchSheet, which is the
// enroll-to-checkout funnel for the whole series.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useRef, useState } from 'react'
import { EnrollToWatchSheet } from './EnrollToWatchSheet'
import { useEditor } from './EditorContext'

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'
const HEADING_VAR = 'var(--font-heading, ' + FONT_VAR + ')'

const FALLBACK_HUES = [195, 35, 285, 145, 25, 320]

function CardArtwork({
  thumbnailUrl,
  objectPosition,
  hue,
  index,
}: {
  thumbnailUrl: string | null
  objectPosition: string | null
  hue: number
  index: number
}) {
  if (thumbnailUrl) {
    return (
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
          objectPosition: objectPosition ?? '50% 50%',
        }}
      />
    )
  }
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
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 8px, transparent 8px 16px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '15%',
          width: '70%',
          height: '60%',
          background: `radial-gradient(ellipse, oklch(0.85 0.06 ${hue} / 0.18), transparent 70%)`,
          filter: 'blur(24px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 14,
          top: 14,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 9.5,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 500,
        }}
      >
        ep · §{index}
      </div>
    </>
  )
}

function LockBadge() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        width: 30,
        height: 30,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        zIndex: 3,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      </svg>
    </div>
  )
}

export function EpisodeCarousel({
  course,
  paidLessons,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
  variant = 'desktop',
}: {
  course: CourseRead
  paidLessons: CourseLessonRead[]
  priceLabel: string | null
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
  variant?: 'desktop' | 'mobile'
}) {
  const ed = useEditor()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [openLesson, setOpenLesson] = useState<CourseLessonRead | null>(null)

  if (paidLessons.length === 0) return null

  const isMobile = variant === 'mobile'

  // Card dimensions — wide enough to read as a poster on desktop, slimmer
  // on mobile so two cards peek into view at once.
  const cardWidth = isMobile ? 232 : 296
  const cardHeight = isMobile ? 330 : 416

  // Scroll-by-card helpers for the desktop chevron controls.
  const scrollBy = (dir: 1 | -1) => {
    const node = trackRef.current
    if (!node) return
    node.scrollBy({ left: dir * (cardWidth + 16), behavior: 'smooth' })
  }

  return (
    <section
      style={{
        padding: isMobile ? '32px 0 0' : '24px 0 0',
        fontFamily: FONT_VAR,
      }}
      aria-label="Episodes"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: isMobile ? '0 20px 14px' : '0 32px 18px',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: isMobile ? 10 : 11,
              fontWeight: 600,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'oklch(0.52 0.008 280)',
              marginBottom: 6,
            }}
          >
            Episodes
          </div>
          <div
            style={{
              fontSize: isMobile ? 22 : 28,
              fontWeight: 600,
              letterSpacing: '-0.028em',
              color: 'oklch(0.18 0.008 280)',
              lineHeight: 1.1,
              fontFamily: HEADING_VAR,
            }}
          >
            {paidLessons.length}{' '}
            {paidLessons.length === 1 ? 'episode' : 'episodes'} to watch
          </div>
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <CarouselNav direction="left" onClick={() => scrollBy(-1)} />
            <CarouselNav direction="right" onClick={() => scrollBy(1)} />
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: isMobile ? '6px 20px 24px' : '6px 32px 28px',
          WebkitOverflowScrolling: 'touch',
        }}
        className="ep-carousel-track"
      >
        {paidLessons.map((lesson, i) => {
          const hue = FALLBACK_HUES[i % FALLBACK_HUES.length]
          // Lesson thumbnail first, course thumbnail second, gradient last.
          // Matches the same fallback chain the lesson player uses, so the
          // carousel reads consistently with the rest of the landing.
          const slot = ed.m(`lesson.${lesson.id}.thumb`)
          const slotUrl =
            slot && slot.kind === 'image' ? slot.url : null
          const thumbUrl =
            slotUrl ??
            lesson.thumbnail_url ??
            course.thumbnail_url ??
            null
          const thumbPos =
            (slot && slot.kind === 'image' ? slot.objectPosition : null) ??
            lesson.thumbnail_object_position ??
            course.thumbnail_object_position ??
            null
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => setOpenLesson(lesson)}
              style={{
                position: 'relative',
                flex: `0 0 ${cardWidth}px`,
                width: cardWidth,
                height: cardHeight,
                borderRadius: 18,
                overflow: 'hidden',
                scrollSnapAlign: 'start',
                border: 'none',
                padding: 0,
                background: '#0b0b10',
                cursor: 'pointer',
                boxShadow:
                  '0 1px 2px rgba(0,0,0,0.06), 0 12px 36px rgba(0,0,0,0.18)',
                transition:
                  'transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1), box-shadow 220ms ease',
                color: 'white',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow =
                  '0 2px 4px rgba(0,0,0,0.08), 0 20px 48px rgba(0,0,0,0.24)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow =
                  '0 1px 2px rgba(0,0,0,0.06), 0 12px 36px rgba(0,0,0,0.18)'
              }}
            >
              <CardArtwork
                thumbnailUrl={thumbUrl}
                objectPosition={thumbPos}
                hue={hue}
                index={i + 1}
              />
              <LockBadge />
              {/* Bottom gradient scrim — keeps the text readable without
                  covering the artwork. The first ~55% is fully
                  transparent; the bottom ~45% ramps to deep black. */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '62%',
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.30) 35%, rgba(0,0,0,0.75) 80%, rgba(0,0,0,0.92) 100%)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  right: 18,
                  bottom: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    fontFamily:
                      'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: 10.5,
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  Episode {String(i + 1).padStart(2, '0')}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 17 : 19,
                    fontWeight: 600,
                    letterSpacing: '-0.018em',
                    lineHeight: 1.22,
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                    textWrap: 'balance',
                    fontFamily: HEADING_VAR,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {lesson.title || `Episode ${i + 1}`}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <style jsx>{`
        .ep-carousel-track::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {openLesson && (
        <EnrollToWatchSheet
          course={course}
          lesson={openLesson}
          priceLabel={priceLabel}
          onEnroll={onEnroll}
          enrolling={enrolling}
          canEnroll={canEnroll}
          onClose={() => setOpenLesson(null)}
        />
      )}
    </section>
  )
}

function CarouselNav({
  direction,
  onClick,
}: {
  direction: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: '1px solid oklch(0.92 0.003 280)',
        background: 'white',
        color: 'oklch(0.36 0.012 270)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 160ms ease, border-color 160ms ease',
        fontSize: 14,
        lineHeight: 1,
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.94)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {direction === 'left' ? '‹' : '›'}
    </button>
  )
}
