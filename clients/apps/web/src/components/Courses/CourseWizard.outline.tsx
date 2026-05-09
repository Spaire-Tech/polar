'use client'

import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useState } from 'react'

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}
type PartialOutline = { modules?: PartialModule[] }

// ─── Horizontal journey + click-to-open module modal ─────────────────────────

function JourneyOutline({
  outline,
  isStreaming,
}: {
  outline: PartialOutline
  isStreaming: boolean
}) {
  const modules = outline.modules ?? []
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  // Close on Escape
  useEffect(() => {
    if (openIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIdx])

  const openModule = openIdx !== null ? modules[openIdx] : null

  return (
    <div className="so-journey">
      <div className="so-journey-scroll">
        <div className="so-journey-track">
          {/* Dashed connector behind the nodes */}
          <div className="so-journey-line" aria-hidden="true" />

          {modules.map((mod, i) => {
            const lessons = mod.lessons ?? []
            const isLast = i === modules.length - 1
            const streaming = isStreaming && isLast
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIdx(i)}
                className={`so-node${streaming ? ' streaming' : ''}`}
                aria-label={`Open module ${i + 1}`}
              >
                <span className="so-node-bubble">{i + 1}</span>
                <span className="so-node-title">
                  {mod.title || (
                    <span className="so-skel" style={{ width: 110 }} />
                  )}
                </span>
                <span className="so-node-meta">
                  {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                </span>
              </button>
            )
          })}

          {isStreaming && (
            <div className="so-journey-streaming" aria-live="polite">
              <span className="so-pulse" />
              Writing
              {modules.length > 0 ? ` module ${modules.length + 1}` : ''}…
            </div>
          )}
        </div>
      </div>

      {openModule !== null && openIdx !== null && (
        <ModuleOverlay
          index={openIdx}
          module={openModule}
          onClose={() => setOpenIdx(null)}
        />
      )}

      <JourneyStyles />
    </div>
  )
}

