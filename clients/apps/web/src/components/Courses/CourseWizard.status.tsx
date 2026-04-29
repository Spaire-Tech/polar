'use client'

import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import CloseIcon from '@mui/icons-material/Close'

function MinimalTopBar({ onClose }: { onClose: () => void }) {
  return (
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
  )
}

export function GeneratingScreen({
  title,
  modulesCount,
  lessonsCount,
  onClose,
}: {
  title: string
  modulesCount: number
  lessonsCount: number
  onClose: () => void
}) {
  return (
    <>
      <MinimalTopBar onClose={onClose} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: 32,
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              animation: 'soPulse 1.6s ease-out infinite',
            }}
          />
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.15)',
              borderTopColor: 'rgba(255,255,255,0.9)',
              animation: 'soSpin 0.9s linear infinite',
            }}
          />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-instrument-serif), Georgia, serif',
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--so-ink)',
            margin: 0,
          }}
        >
          Crafting your outline
        </h2>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: 'var(--so-ink2)',
            maxWidth: 420,
          }}
        >
          {title ? `“${title}” — ` : ''}
          {modulesCount} module{modulesCount === 1 ? '' : 's'} · {lessonsCount}{' '}
          lesson{lessonsCount === 1 ? '' : 's'} · generating…
        </p>
      </div>
      <style jsx global>{`
        @keyframes soSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes soPulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </>
  )
}

export function CreatingScreen({ onClose }: { onClose: () => void }) {
  return (
    <>
      <MinimalTopBar onClose={onClose} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <CheckCircleOutlined
            style={{ color: 'var(--so-ink)', fontSize: 32 }}
          />
        </div>
        <p
          style={{
            fontFamily: 'var(--font-instrument-serif), Georgia, serif',
            fontSize: 28,
            margin: 0,
            color: 'var(--so-ink)',
          }}
        >
          Creating your course
        </p>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--so-ink2)' }}>
          Setting everything up…
        </p>
      </div>
    </>
  )
}
