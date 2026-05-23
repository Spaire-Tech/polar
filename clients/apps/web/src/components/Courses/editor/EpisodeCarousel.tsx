'use client'

// EpisodeCarousel — pixel-faithful port of "Carousel Study.html" from the
// design handoff. Cards are 3:2 portrait-leaning tiles with a
// bottom-anchored gradient scrim. No section header — the carousel is
// just the track. Nav arrows sit below the carousel, centered, 36px
// circles in #e8e8ed.
//
// Per-card content (matches design):
//   - "EPISODE N" eyebrow (small caps, .14em tracking)
//   - h3 title (single line, ellipsis)
//   - description (2-line clamp)
//   - footer: duration on the left, kebab "more" button on the right
//
// On a series landing this carousel replaces the members-only paywall
// card. Tapping any card opens EnrollToWatchSheet which routes to the
// existing checkout flow.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import type { schemas } from '@spaire/client'
import { useEffect, useRef, useState } from 'react'
import { EnrollToWatchSheet } from './EnrollToWatchSheet'
import { useEditor } from './EditorContext'

const FONT_VAR =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'

const ALT_GRADIENTS = [
  'linear-gradient(160deg, #1c2a3a 0%, #0e1623 100%)', // alt-a
  'linear-gradient(160deg, #2a2333 0%, #1a1726 100%)', // default
  'linear-gradient(160deg, #3a2a1c 0%, #1f1610 100%)', // alt-b
  'linear-gradient(160deg, #2c2e3a 0%, #16171e 100%)', // alt-c
  'linear-gradient(160deg, #2a3a2c 0%, #131c14 100%)', // alt-d
  'linear-gradient(160deg, #3a1c2a 0%, #1f0e16 100%)', // alt-e
]

