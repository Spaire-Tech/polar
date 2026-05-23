'use client'

// EnrollToWatchSheet — opens when a viewer taps a locked episode card
// in the series carousel. Reuses the EXACT live-checkout-preview
// component that the creator already sees in onboarding Step 3
// (PFCheckoutPreview from CourseWizard.steps.tsx). Same CTA color
// (var(--ink)), same hero ratio, same card shell. The cover image is
// the course thumbnail (set during onboarding) so the modal stays in
// continuity with what the creator picked.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function EnrollToWatchSheet({
  course,
  lesson,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
  onClose,
}: {
  course: CourseRead
  lesson: CourseLessonRead
  priceLabel: string | null
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const coverUrl = course.thumbnail_url ?? null
  const coverPos = course.thumbnail_object_position ?? '50% 50%'
  const totalLessons = (() => {
    if (!course.modules) return 0
    return course.modules.reduce(
      (acc, m) => acc + (m.lessons?.length ?? 0),
      0,
    )
  })()

  const ctaLabel = enrolling
    ? 'Loading…'
    : priceLabel
      ? `Enroll · ${priceLabel}`
      : 'Enroll to watch'

  const handleEnroll = () => {
    if (!canEnroll || enrolling) return
    onEnroll()
  }

  const node = (
    <div className="ews-root" role="dialog" aria-modal="true">
      <button
        type="button"
        className="ews-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="ews-wrap"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <button
          type="button"
          className="ews-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="pf-preview-card">
          <div
            className="pf-preview-hero"
            style={
              coverUrl
                ? {
                    background: `center / cover no-repeat url(${coverUrl})`,
                    backgroundPosition: coverPos,
                  }
                : undefined
            }
          >
            {!coverUrl && (
              <div className="pf-preview-placeholder">cover · 16:9</div>
            )}
          </div>
          <div className="pf-preview-body">
            <div className="pf-preview-meta">
              Series ·{' '}
              {totalLessons > 0
                ? `${totalLessons} ${
                    totalLessons === 1 ? 'episode' : 'episodes'
                  }`
                : 'multiple episodes'}
            </div>
            <h3 className="pf-preview-title">{course.title}</h3>
            <p className="pf-preview-desc">
              “{lesson.title || 'This episode'}” is part of {course.title}.
              Enroll once and watch every episode — including new ones as
              they land.
            </p>
            <div className="pf-preview-price">
              <span className="pf-preview-amount">{priceLabel ?? 'Free'}</span>
            </div>
            <button
              type="button"
              className="pf-preview-cta"
              onClick={handleEnroll}
              disabled={!canEnroll || enrolling}
            >
              {ctaLabel}
            </button>
            <div className="pf-preview-footer">
              <span>Secure checkout</span>
              <span>Powered by spaire</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ews-root {
          /* Same design tokens used by PFCheckoutPreview in
             CourseWizard.steps.tsx so the card renders identical to
             the live preview the creator saw in onboarding Step 3. */
          --surface: #ffffff;
          --surface-3: oklch(0.955 0.006 270);
          --ink: oklch(0.18 0.012 270);
          --muted: oklch(0.56 0.014 270);
          --muted-2: oklch(0.72 0.012 270);
          --hair: oklch(0.92 0.006 270);
          --shadow-md:
            0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06);

          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family:
            -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          animation: ewsFadeIn 0.18s ease;
        }
        .ews-backdrop {
          position: absolute;
          inset: 0;
          background: oklch(0.18 0.012 270 / 0.42);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: none;
          cursor: pointer;
        }
        .ews-wrap {
          position: relative;
          width: min(420px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          animation: ewsPopIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
        }
        .ews-close {
          position: absolute;
          top: -42px;
          right: 0;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1d1d1f;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
        }
        .ews-close:hover {
          background: #fff;
        }

        /* ── PFCheckoutPreview styles, copied verbatim from
              CourseWizard.steps.tsx so the modal renders identical to
              the onboarding live preview. ── */
        .pf-preview-card {
          background: #fff;
          border: 1px solid var(--hair);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }
        .pf-preview-hero {
          aspect-ratio: 16 / 9;
          background: repeating-linear-gradient(
            45deg,
            oklch(0.94 0.01 270) 0 12px,
            oklch(0.96 0.01 270) 12px 24px
          );
          position: relative;
        }
        .pf-preview-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: oklch(0.55 0.02 270);
          font-size: 11px;
          font-family: ui-monospace, monospace;
          letter-spacing: 0.5px;
        }
        .pf-preview-body {
          padding: 18px;
        }
        .pf-preview-meta {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-2);
          letter-spacing: 0.6px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .pf-preview-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          line-height: 1.3;
          letter-spacing: -0.2px;
          color: var(--ink);
        }
        .pf-preview-desc {
          font-size: 12.5px;
          color: var(--muted);
          margin: 6px 0 0;
          line-height: 1.5;
        }
        .pf-preview-price {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 18px;
          margin-bottom: 16px;
        }
        .pf-preview-amount {
          font-size: 26px;
          font-weight: 600;
          color: var(--ink);
          letter-spacing: -0.6px;
          font-variant-numeric: tabular-nums;
        }
        .pf-preview-cta {
          width: 100%;
          padding: 13px 16px;
          font-size: 14px;
          font-weight: 600;
          background: var(--ink);
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .pf-preview-cta:hover:not(:disabled) {
          opacity: 0.92;
        }
        .pf-preview-cta:active:not(:disabled) {
          transform: scale(0.985);
        }
        .pf-preview-cta:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .pf-preview-footer {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--hair);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: var(--muted);
        }

        @keyframes ewsFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes ewsPopIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )

  return createPortal(node, document.body)
}
