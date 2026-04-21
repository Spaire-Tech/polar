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
    label: 'Creator',
    description: 'Build my following and explore ways to monetize my audience.',
    bg: 'bg-[#b5f23c]',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <rect width="80" height="80" rx="14" fill="#b5f23c" />
        {/* Raised-arm figure silhouette */}
        <ellipse cx="40" cy="28" rx="13" ry="13" fill="#7c3aed" />
        <path d="M27 70 Q27 50 40 50 Q53 50 53 70Z" fill="#7c3aed" />
        <path d="M40 28 Q52 20 58 14" stroke="#b5f23c" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="58" cy="12" r="5" fill="#7c3aed" />
      </svg>
    ),
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Grow my business and reach more customers.',
    bg: 'bg-[#6b7280]',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <rect width="80" height="80" rx="14" fill="#6b7280" />
        {/* Business person silhouette */}
        <ellipse cx="40" cy="26" rx="12" ry="12" fill="#9ca3af" />
        <rect x="26" y="40" width="28" height="26" rx="6" fill="#9ca3af" />
        <rect x="34" y="36" width="12" height="8" rx="2" fill="#6b7280" />
      </svg>
    ),
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Share links with my friends and acquaintances.',
    bg: 'bg-[#ef4444]',
    illustration: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <rect width="80" height="80" rx="14" fill="#ef4444" />
        {/* Person silhouette */}
        <ellipse cx="40" cy="27" rx="13" ry="13" fill="#1e3a8a" />
        <path d="M26 72 Q26 50 40 50 Q54 50 54 72Z" fill="#1e3a8a" />
      </svg>
    ),
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
    <div className="flex w-full max-w-md flex-col gap-8">
      {/* Logo */}
      <div className="flex justify-center">
        <LogoIcon size={36} />
      </div>

      {/* Progress bar */}
      <OnboardingProgressBar currentStep={1} totalSteps={4} />

      {/* Heading */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Which best describes your goal?
        </h1>
        <p className="text-sm text-gray-400">
          This helps us personalize your experience.
        </p>
      </div>

      {/* Cards — text left, illustration right — exactly like Linktree */}
      <div className="flex flex-col gap-3">
        {PROFILE_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setSelected(type.id)}
            className={twMerge(
              'flex cursor-pointer flex-row items-center justify-between rounded-2xl border bg-white px-5 py-4 text-left transition-all',
              selected === type.id
                ? 'border-2 border-gray-900'
                : 'border border-gray-200 hover:border-gray-400',
            )}
          >
            <div className="flex flex-col gap-0.5 pr-4">
              <span className="text-sm font-bold text-gray-900">
                {type.label}
              </span>
              <span className="text-xs leading-relaxed text-gray-500">
                {type.description}
              </span>
            </div>
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              {type.illustration}
            </div>
          </button>
        ))}
      </div>

      {/* Continue — purple pill, full width, always visible */}
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
  )
}
