'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Fingerprint,
  Landmark,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type OnboardingStep = {
  id: string
  label: string
  icon: React.ReactNode
  status: 'completed' | 'current' | 'pending'
}

interface OnboardingRailProps {
  organizationId: string
}

export default function OnboardingRail({
  organizationId: _organizationId,
}: OnboardingRailProps) {
  const params = useParams<{ organization: string }>()

  // In production, these would come from the API
  // For now, show the onboarding structure with first step as current
  const steps: OnboardingStep[] = [
    {
      id: 'business',
      label: 'Business Details',
      icon: <Building2 className="h-4 w-4" />,
      status: 'current',
    },
    {
      id: 'identity',
      label: 'Identity Verification',
      icon: <Fingerprint className="h-4 w-4" />,
      status: 'pending',
    },
    {
      id: 'banking',
      label: 'Banking Features',
      icon: <Landmark className="h-4 w-4" />,
      status: 'pending',
    },
    {
      id: 'cards',
      label: 'Cards Enabled',
      icon: <CreditCard className="h-4 w-4" />,
      status: 'pending',
    },
  ]

  const currentStep = steps.find((s) => s.status === 'current')
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const allCompleted = completedCount === steps.length

  if (allCompleted) {
    return null
  }

  return (
    <div className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-gray-200 bg-white">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h4 className="dark:text-white text-sm font-semibold text-gray-900">
            Account Setup
          </h4>
          <span className="dark:text-polar-400 text-xs text-gray-500">
            {completedCount}/{steps.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-polar-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{
              width: `${(completedCount / steps.length) * 100}%`,
            }}
          />
        </div>

        {/* Steps */}
        <div className="mt-4 space-y-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                step.status === 'current'
                  ? 'bg-blue-50 dark:bg-blue-500/10'
                  : ''
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  step.status === 'completed'
                    ? 'bg-emerald-500 text-white'
                    : step.status === 'current'
                      ? 'border-2 border-blue-500 text-blue-500'
                      : 'border-2 border-gray-200 text-gray-400 dark:border-polar-600 dark:text-polar-500'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : step.status === 'current' ? (
                  <Loader2 className="h-3 w-3" />
                ) : (
                  step.icon
                )}
              </div>
              <span
                className={`text-sm ${
                  step.status === 'completed'
                    ? 'text-gray-500 line-through dark:text-polar-500'
                    : step.status === 'current'
                      ? 'font-medium text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-polar-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {currentStep && (
          <div className="mt-4">
            <Link
              href={`/dashboard/${params.organization}/finance/embedded/account`}
            >
              <Button size="sm" fullWidth>
                Continue Setup
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
