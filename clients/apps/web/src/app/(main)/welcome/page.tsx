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
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <defs>
          <linearGradient id="cr-a" x1="40" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff6435" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="cr-b" x1="10" y1="72" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="cr-c" x1="70" y1="72" x2="44" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        {/* Top orange facet */}
        <polygon points="40,8 55,40 25,40" fill="url(#cr-a)" />
        {/* Bottom-left yellow facet */}
        <polygon points="25,40 10,72 40,72" fill="url(#cr-b)" />
        {/* Bottom-right amber facet */}
        <polygon points="55,40 70,72 40,72" fill="url(#cr-c)" />
        {/* Center inverted facet */}
        <polygon points="25,40 55,40 40,72" fill="#f59e0b" />
      </svg>
    ),
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Operate and scale your business globally.',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <defs>
          <linearGradient id="biz-a" x1="28" y1="10" x2="68" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="biz-b" x1="8" y1="34" x2="50" y2="66" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        {/* Purple parallelogram — upper area */}
        <path d="M28 10 L64 10 L70 38 L34 38 Z" fill="url(#biz-a)" />
        {/* Teal triangle — lower-left, overlaps center */}
        <path d="M8 34 L50 34 L28 66 Z" fill="url(#biz-b)" />
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
