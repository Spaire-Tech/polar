'use client'

// EnrollToWatchSheet — appears when a viewer taps a locked episode card
// in the series carousel. Mirrors the Apple TV "Continue with Email"
// modal aesthetic (centered white card, X close, logo lockup, sub-copy,
// blue primary CTA) but the action is to enroll into the whole series
// rather than to sign in. The CTA hands off to the same checkout flow
// the rest of the landing already uses.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditor } from './EditorContext'

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
  const ed = useEditor()
  const compact = ed.device === 'mobile'

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

  const seriesTitle = course.title || 'this series'
  const episodeTitle = lesson.title || 'this episode'
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
    <div
      className={compact ? 'ews-overlay ews-compact' : 'ews-overlay'}
      role="dialog"
      aria-modal="true"
      aria-label="Enroll to watch this episode"
    >
      <button
        type="button"
        className="ews-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="ews-modal"
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

        <div className="ews-logo" aria-hidden>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 1 1 8 0v3" />
          </svg>
        </div>

        <h2 className="ews-title">Enroll to watch this episode</h2>
        <p className="ews-sub">
          “{episodeTitle}” is part of {seriesTitle}. Enroll once and get
          every episode — including the ones that come next.
        </p>

        <div className="ews-handshake" aria-hidden>
          <svg
            width="40"
            height="20"
            viewBox="0 0 40 20"
            fill="none"
            stroke="oklch(0.58 0.14 235)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="8" cy="10" r="3.2" />
            <path d="M2 18 c2 -3 4 -4 6 -4 s4 1 6 4" />
            <circle cx="32" cy="10" r="3.2" />
            <path d="M26 18 c2 -3 4 -4 6 -4 s4 1 6 4" />
          </svg>
        </div>

        <p className="ews-fine">
          You’re enrolling for the full series — lifetime access, every
          episode, on any device. You can request a refund within 30
          days if it isn’t what you expected.{' '}
        </p>

        <button
          type="button"
          className="ews-cta"
          onClick={handleEnroll}
          disabled={!canEnroll || enrolling}
        >
          {ctaLabel}
        </button>
      </div>

      <style jsx>{`
        .ews-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: ewsFadeIn 0.18s ease;
          font-family: var(--font-body, 'Poppins', system-ui, sans-serif);
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
        .ews-modal {
          position: relative;
          width: min(440px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background: white;
          border: 1px solid oklch(0.92 0.006 270);
          border-radius: 22px;
          box-shadow:
            0 4px 12px oklch(0.2 0.02 270 / 0.08),
            0 24px 64px oklch(0.2 0.02 270 / 0.22);
          padding: 56px 32px 30px;
          text-align: center;
          animation: ewsPopIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
        }
        .ews-close {
          position: absolute;
          top: 14px;
          left: 14px;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: oklch(0.94 0.005 280);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: oklch(0.36 0.012 270);
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
        }
        .ews-close:hover {
          color: oklch(0.18 0.012 270);
          background: oklch(0.9 0.005 280);
        }
        .ews-logo {
          width: 52px;
          height: 52px;
          margin: 0 auto 22px;
          border-radius: 14px;
          background: #000;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
        }
        .ews-title {
          margin: 0 0 12px;
          font-family: var(
            --font-heading,
            var(--font-body, 'Poppins', system-ui, sans-serif)
          );
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.022em;
          line-height: 1.2;
          color: oklch(0.14 0.008 280);
          text-wrap: balance;
        }
        .ews-sub {
          margin: 0 0 22px;
          font-size: 14.5px;
          line-height: 1.55;
          color: oklch(0.4 0.008 280);
          text-wrap: pretty;
        }
        .ews-handshake {
          margin: 6px auto 14px;
          display: flex;
          justify-content: center;
        }
        .ews-fine {
          margin: 0 0 22px;
          font-size: 12.5px;
          line-height: 1.55;
          color: oklch(0.5 0.006 280);
          text-wrap: pretty;
        }
        .ews-cta {
          width: 100%;
          height: 48px;
          border-radius: 999px;
          border: none;
          background: oklch(0.58 0.14 235);
          color: white;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.005em;
          cursor: pointer;
          transition: background 160ms ease, transform 160ms ease;
        }
        .ews-cta:hover:not(:disabled) {
          background: oklch(0.52 0.14 235);
        }
        .ews-cta:active:not(:disabled) {
          transform: scale(0.985);
        }
        .ews-cta:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .ews-compact .ews-modal {
          width: min(360px, 100%);
          padding: 50px 24px 24px;
          border-radius: 20px;
        }
        .ews-compact .ews-title {
          font-size: 19px;
        }
        .ews-compact .ews-sub {
          font-size: 13.5px;
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
