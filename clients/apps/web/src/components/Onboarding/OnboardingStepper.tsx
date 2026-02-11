'use client'

import LogoIcon from '../Brand/LogoIcon'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { twMerge } from 'tailwind-merge'

export interface OnboardingStep {
  id: string
  label: string
  description: string
}

const defaultSteps: OnboardingStep[] = [
  {
    id: 'organization',
    label: 'Your Organization',
    description: 'Set up your workspace',
  },
  {
    id: 'product',
    label: 'First Product',
    description: 'Create something to sell',
  },
  {
    id: 'integrate',
    label: 'Go Live',
    description: 'Connect to your app',
  },
]

export interface OnboardingStepperProps {
  currentStep: number
  steps?: OnboardingStep[]
}

export const OnboardingStepper = ({
  currentStep,
  steps = defaultSteps,
}: OnboardingStepperProps) => {
  return (
    <div className="dark:bg-polar-900 hidden h-full w-80 shrink-0 flex-col justify-between bg-gray-50 p-8 md:flex">
      <div className="flex flex-col gap-y-12">
        <LogoIcon size={40} />
        <div className="flex flex-col gap-y-1">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep
            const isActive = index === currentStep
            const isPending = index > currentStep

            return (
              <div key={step.id} className="flex flex-row gap-x-4">
                <div className="flex flex-col items-center">
                  <div
                    className={twMerge(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                      isCompleted &&
                        'bg-blue-500 text-white',
                      isActive &&
                        'dark:border-polar-500 border-2 border-blue-500 text-blue-500 dark:text-blue-400',
                      isPending &&
                        'dark:border-polar-700 dark:text-polar-500 border-2 border-gray-200 text-gray-400',
                    )}
                  >
                    {isCompleted ? (
                      <CheckOutlined fontSize="small" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={twMerge(
                        'my-1 h-8 w-0.5',
                        isCompleted
                          ? 'bg-blue-500'
                          : 'dark:bg-polar-700 bg-gray-200',
                      )}
                    />
                  )}
                </div>
                <div className="flex flex-col pt-0.5">
                  <span
                    className={twMerge(
                      'text-sm font-medium',
                      isActive
                        ? 'text-gray-900 dark:text-white'
                        : 'dark:text-polar-400 text-gray-500',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="dark:text-polar-500 text-xs text-gray-400">
                    {step.description}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <p className="dark:text-polar-600 text-xs text-gray-400">
        You can always change these settings later.
      </p>
    </div>
  )
}
