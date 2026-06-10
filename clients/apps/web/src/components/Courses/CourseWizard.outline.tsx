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

const MAX_PER_ROW = 4

// Same hue palette as EditableCourseLandingView's SectionCard so the
// wizard preview matches the published landing 1:1.
const HUES = [35, 195, 285, 145, 25, 320]

// ─── Apple-TV-styled colored stripe placeholder (mirrors landing) ────────────

function SectionThumbPlaceholder({
  hue,
  n,
  aspect = '4 / 3',
  radius,
}: {
  hue: number
  n: number
  aspect?: string
  radius: string
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspect,
        overflow: 'hidden',
        borderRadius: radius,
        background: '#111',
      }}
    >
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
          fontSize: 9.5,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.50)',
          fontWeight: 500,
        }}
      >
        portrait · §{n}
      </div>
    </div>
  )
}

// ─── Single zigzag card (mirrors SectionCard from the landing) ───────────────

function SectionCard({
  module: mod,
  index,
  pointer,
  onClick,
  streaming,
}: {
  module: PartialModule
  index: number
  pointer: 'top' | 'bottom'
  onClick: () => void
  streaming: boolean
}) {
  const isAbove = pointer === 'bottom'
  const hue = HUES[index % HUES.length]
  const thumbRadius = isAbove ? '13px 13px 0 0' : '0 0 13px 13px'
  const thumb = (
    <SectionThumbPlaceholder
      hue={hue}
      n={index + 1}
      aspect="4 / 3"
      radius={thumbRadius}
    />
  )
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open module ${index + 1}`}
      className={`so-card${streaming ? ' streaming' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        background: 'white',
        borderRadius: 16,
        overflow: 'visible',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.08)',
        border: '1px solid oklch(0.945 0.003 280)',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {isAbove && thumb}
      <div style={{ padding: '14px 16px 16px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'oklch(0.66 0.006 280)',
            marginBottom: 4,
            letterSpacing: '-0.005em',
          }}
        >
          Section {index + 1}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '-0.018em',
            color: 'oklch(0.18 0.008 280)',
            lineHeight: 1.3,
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          {mod.title || (
            <span
              style={{
                display: 'inline-block',
                height: 14,
                width: 140,
                background: 'oklch(0.92 0.006 280)',
                borderRadius: 4,
                animation: 'soPulseBg 1.4s ease-in-out infinite',
              }}
            />
          )}
        </div>
      </div>
      {!isAbove && thumb}
      <div
        style={{
          position: 'absolute',
          left: 24,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          filter: 'drop-shadow(0 1px 0 oklch(0.945 0.003 280))',
          ...(isAbove
            ? {
                bottom: -8,
                top: 'auto',
                borderTop: '8px solid white',
                borderBottom: 'none',
              }
            : {
                top: -8,
                bottom: 'auto',
                borderBottom: '8px solid white',
                borderTop: 'none',
              }),
        }}
      />
    </button>
  )
}

// ─── Zigzag row (mirrors SectionZigzagRow from the landing) ──────────────────

