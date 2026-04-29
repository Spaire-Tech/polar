'use client'

import PlayArrow from '@mui/icons-material/PlayArrow'

interface MasterClassHeroProps {
  courseTitle: string | null
  organizationName: string | null
  description: string | null
  thumbnailUrl: string | null
  thumbnailObjectPosition?: string | null
  trailerUrl?: string | null
  instructorName?: string | null
  instructorNameItalic?: boolean
  instructorNameBold?: boolean
  instructorNameUppercase?: boolean
  isStarted: boolean
  totalLessons: number
  completionPercent: number
  onStart: () => void
  onTrailer: () => void
}

export const MasterClassHero = ({
  courseTitle,
  organizationName,
  description,
  thumbnailUrl,
  thumbnailObjectPosition,
  trailerUrl,
  instructorName,
  instructorNameItalic = true,
  instructorNameBold = true,
  instructorNameUppercase = true,
  isStarted,
  totalLessons,
  completionPercent,
  onStart,
  onTrailer,
}: MasterClassHeroProps) => {
  const displayName = instructorName ?? organizationName

  return (
    <div
      className="relative left-[50%] -ml-[50vw] flex h-screen w-screen flex-col overflow-hidden bg-black"
      style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' }}
    >
      {/* Nav bar */}
      <div
        style={{
          height: 56,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 40,
          flexShrink: 0,
          position: 'relative',
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '-0.02em',
            color: '#fff',
          }}
        >
          Spaire
        </span>
      </div>

      {/* Hero body */}
      <div className="relative flex-1 overflow-hidden">
        {/* Background: trailer video > thumbnail image > gradient fallback */}
        {trailerUrl ? (
          <video
            src={trailerUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: thumbnailObjectPosition ?? 'center' }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
            }}
          />
        )}

        {/* Side-vignette gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.75) 20%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.1) 65%, rgba(0,0,0,0.0) 100%)',
          }}
        />

        {/* Content block: bottom-left column, contents centered */}
        <div
          className="absolute bottom-0 left-0 z-10 flex flex-col items-center text-center text-white"
          style={{
            padding: '0 64px 72px',
            width: 'min(620px, 50vw)',
          }}
        >
          {displayName && (
            <div
              style={{
                fontFamily: 'var(--font-barlow-condensed), Impact, sans-serif',
                fontWeight: instructorNameBold ? 800 : 700,
                fontStyle: instructorNameItalic ? 'italic' : 'normal',
                fontSize: 'clamp(64px, 7.5vw, 112px)',
                lineHeight: 0.92,
                letterSpacing: '0.01em',
                textTransform: instructorNameUppercase ? 'uppercase' : 'none',
                width: '100%',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
          )}

          {displayName && courseTitle && (
            <div
              style={{
                width: 30,
                height: 2.5,
                background: '#fff',
                margin: '22px auto 18px',
              }}
            />
          )}

          {courseTitle && (
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.96)',
                letterSpacing: '0.005em',
                marginBottom: 32,
              }}
            >
              {courseTitle}
            </div>
          )}

          {description && (
            <p
              style={{
                fontSize: 13.5,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.65,
                maxWidth: 340,
                marginBottom: 40,
              }}
            >
              {description}
            </p>
          )}

          {/* Progress */}
          {isStarted && totalLessons > 0 && (
            <div className="mb-5 w-full max-w-xs">
              <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                <span>
                  {Math.round((completionPercent / 100) * totalLessons)} of{' '}
                  {totalLessons} lessons
                </span>
                <span className="font-medium">
                  {Math.round(completionPercent)}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              <PlayArrow sx={{ fontSize: 16 }} />
              {isStarted ? 'Continue Class' : 'Start Class'}
            </button>
            <button
              type="button"
              onClick={onTrailer}
              className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-colors"
              style={{ background: 'rgba(30,30,30,0.85)' }}
            >
              Trailer
            </button>
            <button
              type="button"
              aria-label="Add"
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-light text-white transition-colors hover:bg-white/10"
              style={{ border: '1.5px solid rgba(255,255,255,0.45)' }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
