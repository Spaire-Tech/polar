'use client'

import Pill from '@polar-sh/ui/components/atoms/Pill'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface OnboardingRailProps {
  organizationId: string
}

type StepStatus = 'completed' | 'current' | 'pending'

const steps: { id: string; label: string; status: StepStatus }[] = [
  { id: 'business', label: 'Business details', status: 'current' },
  { id: 'identity', label: 'Identity verification', status: 'pending' },
  { id: 'banking', label: 'Banking features activation', status: 'pending' },
  { id: 'cards', label: 'Cards enabled', status: 'pending' },
  { id: 'ready', label: 'Ready to spend', status: 'pending' },
]

const statusPill: Record<StepStatus, { label: string; color: 'green' | 'blue' | 'gray' }> = {
  completed: { label: 'Complete', color: 'green' },
  current: { label: 'Action required', color: 'blue' },
  pending: { label: 'Pending', color: 'gray' },
}

export default function OnboardingRail({
  organizationId: _organizationId,
}: OnboardingRailProps) {
  const params = useParams<{ organization: string }>()

  // In production, step statuses would come from API data
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const allCompleted = completedCount === steps.length
  const currentStep = steps.find((s) => s.status === 'current')

  if (allCompleted) {
    return null
  }

  return (
    <ShadowBoxOnMd>
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Account Setup</h2>
          <span className="dark:text-polar-500 text-sm text-gray-500">
            {completedCount}/{steps.length}
          </span>
        </div>

        <div className="flex flex-col gap-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-center justify-between py-1"
            >
              <div className="flex items-center gap-2">
                <span className="dark:text-polar-400 w-5 text-center text-xs text-gray-400">
                  {index + 1}
                </span>
                <span
                  className={`text-sm ${
                    step.status === 'completed'
                      ? 'dark:text-polar-500 text-gray-400 line-through'
                      : step.status === 'current'
                        ? 'font-medium'
                        : 'dark:text-polar-500 text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <Pill color={statusPill[step.status].color}>
                {statusPill[step.status].label}
              </Pill>
            </div>
          ))}
        </div>

        {currentStep && (
          <Link
            href={`/dashboard/${params.organization}/finance/account`}
          >
            <Button fullWidth size="sm">
              Continue Setup
            </Button>
          </Link>
        )}
      </div>
    </ShadowBoxOnMd>
  )
}
