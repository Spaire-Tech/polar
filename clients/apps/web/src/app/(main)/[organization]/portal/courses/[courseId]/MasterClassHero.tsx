'use client'

import PlayArrow from '@mui/icons-material/PlayArrow'

interface MasterClassHeroProps {
  courseTitle: string | null
  organizationName: string | null
  description: string | null
  thumbnailUrl: string | null
  thumbnailObjectPosition?: string | null
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
  isStarted,
  totalLessons,
  completionPercent,
  onStart,
  onTrailer,
}: MasterClassHeroProps) => {
  const backgroundImage = thumbnailUrl
    ? `url('${thumbnailUrl}')`
    : 'linear-gradient(135deg, #1a1a1a 0%, #000 100%)'

  return (
    <div
      className="relative w-screen min-h-screen flex flex-col items-center justify-center bg-black bg-cover overflow-hidden -ml-[50vw] left-[50%]"
      style={{
        backgroundImage,
        backgroundAttachment: 'fixed',
        backgroundPosition: thumbnailObjectPosition ?? 'center',
      }}
    >
      {/* Dark overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-6 text-center text-white">
        {/* Organization/Instructor name in serif */}
        {organizationName && (
          <h2 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            {organizationName}
          </h2>
        )}

        {/* Thin divider */}
        {organizationName && courseTitle && (
          <div className="mt-8 h-px w-12 bg-white/50" />
        )}

        {/* Course title */}
        {courseTitle && (
          <h1 className="mt-8 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            {courseTitle}
          </h1>
        )}

        {/* Description */}
        {description && (
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            {description}
          </p>
        )}

        {/* Progress bar if started */}
        {isStarted && totalLessons > 0 && (
          <div className="mt-10 w-full max-w-xs">
            <div className="mb-2 flex items-center justify-between text-sm text-white/70">
              <span>
                {Math.round(
                  (completionPercent / 100) * totalLessons,
                )}{' '}
                of {totalLessons} lessons
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

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={onStart}
            className="flex items-center gap-2 rounded-md bg-white px-7 py-3 text-base font-semibold text-black transition-colors hover:bg-gray-100"
          >
            <PlayArrow sx={{ fontSize: 20 }} />
            {isStarted ? 'Continue Class' : 'Start Class'}
          </button>

          <button
            onClick={onTrailer}
            className="rounded-md border border-white/40 bg-black/30 px-7 py-3 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-black/40"
          >
            Trailer
          </button>

          <button className="flex h-12 w-12 items-center justify-center rounded-md border border-white/40 bg-black/30 text-2xl font-light text-white backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-black/40">
            +
          </button>
        </div>
      </div>
    </div>
  )
}
