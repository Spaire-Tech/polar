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
          height: 52,
          background: '#000',
          flexShrink: 0,
          position: 'relative',
          zIndex: 20,
        }}
      />

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
            padding: '0 88px 110px',
            width: 'min(560px, 44vw)',
          }}
        >
          {displayName && (
            <div
              style={{
                fontFamily: 'var(--font-barlow-condensed), Impact, sans-serif',
                fontWeight: instructorNameBold ? 800 : 700,
                fontStyle: instructorNameItalic ? 'italic' : 'normal',
                fontSize: 'clamp(48px, 4.6vw, 76px)',
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
                height: 2,
                background: '#fff',
                margin: '26px auto 22px',
              }}
            />
          )}

          {courseTitle && (
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.98)',
                letterSpacing: '-0.005em',
                marginBottom: 26,
              }}
            >
              {courseTitle}
            </div>
          )}

          {description && (
            <p
              style={{
                fontSize: 15.5,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.78)',
                lineHeight: 1.55,
                maxWidth: 420,
                marginBottom: 36,
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
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
            >
              <PlayArrow sx={{ fontSize: 18 }} />
              {isStarted ? 'Continue Class' : 'Start Class'}
            </button>
            <button
              type="button"
              onClick={onTrailer}
              className="inline-flex items-center rounded-full px-6 py-3 text-[15px] font-medium text-white backdrop-blur-md transition-colors"
              style={{ background: 'rgba(30,30,30,0.85)' }}
            >
              Trailer
            </button>
            <button
              type="button"
              aria-label="Add"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-xl font-light text-white transition-colors hover:bg-white/10"
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