function SectionZigzagRow({
  modules,
  startIndex,
  totalColumns,
  onOpen,
  streamingIdx,
}: {
  modules: PartialModule[]
  startIndex: number
  totalColumns: number
  onOpen: (idx: number) => void
  streamingIdx: number | null
}) {
  const columns = totalColumns
  const filled = modules.length
  const halfCol = 100 / columns / 2
  const lineLeft = halfCol
  const lineRight = (columns - filled + 0.5) * (100 / columns)

  return (
    <div style={{ position: 'relative' }}>
      {/* Top cards (even-indexed within row, pointing down) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          alignItems: 'end',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => {
          const mod = modules[i]
          if (!mod) return <div key={`top-empty-${i}`} />
          const absoluteIndex = startIndex + i
          return absoluteIndex % 2 === 0 ? (
            <div
              key={`top-${absoluteIndex}`}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
              }}
            >
              <SectionCard
                module={mod}
                index={absoluteIndex}
                pointer="bottom"
                onClick={() => onOpen(absoluteIndex)}
                streaming={streamingIdx === absoluteIndex}
              />
            </div>
          ) : (
            <div key={`top-spacer-${absoluteIndex}`} />
          )
        })}
      </div>

      {/* Spine: dotted line + dots */}
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          height: 24,
          alignItems: 'center',
          margin: '6px 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `calc(${lineLeft}% - 6px)`,
            right: `calc(${lineRight}% - 6px)`,
            top: '50%',
            transform: 'translateY(-50%)',
            height: 1.5,
            background: 'oklch(0.92 0.003 280)',
          }}
        />
        {Array.from({ length: columns }).map((_, i) => {
          const mod = modules[i]
          if (!mod) return <div key={`dot-empty-${i}`} />
          return (
            <div
              key={`dot-${startIndex + i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '1.5px solid oklch(0.66 0.006 280)',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Bottom cards (odd-indexed within row, pointing up) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          alignItems: 'start',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => {
          const mod = modules[i]
          if (!mod) return <div key={`bot-empty-${i}`} />
          const absoluteIndex = startIndex + i
          return absoluteIndex % 2 !== 0 ? (
            <div
              key={`bot-${absoluteIndex}`}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
              }}
            >
              <SectionCard
                module={mod}
                index={absoluteIndex}
                pointer="top"
                onClick={() => onOpen(absoluteIndex)}
                streaming={streamingIdx === absoluteIndex}
              />
            </div>
          ) : (
            <div key={`bot-spacer-${absoluteIndex}`} />
          )
        })}
      </div>
    </div>
  )
}

// ─── Outline as zigzag rows + click-to-open module modal ─────────────────────

function ZigzagOutline({
  outline,
  isStreaming,
}: {
  outline: PartialOutline
  isStreaming: boolean
}) {
  const modules = outline.modules ?? []
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useEffect(() => {
    if (openIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIdx])

  if (modules.length === 0 && !isStreaming) {
    return null
  }

  const rowColumns = Math.min(Math.max(modules.length, 1), MAX_PER_ROW)
  const chunks: PartialModule[][] = []
  for (let i = 0; i < modules.length; i += MAX_PER_ROW) {
    chunks.push(modules.slice(i, i + MAX_PER_ROW))
  }

  const streamingIdx =
    isStreaming && modules.length > 0 ? modules.length - 1 : null

  const openModule = openIdx !== null ? modules[openIdx] : null

  return (
    <div className="so-zigzag">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {chunks.map((chunk, ci) => (
          <SectionZigzagRow
            key={ci}
            modules={chunk}
            startIndex={ci * MAX_PER_ROW}
            totalColumns={rowColumns}
            onOpen={(i) => setOpenIdx(i)}
            streamingIdx={streamingIdx}
          />
        ))}
      </div>

      {isStreaming && (
        <div className="so-streaming-pill" aria-live="polite">
          <span className="so-pulse" />
          Writing
          {modules.length > 0 ? ` module ${modules.length + 1}` : ''}…
        </div>
      )}

      {openModule !== null && openIdx !== null && (
        <ModuleOverlay
          index={openIdx}
          module={openModule}
          onClose={() => setOpenIdx(null)}
        />
      )}

      <ZigzagStyles />
    </div>
  )
}

// ─── Modal overlay (PFCheckoutPreview-styled card with same placeholder) ─────

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
  const hue = HUES[index % HUES.length]
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

        {/* Same colored placeholder as the zigzag card, 16:9 cover */}
        <SectionThumbPlaceholder
          hue={hue}
          n={index + 1}
          aspect="16 / 9"
          radius="16px 16px 0 0"
        />

        <div className="so-modal-body">
          <div className="so-modal-eyebrow">Section {index + 1}</div>
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

// ─── Series episode strip ─────────────────────────────────────────────────────
// Series have a single implicit module containing every episode. The zigzag
// roadmap is wrong here — it implies a four-step progression. We render a
// flat episode grid instead: each card is one episode, in arc order, with
// the same Apple-TV cinematic placeholder so the visual language matches the
// published series landing.

function SeriesEpisodeStrip({
  outline,
  isStreaming,
}: {
  outline: PartialOutline
  isStreaming: boolean
}) {
  const seasonModule = outline.modules?.[0]
  const episodes = seasonModule?.lessons ?? []
  if (episodes.length === 0 && !isStreaming) return null

  const streamingIdx = isStreaming ? episodes.length - 1 : -1

  return (
    <div className="so-zigzag">
      {seasonModule?.title && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: 28,
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'oklch(0.66 0.006 280)',
              marginBottom: 6,
            }}
          >
            The season
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'oklch(0.18 0.008 280)',
              maxWidth: 520,
              margin: '0 auto',
            }}
          >
            {seasonModule.title}
          </div>
          {seasonModule.description && (
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: 'oklch(0.50 0.006 280)',
                lineHeight: 1.5,
                maxWidth: 520,
                margin: '6px auto 0',
              }}
            >
              {seasonModule.description}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {episodes.map((ep, idx) => {
          const hue = HUES[idx % HUES.length]
          const streaming = idx === streamingIdx
          return (
            <div
              key={idx}
              className={`so-card${streaming ? ' streaming' : ''}`}
              style={{
                background: 'white',
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid oklch(0.945 0.003 280)',
                boxShadow:
                  '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              <SectionThumbPlaceholder
                hue={hue}
                n={idx + 1}
                aspect="16 / 9"
                radius="14px 14px 0 0"
              />
              <div style={{ padding: '12px 14px 14px' }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'oklch(0.66 0.006 280)',
                    marginBottom: 4,
                  }}
                >
                  {`Episode ${String(idx + 1).padStart(2, '0')}`}
                  {ep?.content_type === 'text' ? ' · Notes' : ''}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '-0.018em',
                    color: 'oklch(0.18 0.008 280)',
                    lineHeight: 1.3,
                  }}
                >
                  {ep?.title || (
                    <span
                      style={{
                        display: 'inline-block',
                        height: 14,
                        width: 160,
                        background: 'oklch(0.92 0.006 280)',
                        borderRadius: 4,
                        animation: 'soPulseBg 1.4s ease-in-out infinite',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {isStreaming && (
        <div className="so-streaming-pill" aria-live="polite">
          <span className="so-pulse" />
          Writing
          {episodes.length > 0 ? ` episode ${episodes.length + 1}` : ''}…
        </div>
      )}

      <ZigzagStyles />
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
  format = 'course',
}: {
  title: string
  partialOutline: PartialOutline
  isStreaming: boolean
  error: string | null
  onRegenerate: () => void
  onCreate: () => void
  onClose: () => void
  format?: 'course' | 'series'
}) {
  const isSeries = format === 'series'
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
          maxWidth: 880,
          margin: '0 auto',
          padding: '88px 32px 64px',
          background: '#fff',
        }}
      >
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
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
            {isSeries
              ? `${lessonsCount} ${lessonsCount === 1 ? 'episode' : 'episodes'}`
              : `${modulesCount} modules · ${lessonsCount} lessons`}
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
              maxWidth: 640,
              margin: '0 auto 16px',
            }}
          >
            {error}
          </div>
        )}

        {isSeries ? (
          <SeriesEpisodeStrip
            outline={partialOutline}
            isStreaming={isStreaming}
          />
        ) : (
          <ZigzagOutline
            outline={partialOutline}
            isStreaming={isStreaming}
          />
        )}

        <div
          style={{
            marginTop: 40,
            padding: '12px 16px',
            borderRadius: 10,
            border: '1.5px solid #e8e8e8',
            background: '#f4f4f4',
            fontSize: 12,
            color: '#a0a0a0',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            textAlign: 'center',
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {isSeries
            ? 'This is just a starting point — you can edit episodes and content after creating the series.'
            : 'This outline is just a starting point — you can edit modules, lessons, and content after creating the course.'}
        </div>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
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
            Preview your Original
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function ZigzagStyles() {
  return (
    <style jsx global>{`
      .so-zigzag {
        --so-ink: oklch(0.18 0.012 270);
        --so-ink-2: oklch(0.36 0.012 270);
        --so-muted: oklch(0.56 0.014 270);
        --so-muted-2: oklch(0.72 0.012 270);
        --so-hair: oklch(0.92 0.006 270);
        --so-hair-strong: oklch(0.86 0.008 270);
        --so-surface: #ffffff;
        --so-surface-2: oklch(0.975 0.004 270);
        --so-surface-3: oklch(0.955 0.006 270);
        --so-shadow-lg: 0 4px 12px oklch(0.2 0.02 270 / 0.06),
          0 24px 60px oklch(0.2 0.02 270 / 0.18);
        font-family: var(--font-poppins), system-ui, sans-serif;
      }

      .so-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06),
          0 18px 44px rgba(0, 0, 0, 0.12) !important;
      }
      .so-card.streaming {
        animation: soCardPulse 1.6s ease-in-out infinite;
      }
      @keyframes soCardPulse {
        0%,
        100% {
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04),
            0 12px 32px rgba(0, 0, 0, 0.08), 0 0 0 0 oklch(0.18 0.012 270 / 0.18);
        }
        50% {
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04),
            0 12px 32px rgba(0, 0, 0, 0.08),
            0 0 0 6px oklch(0.18 0.012 270 / 0);
        }
      }

      .so-streaming-pill {
        margin: 24px auto 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        font-size: 12px;
        color: var(--so-muted);
        background: var(--so-surface-2);
        border: 1px dashed var(--so-hair-strong);
        border-radius: 999px;
      }
      .so-zigzag {
        text-align: center;
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
        text-align: left;
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
        font-weight: 700;
        color: var(--so-ink);
        letter-spacing: -0.018em;
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
