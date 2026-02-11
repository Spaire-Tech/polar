'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Fingerprint,
  Landmark,
  Loader2,
  Rocket,
  ShieldCheck,
} from 'lucide-react'

type SetupStep = {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  status: 'completed' | 'current' | 'pending' | 'blocked'
}

export default function EmbeddedAccountPage({
  organization: _organization,
}: {
  organization: schemas['Organization']
}) {
  // In production, step statuses would come from API data
  const steps: SetupStep[] = [
    {
      id: 'business',
      label: 'Business Details',
      description: 'Tell us about your company and what you do',
      icon: <Building2 className="h-5 w-5" />,
      status: 'current',
    },
    {
      id: 'identity',
      label: 'Identity Verification',
      description: 'Verify your identity for regulatory compliance',
      icon: <Fingerprint className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'banking',
      label: 'Banking Features',
      description: 'Activate your financial account and banking rails',
      icon: <Landmark className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'cards',
      label: 'Cards Enabled',
      description: 'Issue virtual and physical cards for your team',
      icon: <CreditCard className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'ready',
      label: 'Ready to Spend',
      description: 'Your embedded finance account is fully set up',
      icon: <Rocket className="h-5 w-5" />,
      status: 'pending',
    },
  ]

  const completedCount = steps.filter((s) => s.status === 'completed').length
  const progress = (completedCount / steps.length) * 100

  return (
    <DashboardBody>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Account Setup
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Complete these steps to unlock banking, cards, and payments.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="dark:text-polar-400 text-sm text-gray-500">
              Progress
            </span>
            <span className="dark:text-polar-300 text-sm font-medium text-gray-700">
              {completedCount} of {steps.length} completed
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-polar-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed'
            const isCurrent = step.status === 'current'
            const isPending =
              step.status === 'pending' || step.status === 'blocked'

            return (
              <ShadowBoxOnMd key={step.id}>
                <div
                  className={`flex items-center gap-4 p-5 ${
                    isCurrent
                      ? 'ring-2 ring-blue-500 ring-inset rounded-xl'
                      : ''
                  }`}
                >
                  {/* Step Number/Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? 'border-2 border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                          : 'border-2 border-gray-200 text-gray-400 dark:border-polar-600 dark:text-polar-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isCurrent ? (
                      <Loader2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {step.icon}
                      <h3
                        className={`text-sm font-semibold ${
                          isCompleted
                            ? 'text-gray-500 dark:text-polar-400'
                            : isCurrent
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-400 dark:text-polar-500'
                        }`}
                      >
                        {step.label}
                      </h3>
                      {isCompleted && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          Complete
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        isCurrent
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-polar-500'
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>

                  {/* Action */}
                  <div>
                    {isCurrent && (
                      <Button size="sm" className="gap-1.5">
                        Continue
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isCompleted && (
                      <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    )}
                    {isPending && (
                      <ChevronRight className="dark:text-polar-600 h-5 w-5 text-gray-300" />
                    )}
                  </div>
                </div>
              </ShadowBoxOnMd>
            )
          })}
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Need help? Contact support if you&apos;re stuck on any step.
          </p>
        </div>
      </div>
    </DashboardBody>
  )
}
