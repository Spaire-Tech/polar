'use client'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface FinanceStatusBannerProps {
  organizationId: string
}

type OnboardingState =
  | 'onboarding_required'
  | 'onboarding_in_progress'
  | 'temporarily_restricted'
  | 'active'

const stateConfig: Record<
  OnboardingState,
  {
    label: string
    description: string
    icon: React.ReactNode
    variant: 'info' | 'warning' | 'success' | 'error'
    showCta: boolean
    ctaLabel?: string
  }
> = {
  onboarding_required: {
    label: 'Setup Required',
    description:
      'Complete your account setup to access banking, cards, and payments.',
    icon: <AlertTriangle className="h-5 w-5" />,
    variant: 'warning',
    showCta: true,
    ctaLabel: 'Complete Setup',
  },
  onboarding_in_progress: {
    label: 'Setup in Progress',
    description:
      'Your account setup is being reviewed. This usually takes 1-2 business days.',
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
    variant: 'info',
    showCta: false,
  },
  temporarily_restricted: {
    label: 'Temporarily Restricted',
    description:
      'Some features are restricted. Action may be required to restore full access.',
    icon: <ShieldAlert className="h-5 w-5" />,
    variant: 'error',
    showCta: true,
    ctaLabel: 'View Details',
  },
  active: {
    label: 'Active',
    description: 'Your financial account is fully active.',
    icon: <CheckCircle2 className="h-5 w-5" />,
    variant: 'success',
    showCta: false,
  },
}

const variantStyles = {
  info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
  warning:
    'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
  success:
    'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950',
  error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
}

const variantTextStyles = {
  info: 'text-blue-800 dark:text-blue-300',
  warning: 'text-amber-800 dark:text-amber-300',
  success: 'text-emerald-800 dark:text-emerald-300',
  error: 'text-red-800 dark:text-red-300',
}

const variantDescStyles = {
  info: 'text-blue-700 dark:text-blue-400',
  warning: 'text-amber-700 dark:text-amber-400',
  success: 'text-emerald-700 dark:text-emerald-400',
  error: 'text-red-700 dark:text-red-400',
}

export default function FinanceStatusBanner({
  organizationId,
}: FinanceStatusBannerProps) {
  const params = useParams<{ organization: string }>()

  const { data: fundData } = useQuery({
    queryKey: ['fund-lifecycle-status', organizationId],
    queryFn: () =>
      unwrap(
        api.GET(
          '/v1/fund-lifecycle/organizations/{organization_id}/status' as any,
          {
            params: { path: { organization_id: organizationId } },
          },
        ),
      ),
    enabled: !!organizationId,
    refetchInterval: 60_000,
  })

  const { data: financialAccount } = useQuery({
    queryKey: ['financial-account', organizationId],
    queryFn: () =>
      unwrap(
        api.GET(
          '/v1/treasury/organizations/{organization_id}/financial-account' as any,
          {
            params: { path: { organization_id: organizationId } },
          },
        ),
      ),
    enabled: !!organizationId,
    retry: false,
  })

  const status = fundData as any
  const fa = financialAccount as any

  // Derive onboarding state from available data
  let state: OnboardingState = 'onboarding_required'
  if (fa) {
    if (fa.status === 'open') {
      state = 'active'
      if (status?.restrictions?.length > 0) {
        state = 'temporarily_restricted'
      }
    } else if (fa.status === 'closed') {
      state = 'temporarily_restricted'
    }
  } else if (status?.fund_summary) {
    state = 'onboarding_in_progress'
  }

  const config = stateConfig[state]

  // Don't show banner for fully active accounts
  if (state === 'active') {
    return null
  }

  const restrictions = status?.restrictions as string[] | undefined

  return (
    <div className={`rounded-xl border p-4 ${variantStyles[config.variant]}`}>
      <div className="flex items-start gap-3">
        <div className={variantTextStyles[config.variant]}>{config.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${variantTextStyles[config.variant]}`}
            >
              {config.label}
            </span>
          </div>
          <p
            className={`mt-0.5 text-sm ${variantDescStyles[config.variant]}`}
          >
            {config.description}
          </p>
          {restrictions && restrictions.length > 0 && (
            <ul className={`mt-2 list-inside list-disc text-sm ${variantDescStyles[config.variant]}`}>
              {restrictions.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        {config.showCta && (
          <Link
            href={`/dashboard/${params.organization}/finance/embedded/account`}
          >
            <Button size="sm" variant="outline">
              {config.ctaLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
