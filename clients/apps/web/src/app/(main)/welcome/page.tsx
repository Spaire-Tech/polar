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
        <rect width="80" height="80" rx="14" fill="#b5f23c" />
        {/* Raised-arm figure silhouette */}
        <ellipse cx="40" cy="28" rx="13" ry="13" fill="#d946ef" />
        <path d="M27 70 Q27 50 40 50 Q53 50 53 70Z" fill="#d946ef" />
        <path d="M40 28 Q52 20 58 14" stroke="#d946ef" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="58" cy="12" r="5" fill="#d946ef" />
      </svg>
    ),
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Operate and scale your business globally.',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <rect width="80" height="80" rx="14" fill="#4c1d95" />
        {/* Business person silhouette */}
        <ellipse cx="40" cy="26" rx="12" ry="12" fill="#d1d5db" />
        <path d="M22 72 Q22 46 40 46 Q58 46 58 72Z" fill="#d1d5db" />
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
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-gray-900">
              Which best describes your
              <br />
              goal for using Spaire?
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
