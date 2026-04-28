'use client'

import PlayArrow from '@mui/icons-material/PlayArrow'

interface MasterClassHeroProps {
  courseTitle: string | null
  organizationName: string | null
  description: string | null
  thumbnailUrl: string | null
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
      className="relative w-screen min-h-screen flex flex-col items-center justify-center bg-black bg-cover bg-center overflow-hidden -ml-[50vw] left-[50%]"
      style={{
        backgroundImage,
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center text-white max-w-2xl px-6">
        {/* Organization/Instructor name in serif */}
        {organizationName && (
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold mb-4">
            {organizationName}
          </h2>
        )}

        {/* Thin divider */}
        {organizationName && courseTitle && (
          <div className="w-12 h-px bg-white/40 mb-6" />
        )}

        {/* Course title */}
        {courseTitle && (
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight">
            {courseTitle}
          </h1>
        )}

        {/* Description */}
        {description && (
          <p className="text-base sm:text-lg text-white/80 mb-8 max-w-xl leading-relaxed">
            {description}
          </p>
        )}

        {/* Progress bar if started */}
        {isStarted && totalLessons > 0 && (
          <div className="w-full max-w-xs mb-8">
            <div className="mb-2 flex items-center justify-between text-sm text-white/70">
              <span>
                {Math.round(
                  (completionPercent / 100) * totalLessons
                )} of {totalLessons} lessons
              </span>
              <span className="font-medium">{Math.round(completionPercent)}%</span>
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
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            <PlayArrow sx={{ fontSize: 20 }} />
            {isStarted ? 'Continue Class' : 'Start Class'}
          </button>

          <button
            onClick={onTrailer}
            className="px-6 py-3 border border-white/40 text-white font-semibold rounded-lg hover:border-white/60 hover:bg-white/5 transition-colors"
          >
            Trailer
          </button>

          <button className="flex items-center justify-center h-11 w-11 border border-white/40 text-white rounded-lg hover:border-white/60 hover:bg-white/5 transition-colors">
            +
          </button>
        </div>
      </div>
    </div>
  )
}
