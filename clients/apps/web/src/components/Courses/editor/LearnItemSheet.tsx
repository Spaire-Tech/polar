'use client'

// Modal sheet for a "What you'll learn / watch" item. Mirrors
// SectionModuleSheet's visual rules (same backdrop, same modal shell,
// same close affordance) so the two zigzag roadmaps on the page feel
// like one design language. Simpler than the section sheet: no lesson
// list, no cover image — just the index, the title, and the description.

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditor } from './EditorContext'

const HUES = [195, 35, 285, 145]

export function LearnItemSheet({
  index,
  title,
  description,
  onClose,
}: {
  index: number
  title: string
  description: string
  onClose: () => void
}) {
  const ed = useEditor()
  const hue = HUES[index % HUES.length]
  const compact = ed.device === 'mobile'
  // Reuse the same image slot the card's EditMedia writes to, so a
  // creator who uploads a thumb sees it again in the sheet.
  const slot = ed.m(`learn.item${index + 1}.image`)
  const coverUrl = slot && slot.kind === 'image' ? slot.url : null
  const coverPosition = slot?.objectPosition ?? '50% 50%'

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

  const node = (
    <div
      className={compact ? 'lis-overlay lis-compact' : 'lis-overlay'}
      role="dialog"
      aria-modal="true"
      aria-label={`Item ${index + 1}: ${title}`}
    >
      <button
        type="button"
        className="lis-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="lis-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <button
          type="button"
          className="lis-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="lis-cover">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="lis-cover-img"
              style={{ objectPosition: coverPosition }}
            />
          ) : (
            <>
              <div
                className="lis-cover-bg"
                style={{
                  background: `linear-gradient(135deg, oklch(0.32 0.06 ${hue}) 0%, oklch(0.18 0.04 ${(hue + 30) % 360}) 100%)`,
                }}
              />
              <div className="lis-cover-pattern" />
            </>
          )}
          <div className="lis-cover-eyebrow">
            Challenge {String(index + 1).padStart(2, '0')}
          </div>
        </div>

        <div className="lis-body">
          <h2 className="lis-title">{title}</h2>
          {description && <p className="lis-desc">{description}</p>}
        </div>
      </div>

      <style jsx>{`
        .lis-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: lisFadeIn 0.18s ease;
          font-family: var(--font-body, 'Poppins', system-ui, sans-serif);
        }
        .lis-backdrop {
          position: absolute;
          inset: 0;
          background: oklch(0.18 0.012 270 / 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: none;
          cursor: pointer;
        }
        .lis-modal {
          position: relative;
          width: min(480px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background: white;
          border: 1px solid oklch(0.92 0.006 270);
          border-radius: 18px;
          box-shadow:
            0 4px 12px oklch(0.2 0.02 270 / 0.08),
            0 24px 64px oklch(0.2 0.02 270 / 0.22);
          animation: lisPopIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
        }
        .lis-close {
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
        .lis-close:hover {
          color: oklch(0.18 0.012 270);
          border-color: oklch(0.86 0.008 270);
        }
        .lis-cover {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 7;
          background: #111;
          overflow: hidden;
          border-radius: 18px 18px 0 0;
        }
        .lis-cover-bg {
          position: absolute;
          inset: 0;
        }
        .lis-cover-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .lis-cover-pattern {
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.04) 0 8px,
            transparent 8px 16px
          );
        }
        .lis-cover-eyebrow {
          position: absolute;
          left: 22px;
          bottom: 16px;
          font-family: ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.88);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
          z-index: 1;
        }
        .lis-body {
          padding: 28px 28px 32px;
        }
        .lis-title {
          margin: 0 0 14px;
          font-family: var(
            --font-heading,
            var(--font-body, 'Poppins', system-ui, sans-serif)
          );
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.022em;
          line-height: 1.18;
          color: oklch(0.18 0.008 280);
          text-wrap: balance;
        }
        .lis-desc {
          margin: 0;
          font-size: 15px;
          line-height: 1.55;
          color: oklch(0.42 0.008 280);
          text-wrap: pretty;
        }
        .lis-compact .lis-modal {
          width: min(360px, 100%);
        }
        .lis-compact .lis-title {
          font-size: 20px;
        }
        .lis-compact .lis-desc {
          font-size: 14px;
        }
        @keyframes lisFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes lisPopIn {
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
