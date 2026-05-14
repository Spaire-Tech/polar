'use client'

// Modal sheet that mirrors the wizard's outline overlay — opens when a
// section card on the course landing is clicked and lists the lessons in
// that section. Uses the real uploaded section cover (the same slot the
// SectionCard renders) and falls back to the colored placeholder when no
// image has been uploaded.
//
// Portaled to <body> so it isn't clipped by the customize canvas's
// overflow-y: auto wrapper or the iPhone preview frame's overflow:
// hidden screen.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEditor } from './EditorContext'

const HUES = [35, 195, 285, 145, 25, 320]

function fmtMinutes(secs?: number | null) {
  if (!secs) return null
  const m = Math.max(1, Math.round(secs / 60))
  return `${m} min`
}

export function SectionModuleSheet({
  module: mod,
  index,
  lessons,
  onClose,
  placeholder,
}: {
  module: CourseRead['modules'][number]
  index: number
  lessons: CourseLessonRead[]
  onClose: () => void
  /**
   * Optional fallback visual when no image has been uploaded for the
   * section. Receives the same `hue` + `n` the SectionCard uses so the
   * sheet's cover matches the card the user clicked.
   */
  placeholder?: ReactNode
}) {
  const ed = useEditor()
  const slot = ed.m(`sections.module.${mod.id}.image`)
  const coverUrl = slot && slot.kind === 'image' ? slot.url : null
  const coverPosition = slot?.objectPosition ?? '50% 50%'
  const hue = HUES[index % HUES.length]
  // When the studio's device toggle is set to mobile, pin the sheet to
  // phone-style dimensions even though the browser viewport is wider —
  // so what the user sees in the iPhone preview matches what a customer
  // will see on a real phone.
  const compact = ed.device === 'mobile'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Lock body scroll while the sheet is open so the user doesn't see
    // the customize canvas scroll behind a half-transparent backdrop.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  const node = (
    <div
      className={compact ? 'scs-overlay scs-compact' : 'scs-overlay'}
      role="dialog"
      aria-modal="true"
      aria-label={`Section ${index + 1}: ${mod.title}`}
    >
      <button
        type="button"
        className="scs-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="scs-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <button
          type="button"
          className="scs-close"
          onClick={onClose}
          aria-label="Close section"
        >
          ✕
        </button>

        <div className="scs-cover">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="scs-cover-img"
              style={{ objectPosition: coverPosition }}
            />
          ) : (
            placeholder ?? <DefaultPlaceholder hue={hue} n={index + 1} />
          )}
          <div className="scs-cover-eyebrow">Section {index + 1}</div>
        </div>

        <div className="scs-body">
          <h2 className="scs-title">{mod.title || `Section ${index + 1}`}</h2>
          {mod.description && <p className="scs-desc">{mod.description}</p>}

          <div className="scs-lessons-head">
            <span>Lessons</span>
            <span className="scs-lessons-count">{lessons.length} total</span>
          </div>

          {lessons.length === 0 ? (
            <div className="scs-empty">No lessons in this section yet.</div>
          ) : (
            <ol className="scs-lessons">
              {lessons.map((lesson, j) => (
                <li key={lesson.id} className="scs-lesson">
                  <span className="scs-lesson-num">
                    {String(j + 1).padStart(2, '0')}
                  </span>
                  <span className="scs-lesson-title">{lesson.title}</span>
                  {fmtMinutes(lesson.duration_seconds) && (
                    <span className="scs-lesson-meta">
                      {fmtMinutes(lesson.duration_seconds)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <style jsx>{`
        .scs-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: scsFadeIn 0.18s ease;
          font-family: var(--font-body, 'Poppins', system-ui, sans-serif);
        }
        .scs-backdrop {
          position: absolute;
          inset: 0;
          background: oklch(0.18 0.012 270 / 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: none;
          cursor: pointer;
        }
        .scs-modal {
          position: relative;
          width: min(540px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background: white;
          border: 1px solid oklch(0.92 0.006 270);
          border-radius: 18px;
          box-shadow:
            0 4px 12px oklch(0.2 0.02 270 / 0.08),
            0 24px 64px oklch(0.2 0.02 270 / 0.22);
          animation: scsPopIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
        }
        .scs-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid oklch(0.92 0.006 270);
          display: flex;
          align-items: center;
          justify-content: center;
          color: oklch(0.36 0.012 270);
          cursor: pointer;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          font-size: 14px;
          line-height: 1;
        }
        .scs-close:hover {
          color: oklch(0.18 0.012 270);
          border-color: oklch(0.86 0.008 270);
        }
        .scs-cover {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #111;
          overflow: hidden;
          border-radius: 18px 18px 0 0;
        }
        .scs-cover-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .scs-cover-eyebrow {
          position: absolute;
          left: 16px;
          bottom: 12px;
          z-index: 2;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.16em;
          color: rgba(255, 255, 255, 0.92);
          text-transform: uppercase;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .scs-body {
          padding: 20px 22px 24px;
        }
        .scs-title {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.022em;
          line-height: 1.22;
          color: oklch(0.18 0.012 270);
        }
        .scs-desc {
          margin: 8px 0 0;
          font-size: 13.5px;
          line-height: 1.55;
          color: oklch(0.52 0.014 270);
        }
        .scs-lessons-head {
          margin-top: 20px;
          padding-bottom: 10px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: oklch(0.66 0.012 270);
          border-bottom: 1px solid oklch(0.93 0.006 270);
        }
        .scs-lessons-count {
          font-weight: 500;
          text-transform: none;
          letter-spacing: 0.02em;
          color: oklch(0.52 0.014 270);
        }
        .scs-empty {
          margin-top: 12px;
          font-size: 13px;
          color: oklch(0.52 0.014 270);
        }
        .scs-lessons {
          margin: 4px 0 0;
          padding: 0;
          list-style: none;
        }
        .scs-lesson {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid oklch(0.955 0.006 270);
        }
        .scs-lesson:last-child {
          border-bottom: none;
        }
        .scs-lesson-num {
          flex-shrink: 0;
          width: 26px;
          font-size: 12px;
          font-weight: 600;
          color: oklch(0.52 0.014 270);
          font-variant-numeric: tabular-nums;
        }
        .scs-lesson-title {
          flex: 1;
          font-size: 13.5px;
          line-height: 1.45;
          color: oklch(0.22 0.012 270);
        }
        .scs-lesson-meta {
          flex-shrink: 0;
          font-size: 11.5px;
          color: oklch(0.62 0.014 270);
          font-variant-numeric: tabular-nums;
        }

        /* Mobile / phone-frame fit: the overlay still renders at viewport
           dimensions (it's portaled to <body>), but reduce padding so the
           card uses more of the screen on narrow viewports. Same rules
           apply when the editor's device toggle is forced to "mobile" so
           the iPhone preview shows the literal phone modal. */
        @media (max-width: 480px) {
          .scs-overlay {
            padding: 12px;
          }
          .scs-modal {
            border-radius: 16px;
            max-height: calc(100vh - 24px);
          }
          .scs-cover {
            border-radius: 16px 16px 0 0;
          }
          .scs-title {
            font-size: 20px;
          }
          .scs-body {
            padding: 16px 18px 20px;
          }
        }
        .scs-overlay.scs-compact {
          padding: 12px;
        }
        .scs-overlay.scs-compact .scs-modal {
          width: min(360px, 100%);
          border-radius: 16px;
          max-height: calc(100vh - 24px);
        }
        .scs-overlay.scs-compact .scs-cover {
          border-radius: 16px 16px 0 0;
        }
        .scs-overlay.scs-compact .scs-title {
          font-size: 19px;
        }
        .scs-overlay.scs-compact .scs-body {
          padding: 16px 18px 20px;
        }

        @keyframes scsFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scsPopIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
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

function DefaultPlaceholder({ hue, n }: { hue: number; n: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, oklch(0.36 0.08 ${hue}) 0%, oklch(0.18 0.04 ${
          (hue + 30) % 360
        }) 100%)`,
      }}
      aria-hidden
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
          left: '12%',
          top: '8%',
          width: '60%',
          height: '70%',
          background: `radial-gradient(ellipse, oklch(0.85 0.06 ${hue} / 0.20), transparent 70%)`,
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
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 11,
          letterSpacing: '0.12em',
          fontWeight: 500,
        }}
      >
        §{n}
      </div>
    </div>
  )
}
