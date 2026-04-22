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
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/icon-creator.png" alt="Digital Creator" className="h-full w-full object-cover" />
    ),
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Operate and scale your business globally.',
    illustration: (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/icon-business.png" alt="Business" className="h-full w-full object-cover" />
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
