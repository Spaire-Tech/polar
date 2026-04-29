'use client'

import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined'
import { useState } from 'react'

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}
type PartialOutline = { modules?: PartialModule[] }

function StreamingOutline({
  outline,
  isStreaming,
}: {
  outline: PartialOutline
  isStreaming: boolean
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const toggle = (i: number) =>
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))
  const modules = outline.modules ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {modules.map((mod, i) => {
        const lessons = mod.lessons ?? []
        const isLast = i === modules.length - 1
        const borderColor =
          isStreaming && isLast ? '#0a0a0a' : '#e8e8e8'
        return (
          <div
            key={i}
            style={{
              overflow: 'hidden',
              borderRadius: 12,
              border: `1.5px solid ${borderColor}`,
              background: '#f4f4f4',
              transition: 'border-color 0.25s',
            }}
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                color: '#0a0a0a',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#e8e8e8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                  color: '#6a6a6a',
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#0a0a0a',
                }}
              >
                {mod.title || (
                  <span
                    style={{
                      display: 'inline-block',
                      height: 14,
                      width: 192,
                      background: '#e8e8e8',
                      borderRadius: 4,
                      animation: 'soPulseBg 1.4s ease-in-out infinite',
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 12,
                  color: '#a0a0a0',
                }}
              >
                {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
              </span>
              <ExpandMoreOutlined
                style={{
                  fontSize: 18,
                  color: '#a0a0a0',
                  transform: expanded[i] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
            {expanded[i] && lessons.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid #e8e8e8',
                  background: '#fff',
                }}
              >
                {lessons.map((lesson, j) => (
                  <div
                    key={j}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 16px 10px 52px',
                      borderTop: j > 0 ? '1px solid #f4f4f4' : 'none',
                    }}
                  >
                    {lesson.content_type === 'video' ? (
                      <OndemandVideoOutlined
                        style={{
                          fontSize: 16,
                          color: '#7c3aed',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <TextSnippetOutlined
                        style={{
                          fontSize: 16,
                          color: '#a0a0a0',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        color: '#6a6a6a',
                        fontFamily:
                          'var(--font-poppins), system-ui, sans-serif',
                      }}
                    >
                      {lesson.title || (
                        <span
                          style={{
                            display: 'inline-block',
                            height: 12,
                            width: 160,
                            background: '#e8e8e8',
                            borderRadius: 4,
                            animation: 'soPulseBg 1.4s ease-in-out infinite',
                          }}
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {isStreaming && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            fontSize: 12,
            color: '#a0a0a0',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#0a0a0a',
              animation: 'soPulseBg 1s ease-in-out infinite',
            }}
          />
          Writing
          {modules.length > 0 ? ` module ${modules.length + 1}` : ''}…
        </div>
      )}
      <style jsx global>{`
        @keyframes soPulseBg {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

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
          maxWidth: 640,
          margin: '0 auto',
          padding: '96px 24px 64px',
          background: '#fff',
        }}
      >
        <div style={{ marginBottom: 28 }}>
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

        <StreamingOutline outline={partialOutline} isStreaming={isStreaming} />

        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 10,
            border: '1.5px solid #e8e8e8',
            background: '#f4f4f4',
            fontSize: 12,
            color: '#a0a0a0',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
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
