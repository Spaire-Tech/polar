'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { useOnboardingTracking } from '@/hooks/onboarding'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const PROFILE_TYPES = [
  {
    id: 'creator',
    label: 'Digital Creator',
    description: 'Build your following and explore ways to monetize your audience.',
    emoji: '🎨',
    bg: 'bg-purple-100',
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Grow my business and reach more customers.',
    emoji: '💼',
    bg: 'bg-blue-100',
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Share my work and connect with my audience.',
    emoji: '👤',
    bg: 'bg-green-100',
  },
] as const

type ProfileType = (typeof PROFILE_TYPES)[number]['id']

export default function WelcomePage() {
  const router = useRouter()
  const { updateSurveyAnswers } = useOnboardingTracking()
  const [selected, setSelected] = useState<ProfileType | null>(null)

  const handleContinue = () => {
    if (!selected) return
    updateSurveyAnswers({ audience_type: selected })
    router.push('/dashboard/create')
  }

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-10">
      <LogoIcon size={36} />

      <div className="w-full">
        <OnboardingProgressBar currentStep={1} totalSteps={4} />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Which best describes your goal?
        </h1>
        <p className="text-sm text-gray-500">
          This helps us personalize your experience.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {PROFILE_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setSelected(type.id)}
            className={twMerge(
              'flex cursor-pointer flex-row items-center gap-4 rounded-2xl border-2 bg-white p-5 text-left transition-all',
              selected === type.id
                ? 'border-gray-900 shadow-sm'
                : 'border-gray-200 hover:border-gray-300',
            )}
          >
            <div
              className={twMerge(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl',
                type.bg,
              )}
            >
              {type.emoji}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">
                {type.label}
              </span>
              <span className="text-sm leading-relaxed text-gray-500">
                {type.description}
              </span>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={handleContinue}
        className={twMerge(
          'w-full rounded-full py-4 text-sm font-semibold text-white transition-all',
          selected
            ? 'cursor-pointer bg-blue-600 hover:bg-blue-700'
            : 'cursor-not-allowed bg-gray-300',
        )}
      >
        Continue
      </button>
    </div>
  )
}
