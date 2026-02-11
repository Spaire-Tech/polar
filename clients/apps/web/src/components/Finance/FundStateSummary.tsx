'use client'

import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { Badge } from '@polar-sh/ui/components/ui/badge'
import { twMerge } from 'tailwind-merge'

const moneyStateLabels: Record<string, string> = {
  pending: 'Pending',
  available: 'Available',
  reserve: 'Reserve',
  spendable: 'Spendable',
}

const onboardingLabels: Record<string, string> = {
  onboarding_required: 'Setup required',
  onboarding_in_progress: 'Setup in progress',
  issuing_active: 'Active',
  temporarily_restricted: 'Temporarily restricted',
}

const moneyStateClasses: Record<string, string> = {
  pending:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400',
  available:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-400',
  reserve:
    'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/40 dark:bg-purple-900/20 dark:text-purple-400',
  spendable:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400',
}

export default function FundStateSummary({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { data: paymentStatus, isLoading } = useOrganizationPaymentStatus(
    organization.id,
  )

  if (isLoading || !paymentStatus) {
    return null
  }

  const moneyState = paymentStatus.money_state
  const onboardingState = paymentStatus.issuing_onboarding_state

  return (
    <ShadowBoxOnMd>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Finance status</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Clear progress from setup to spendable funds.
            </p>
          </div>
          <Badge
            variant="outline"
            className={twMerge(
              'w-fit capitalize',
              moneyStateClasses[moneyState] ?? moneyStateClasses.pending,
            )}
          >
            {moneyStateLabels[moneyState] ?? 'Pending'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['pending', 'available', 'reserve', 'spendable'].map((state) => (
            <div
              key={state}
              className={twMerge(
                'rounded-xl border px-3 py-3',
                moneyStateClasses[state] ?? moneyStateClasses.pending,
              )}
            >
              <p className="text-xs font-medium tracking-wide uppercase opacity-80">
                {moneyStateLabels[state]}
              </p>
              <p className="mt-1 text-sm">
                {moneyState === state ? 'Current state' : 'Not current'}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="dark:border-polar-700 rounded-xl border border-gray-200 p-3">
            <p className="dark:text-polar-500 text-xs font-medium tracking-wide text-gray-500 uppercase">
              Onboarding status
            </p>
            <p className="mt-1 text-sm font-medium dark:text-white">
              {onboardingLabels[onboardingState] ?? 'Setup required'}
            </p>
          </div>
          <div className="dark:border-polar-700 rounded-xl border border-gray-200 p-3">
            <p className="dark:text-polar-500 text-xs font-medium tracking-wide text-gray-500 uppercase">
              What this means
            </p>
            <p className="dark:text-polar-300 mt-1 text-sm">
              Funds move from pending to available, then reserve and spendable
              based on risk and compliance checks.
            </p>
          </div>
        </div>
      </div>
    </ShadowBoxOnMd>
  )
}
