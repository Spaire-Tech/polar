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
      // Camera / play icon on lime green — clearly "content creation"
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <rect width="80" height="80" rx="16" fill="#c8f135" />
        {/* Camera body */}
        <rect x="12" y="28" width="42" height="30" rx="6" fill="#1a1a1a" />
        {/* Lens ring */}
        <circle cx="33" cy="43" r="10" fill="#2d2d2d" />
        <circle cx="33" cy="43" r="6.5" fill="#111" />
        <circle cx="33" cy="43" r="3.5" fill="#444" />
        <circle cx="35" cy="41" r="1.2" fill="#888" />
        {/* Viewfinder bump */}
        <rect x="36" y="20" width="14" height="10" rx="3" fill="#1a1a1a" />
        {/* Flash dot */}
        <circle cx="50" cy="33" r="3" fill="#c8f135" />
        {/* Play triangle on right */}
        <polygon points="64,34 64,52 76,43" fill="#1a1a1a" />
      </svg>
    ),
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Operate and scale your business globally.',
    illustration: (
      // Briefcase on deep indigo — clearly "professional / corporate"
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <rect width="80" height="80" rx="16" fill="#312e81" />
        {/* Briefcase body */}
        <rect x="14" y="34" width="52" height="34" rx="7" fill="#e0e7ff" />
        {/* Handle */}
        <path d="M30 34V28a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" stroke="#e0e7ff" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Centre latch bar */}
        <rect x="14" y="47" width="52" height="5" rx="2.5" fill="#a5b4fc" />
        {/* Latch circle */}
        <circle cx="40" cy="49.5" r="4" fill="#312e81" />
        <circle cx="40" cy="49.5" r="2" fill="#a5b4fc" />
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