function fmtDuration(secs?: number | null): string | null {
  if (!secs || secs < 1) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(1, m)}m`
}

export function EpisodeCarousel({
  course,
  product,
  paidLessons,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
  variant = 'desktop',
}: {
  course: CourseRead
  product?: schemas['Product']
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
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateNav = () => {
    const node = trackRef.current
    if (!node) return
    const max = node.scrollWidth - node.clientWidth - 1
    setCanPrev(node.scrollLeft > 1)
    setCanNext(node.scrollLeft < max)
  }

  useEffect(() => {
    updateNav()
    const node = trackRef.current
    if (!node) return
    const onScroll = () => updateNav()
    node.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateNav)
    return () => {
      node.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateNav)
    }
  }, [paidLessons.length])

  const step = () => {
    const node = trackRef.current
    if (!node) return 400
    const firstCard = node.querySelector<HTMLElement>('.epcs-card')
    if (!firstCard) return 400
    const gap = parseFloat(getComputedStyle(node).gap || '20')
    return firstCard.getBoundingClientRect().width + gap
  }

  const scrollByCard = (dir: -1 | 1) => {
    const node = trackRef.current
    if (!node) return
    node.scrollBy({ left: dir * step(), behavior: 'smooth' })
  }

  if (paidLessons.length === 0) return null

  return (
    <section
      className={variant === 'mobile' ? 'epcs-root epcs-mobile' : 'epcs-root'}
      aria-label="Episodes"
    >
      <div className="epcs-carousel">
        <div ref={trackRef} className="epcs-track">
          {paidLessons.map((lesson, i) => {
            const altBg = ALT_GRADIENTS[i % ALT_GRADIENTS.length]
            const slot = ed.m(`lesson.${lesson.id}.thumb`)
            const slotUrl =
              slot && slot.kind === 'image' ? slot.url : null
            const thumbUrl =
              slotUrl ?? lesson.thumbnail_url ?? course.thumbnail_url ?? null
            const thumbPos =
              (slot && slot.kind === 'image' ? slot.objectPosition : null) ??
              lesson.thumbnail_object_position ??
              course.thumbnail_object_position ??
              null
            const duration = fmtDuration(lesson.duration_seconds)
            // Description resolution: AI-generated per-episode value
            // first, then the lesson's own description, then a
            // hardcoded fallback so a card never renders without copy
            // below the title. The AI value lives at
            // `episode.<i>.desc` (written by WizardLandingEditor when
            // the landing payload arrives).
            const aiDesc = ed.t(`episode.${i}.desc`, '')
            const description =
              aiDesc.trim() ||
              lesson.description?.trim() ||
              `Available once you enroll. Watch ${lesson.title || `episode ${i + 1}`} and the rest of the season.`
            return (
              <article key={lesson.id} className="epcs-card">
                <button
                  type="button"
                  className="epcs-media"
                  onClick={() => setOpenLesson(lesson)}
                  aria-label={`Episode ${i + 1}: ${lesson.title || 'Untitled'}`}
                >
                  {/* Image lives in its own layer so the blur strip
                      below has something explicit to sample with
                      backdrop-filter. Putting it on the parent
                      button as a CSS background also works in most
                      browsers but is less reliable across Safari /
                      Firefox compositor paths. */}
                  <div
                    className="epcs-image"
                    style={
                      thumbUrl
                        ? {
                            background: `center / cover no-repeat url(${thumbUrl})`,
                            backgroundPosition: thumbPos ?? '50% 50%',
                          }
                        : { background: altBg }
                    }
                    aria-hidden
                  />
                  {/* Frosted-glass strip — backdrop-filter blurs the
                      .epcs-image behind it. No mask (which breaks the
                      backdrop-filter compositor in Safari + Firefox).
                      A faint dark gradient on top of the blur softens
                      the seam and keeps the title legible over the
                      blurred artwork. */}
                  <div className="epcs-blur" aria-hidden />
                  <div className="epcs-scrim" aria-hidden />
                  <div className="epcs-body">
                    <p className="epcs-ep">Episode {i + 1}</p>
                    <h3 className="epcs-title">
                      {lesson.title || `Episode ${i + 1}`}
                    </h3>
                    {description && (
                      <p className="epcs-desc">{description}</p>
                    )}
                    <div className="epcs-foot">
                      <span className="epcs-dur">{duration ?? '—'}</span>
                      <span className="epcs-more" aria-hidden>
                        <svg viewBox="0 0 16 4">
                          <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                          <circle cx="8" cy="2" r="1.5" fill="currentColor" />
                          <circle cx="14" cy="2" r="1.5" fill="currentColor" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </button>
              </article>
            )
          })}
        </div>
      </div>

      <div className="epcs-nav">
        <button
          type="button"
          className="epcs-nav-btn"
          aria-label="Previous"
          onClick={() => scrollByCard(-1)}
          disabled={!canPrev}
        >
          <svg viewBox="0 0 12 12">
            <polyline
              points="7.5,2 3.5,6 7.5,10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="epcs-nav-btn"
          aria-label="Next"
          onClick={() => scrollByCard(1)}
          disabled={!canNext}
        >
          <svg viewBox="0 0 12 12">
            <polyline
              points="4.5,2 8.5,6 4.5,10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {openLesson && (
        <EnrollToWatchSheet
          course={course}
          product={product}
          lesson={openLesson}
          priceLabel={priceLabel}
          onEnroll={onEnroll}
          enrolling={enrolling}
          canEnroll={canEnroll}
          onClose={() => setOpenLesson(null)}
        />
      )}

      <style jsx>{`
        .epcs-root {
          /* Align with the same edge the sample / sections strip use
             (20px gutter) so the carousel doesn't visually shift right
             relative to the rest of the landing. Card width still
             scales to the viewport — the design's wider side-pad was
             for a standalone study, not inside a page wrapper. */
          --gap: 20px;
          --side-pad: 20px;
          --card-w: clamp(320px, 38vw, 620px);
          padding: 60px 0 80px;
          font-family: ${FONT_VAR};
        }
        .epcs-root.epcs-mobile {
          --side-pad: 20px;
          --card-w: clamp(260px, 78vw, 360px);
          padding: 36px 0 48px;
        }
        .epcs-carousel {
          position: relative;
          overflow: hidden;
        }
        .epcs-track {
          display: flex;
          gap: var(--gap);
          padding-inline-start: var(--side-pad);
          padding-inline-end: var(--side-pad);
          scroll-padding-inline-start: var(--side-pad);
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .epcs-track::-webkit-scrollbar {
          display: none;
        }
        .epcs-card {
          flex: 0 0 var(--card-w);
          scroll-snap-align: start;
          margin: 0;
        }
        .epcs-media {
          appearance: none;
          width: 100%;
          aspect-ratio: 3 / 2;
          border-radius: 22px;
          overflow: hidden;
          position: relative;
          color: #fff;
          display: block;
          padding: 0;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          background: #0b0b10;
        }
        /* Image layer — bottom of the stack. .epcs-blur backdrop-filters
           this. */
        .epcs-image {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        /* Frosted-glass strip — backdrop-filters the image layer.
           Solid height, no mask (mask interacts badly with
           backdrop-filter in Safari/Firefox compositors and ends up
           rendering nothing). */
        .epcs-blur {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 46%;
          backdrop-filter: blur(24px) saturate(140%);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
          /* Light tint on top of the blur so the title still reads
             over the softened artwork. */
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.2) 40%,
            rgba(0, 0, 0, 0.5) 100%
          );
          pointer-events: none;
          z-index: 1;
        }
        /* Top-edge softener — fades the blur strip into the unblurred
           image above. Lives just above the blur, just below the body. */
        .epcs-scrim {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 46%;
          height: 14%;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.18) 100%
          );
          pointer-events: none;
          z-index: 1;
        }
        .epcs-body {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: 22px;
          z-index: 2;
          color: #fff;
        }
        .epcs-ep {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
          margin: 0 0 10px;
          line-height: 1;
        }
        .epcs-title {
          font-size: 26px;
          font-weight: 700;
          line-height: 1.18;
          margin: 0 0 10px;
          letter-spacing: -0.012em;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .epcs-desc {
          font-size: 15px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 16px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .epcs-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13.5px;
          color: rgba(255, 255, 255, 0.78);
        }
        .epcs-dur {
          font-weight: 400;
        }
        .epcs-more {
          display: inline-flex;
          align-items: center;
          padding: 4px 6px;
          color: rgba(255, 255, 255, 0.78);
        }
        .epcs-more svg {
          width: 20px;
          height: 5px;
        }
        .epcs-mobile .epcs-body {
          left: 18px;
          right: 18px;
          bottom: 18px;
        }
        .epcs-mobile .epcs-title {
          font-size: 21px;
        }
        .epcs-mobile .epcs-desc {
          font-size: 13.5px;
          margin-bottom: 12px;
        }
        .epcs-nav {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 56px;
        }
        .epcs-mobile .epcs-nav {
          margin-top: 28px;
        }
        .epcs-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #e8e8ed;
          color: #1d1d1f;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .epcs-nav-btn:hover:not(:disabled) {
          background: #dcdce1;
        }
        .epcs-nav-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .epcs-nav-btn svg {
          width: 12px;
          height: 12px;
        }
      `}</style>
    </section>
  )
}
