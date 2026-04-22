'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { useOnboardingTracking } from '@/hooks/onboarding'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const PROFILE_TYPES = [
  {
    id: 'creator',
    label: 'Digital Creator',
    description: 'Turn what you create into products people can buy.',
    illustration: (
      // Glowing purple/pink orb — vibrant creative energy
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <defs>
          <radialGradient id="wc-cr-bg" cx="50%" cy="50%" r="70.7%">
            <stop offset="0%" stopColor="#cc00ff" />
            <stop offset="55%" stopColor="#7700cc" />
            <stop offset="100%" stopColor="#38007f" />
          </radialGradient>
          <radialGradient id="wc-cr-glow" cx="50%" cy="46%" r="40%">
            <stop offset="0%" stopColor="#ff8877" stopOpacity="1" />
            <stop offset="50%" stopColor="#ff3366" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff3366" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="80" height="80" fill="url(#wc-cr-bg)" />
        <rect width="80" height="80" fill="url(#wc-cr-glow)" />
      </svg>
    ),
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Operate and scale your business globally.',
    illustration: (
      // Dark app icon with 3D white navigation cursor
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <defs>
          <radialGradient id="wc-biz-bg" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#2e2e2e" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </radialGradient>
          <linearGradient id="wc-biz-arrow" x1="24" y1="18" x2="50" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#d4d4d4" />
            <stop offset="100%" stopColor="#8a8a8a" />
          </linearGradient>
          <clipPath id="wc-biz-clip">
            <rect width="80" height="80" />
          </clipPath>
        </defs>
        <rect width="80" height="80" fill="url(#wc-biz-bg)" />
        {/* Subtle angular facet reflections */}
        <g clipPath="url(#wc-biz-clip)">
          <path d="M0 0 L50 0 L80 30 L80 0 Z" fill="#000" opacity="0.18" />
          <path d="M0 50 L0 80 L30 80 Z" fill="#000" opacity="0.18" />
          <path d="M52 80 L80 80 L80 52 Z" fill="#000" opacity="0.12" />
        </g>
        {/* 3D navigation/send cursor pointing upper-left */}
        <path
          d="M22 20 L22 56 L34 44 L44 62 L52 58 L42 40 L60 32 Z"
          fill="url(#wc-biz-arrow)"
        />
      </svg>
    ),
  },
] as const

type ProfileType = (typeof PROFILE_TYPES)[number]['id']

export default function WelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { updateSurveyAnswers } = useOnboardingTracking()
  const [selected, setSelected] = useState<ProfileType | null>(null)

  const handleContinue = () => {
    if (!selected) return
    updateSurveyAnswers({ audience_type: selected })
    // Always pass from_welcome=true so create/page.tsx knows welcome was shown
    const params = new URLSearchParams({ from_welcome: 'true' })
    const slug = searchParams.get('slug')
    const auto = searchParams.get('auto')
    if (slug) params.set('slug', slug)
    if (auto) params.set('auto', auto)
    router.push(`/dashboard/create?${params}`)
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-white">
      {/* Progress bar pinned to top */}
      <div className="flex justify-center px-4 pt-10">
        <div className="w-full max-w-lg">
          <OnboardingProgressBar currentStep={1} totalSteps={3} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center px-4 pt-16 pb-40">
        <div className="flex w-full max-w-lg flex-col gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Which best describes your goal for using Spaire?
            </h1>
            <p className="text-sm text-gray-400">
              This helps us personalize your experience.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PROFILE_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelected(type.id)}
                className={twMerge(
                  'flex cursor-pointer flex-row items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left transition-all',
                  selected === type.id
                    ? 'border-2 border-gray-900'
                    : 'border border-gray-200 hover:border-gray-400',
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-bold text-gray-900">
                    {type.label}
                  </span>
                  <span className="text-[13px] leading-snug text-gray-500">
                    {type.description}
                  </span>
                </div>
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  {type.illustration}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Continue at the bottom */}
      <div className="sticky bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-5">
        <div className="mx-auto w-full max-w-lg">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected}
            className={twMerge(
              'w-full rounded-full py-4 text-sm font-semibold text-white transition-all',
              selected
                ? 'cursor-pointer bg-[#7c3aed] hover:bg-[#6d28d9]'
                : 'cursor-default bg-gray-300',
            )}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
