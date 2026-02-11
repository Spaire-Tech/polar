'use client'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useQuery } from '@tanstack/react-query'
import { CircleAlertIcon } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface FinanceStatusBannerProps {
  organizationId: string
}

const statusLabels: Record<string, string> = {
  onboarding_required: 'Setup required',
  onboarding_in_progress: 'Setup in progress',
  issuing_active: 'Active',
  temporarily_restricted: 'Temporarily restricted',
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

  // Derive state
  const hasRestrictions = status?.restrictions?.length > 0
  const isActive = fa?.status === 'open' && !hasRestrictions

  // Don't show banner if everything is fine
  if (isActive) {
    return null
  }

  // Not set up at all
  if (!fa) {
    return (
      <Banner
        color="default"
        right={
          <Link
            href={`/dashboard/${params.organization}/finance/account`}
          >
            <Button size="sm">Complete Setup</Button>
          </Link>
        }
      >
        <CircleAlertIcon className="h-5 w-5 text-blue-500" />
        <span>
          {statusLabels.onboarding_required} — complete your account setup to access banking, cards, and payments.
        </span>
      </Banner>
    )
  }

  // Restricted
  if (hasRestrictions) {
    return (
      <Banner
        color="red"
        right={
          <Link
            href={`/dashboard/${params.organization}/finance/account`}
          >
            <Button size="sm">View Details</Button>
          </Link>
        }
      >
        <CircleAlertIcon className="h-5 w-5" />
        <span>
          {statusLabels.temporarily_restricted} — action may be required to restore full access.
        </span>
      </Banner>
    )
  }

  // In progress (has fund data but account not open)
  return (
    <Banner color="blue">
      <CircleAlertIcon className="h-5 w-5" />
      <span>
        {statusLabels.onboarding_in_progress} — your account is being reviewed.
      </span>
    </Banner>
  )
}
