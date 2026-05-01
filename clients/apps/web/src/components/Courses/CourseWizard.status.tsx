'use client'

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
  phase = 'outline',
}: {
  title: string
  modulesCount: number
  lessonsCount: number
  onClose: () => void
  phase?: 'outline' | 'landing'
}) {
  const heading =
    phase === 'landing' ? 'Writing your landing page' : 'Crafting your outline'
  const sub =
    phase === 'landing'
      ? `${title ? `"${title}" — ` : ''}building hero, curriculum, instructor block, reviews…`
      : `${title ? `"${title}" — ` : ''}${modulesCount} module${modulesCount === 1 ? '' : 's'} · ${lessonsCount} lesson${lessonsCount === 1 ? '' : 's'} · generating…`
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
          background: '#fff',
        }}
      >
        {/* Spinner ring */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            border: '1.5px solid #e8e8e8',
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
              border: '1.5px solid #c8c8c8',
              animation: 'soPulse 1.6s ease-out infinite',
            }}
          />
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid #e8e8e8',
              borderTopColor: '#0a0a0a',
              animation: 'soSpin 0.9s linear infinite',
            }}
          />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            fontSize: 'clamp(22px, 3vw, 32px)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: '#0a0a0a',
            margin: 0,
          }}
        >
          {heading}
        </h2>
        <p
          style={{
            marginTop: 10,
            fontSize: 14,
            color: '#a0a0a0',
            maxWidth: 420,
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          {sub}
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
            opacity: 0.5;
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
          background: '#fff',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#f4f4f4',
            border: '1.5px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          {/* Checkmark */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14l6 6 10-12"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            margin: 0,
            color: '#0a0a0a',
          }}
        >
          Creating your course
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: '#a0a0a0',
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          Setting everything up…
        </p>
      </div>
    </>
  )
}