function ModuleOverlay({
  index,
  module: mod,
  onClose,
}: {
  index: number
  module: PartialModule
  onClose: () => void
}) {
  const lessons = mod.lessons ?? []
  return (
    <div className="so-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="so-overlay-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="so-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="so-modal-close"
          onClick={onClose}
          aria-label="Close module"
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>

        {/* 16:9 hero / cover placeholder */}
        <div className="so-modal-hero">
          <span className="so-modal-hero-badge">Module {index + 1}</span>
          <span className="so-modal-hero-placeholder">module cover · 16:9</span>
        </div>

        {/* Body */}
        <div className="so-modal-body">
          <div className="so-modal-eyebrow">Module {index + 1}</div>
          <h2 className="so-modal-title">
            {mod.title || `Module ${index + 1}`}
          </h2>
          {mod.description && (
            <p className="so-modal-desc">{mod.description}</p>
          )}

          <div className="so-modal-lessons-head">
            <span>Lessons</span>
            <span className="so-modal-lessons-count">
              {lessons.length} total
            </span>
          </div>

          {lessons.length === 0 ? (
            <div className="so-modal-empty">No lessons yet.</div>
          ) : (
            <ol className="so-modal-lessons">
              {lessons.map((lesson, j) => (
                <li key={j} className="so-modal-lesson">
                  <span className="so-modal-lesson-num">
                    {String(j + 1).padStart(2, '0')}
                  </span>
                  <span className="so-modal-lesson-title">
                    {lesson.title || (
                      <span className="so-skel" style={{ width: 180 }} />
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── OutlineScreen ────────────────────────────────────────────────────────────

export function OutlineScreen({
  title,
  partialOutline,
  isStreaming,
  error,
  onRegenerate,
  onCreate,
  onClose,
}: {
  title: string
  partialOutline: PartialOutline
  isStreaming: boolean
  error: string | null
  onRegenerate: () => void
  onCreate: () => void
  onClose: () => void
}) {
  const modulesCount = partialOutline.modules?.length ?? 0
  const lessonsCount =
    partialOutline.modules?.reduce(
      (acc, m) => acc + (m?.lessons?.length ?? 0),
      0,
    ) ?? 0

  return (
    <>
      <div className="so-topbar">
        <div className="so-logo">Spaire</div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="so-close"
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1080,
          margin: '0 auto',
          padding: '96px 24px 64px',
          background: '#fff',
        }}
      >
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: '#0a0a0a',
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              color: '#a0a0a0',
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            {modulesCount} modules · {lessonsCount} lessons
            {isStreaming && ' · generating…'}
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 10,
              background: '#fff5f5',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              fontSize: 13,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            }}
          >
            {error}
          </div>
        )}

        <JourneyOutline
          outline={partialOutline}
          isStreaming={isStreaming}
        />

        <div
          style={{
            marginTop: 28,
            padding: '12px 16px',
            borderRadius: 10,
            border: '1.5px solid #e8e8e8',
            background: '#f4f4f4',
            fontSize: 12,
            color: '#a0a0a0',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          This outline is just a starting point — you can edit modules, lessons,
          and content after creating the course.
        </div>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onRegenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 100,
              border: '1.5px solid #e8e8e8',
              background: '#fff',
              color: '#6a6a6a',
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <AutorenewOutlined style={{ fontSize: 16 }} />
            Regenerate
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={isStreaming || modulesCount === 0}
            className="so-btn-cta"
          >
            Create course
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function JourneyStyles() {
  return (
    <style jsx global>{`
      .so-journey {
        --so-ink: oklch(0.18 0.012 270);
        --so-ink-2: oklch(0.36 0.012 270);
        --so-muted: oklch(0.56 0.014 270);
        --so-muted-2: oklch(0.72 0.012 270);
        --so-hair: oklch(0.92 0.006 270);
        --so-hair-strong: oklch(0.86 0.008 270);
        --so-surface: #ffffff;
        --so-surface-2: oklch(0.975 0.004 270);
        --so-surface-3: oklch(0.955 0.006 270);
        --so-shadow-md: 0 1px 2px oklch(0.2 0.02 270 / 0.04),
          0 8px 24px oklch(0.2 0.02 270 / 0.06);
        --so-shadow-lg: 0 4px 12px oklch(0.2 0.02 270 / 0.06),
          0 24px 60px oklch(0.2 0.02 270 / 0.18);
        font-family: var(--font-poppins), system-ui, sans-serif;
      }

      .so-journey-scroll {
        overflow-x: auto;
        overflow-y: visible;
        padding: 16px 8px 24px;
        margin: 0 -8px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
      }
      .so-journey-track {
        position: relative;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 28px;
        min-width: max-content;
        padding: 24px 16px 12px;
      }

      /* Dashed connector behind the nodes */
      .so-journey-line {
        position: absolute;
        top: 48px;
        left: 24px;
        right: 24px;
        height: 0;
        border-top: 1.5px dashed var(--so-hair-strong);
        z-index: 0;
        pointer-events: none;
      }

      /* Node = numbered bubble + title + meta, all clickable */
      .so-node {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        width: 132px;
        flex-shrink: 0;
      }
      .so-node-bubble {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #ffffff;
        border: 1.5px solid var(--so-hair-strong);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 600;
        color: var(--so-ink);
        font-variant-numeric: tabular-nums;
        box-shadow: var(--so-shadow-md);
        transition: transform 0.15s ease, border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .so-node:hover .so-node-bubble {
        border-color: var(--so-ink);
        transform: translateY(-2px);
        box-shadow: 0 2px 4px oklch(0.2 0.02 270 / 0.06),
          0 12px 32px oklch(0.2 0.02 270 / 0.1);
      }
      .so-node.streaming .so-node-bubble {
        border-color: var(--so-ink);
        animation: soNodePulse 1.6s ease-in-out infinite;
      }
      @keyframes soNodePulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 oklch(0.18 0.012 270 / 0.18);
        }
        50% {
          box-shadow: 0 0 0 8px oklch(0.18 0.012 270 / 0);
        }
      }
      .so-node-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--so-ink);
        text-align: center;
        line-height: 1.35;
        max-width: 132px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .so-node-meta {
        font-size: 11px;
        color: var(--so-muted-2);
        letter-spacing: 0.02em;
      }

      /* Streaming "writing module N…" pill at the end */
      .so-journey-streaming {
        position: relative;
        z-index: 1;
        align-self: center;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-size: 12px;
        color: var(--so-muted);
        background: var(--so-surface-2);
        border: 1px dashed var(--so-hair-strong);
        border-radius: 999px;
        flex-shrink: 0;
      }
      .so-pulse {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--so-ink);
        animation: soPulseBg 1s ease-in-out infinite;
      }

      .so-skel {
        display: inline-block;
        height: 12px;
        background: var(--so-hair);
        border-radius: 4px;
        animation: soPulseBg 1.4s ease-in-out infinite;
        vertical-align: middle;
      }

      @keyframes soPulseBg {
        0%,
        100% {
          opacity: 0.45;
        }
        50% {
          opacity: 1;
        }
      }

      /* ── Overlay ────────────────────────────────────────────────────────── */
      .so-overlay {
        position: fixed;
        inset: 0;
        z-index: 300;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        animation: soFadeIn 0.18s ease;
      }
      .so-overlay-backdrop {
        position: absolute;
        inset: 0;
        background: oklch(0.18 0.012 270 / 0.42);
        backdrop-filter: blur(4px);
        border: none;
        cursor: pointer;
      }
      .so-modal {
        position: relative;
        width: min(520px, 100%);
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        background: var(--so-surface);
        border: 1px solid var(--so-hair);
        border-radius: 16px;
        box-shadow: var(--so-shadow-lg);
        animation: soPopIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
      }
      .so-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 2;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid var(--so-hair);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--so-ink-2);
        cursor: pointer;
        backdrop-filter: blur(4px);
      }
      .so-modal-close:hover {
        color: var(--so-ink);
        border-color: var(--so-hair-strong);
      }
      /* 16:9 hero matching PFCheckoutPreview placeholder */
      .so-modal-hero {
        position: relative;
        aspect-ratio: 16 / 9;
        background-color: var(--so-surface-3);
        background-image: repeating-linear-gradient(
          135deg,
          var(--so-surface-3) 0px,
          var(--so-surface-3) 6px,
          var(--so-surface-2) 6px,
          var(--so-surface-2) 12px
        );
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .so-modal-hero-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        font-size: 11px;
        font-weight: 600;
        color: var(--so-ink-2);
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid var(--so-hair);
        padding: 4px 10px;
        border-radius: 999px;
        letter-spacing: 0.02em;
      }
      .so-modal-hero-placeholder {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        color: var(--so-muted);
      }

      .so-modal-body {
        padding: 18px 20px 22px;
      }
      .so-modal-eyebrow {
        font-size: 11px;
        font-weight: 600;
        color: var(--so-muted-2);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .so-modal-title {
        margin: 6px 0 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--so-ink);
        letter-spacing: -0.012em;
        line-height: 1.25;
      }
      .so-modal-desc {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--so-muted);
        line-height: 1.55;
      }

      .so-modal-lessons-head {
        margin-top: 18px;
        padding-bottom: 8px;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--so-muted-2);
        border-bottom: 1px solid var(--so-hair);
      }
      .so-modal-lessons-count {
        font-weight: 500;
        text-transform: none;
        letter-spacing: 0.02em;
        color: var(--so-muted);
      }
      .so-modal-empty {
        margin-top: 10px;
        font-size: 13px;
        color: var(--so-muted);
      }
      .so-modal-lessons {
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
      }
      .so-modal-lesson {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 11px 0;
        border-bottom: 1px solid var(--so-surface-3);
      }
      .so-modal-lesson:last-child {
        border-bottom: none;
      }
      .so-modal-lesson-num {
        flex-shrink: 0;
        width: 26px;
        font-size: 12px;
        font-weight: 600;
        color: var(--so-muted);
        font-variant-numeric: tabular-nums;
      }
      .so-modal-lesson-title {
        flex: 1;
        font-size: 13.5px;
        color: var(--so-ink);
        line-height: 1.45;
      }

      @keyframes soFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes soPopIn {
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
  )
}
