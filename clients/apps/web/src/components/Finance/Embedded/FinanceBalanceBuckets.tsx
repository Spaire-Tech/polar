'use client'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'

interface FinanceBalanceBucketsProps {
  organizationId: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

const bucketConfig = [
  {
    key: 'pending',
    label: 'Clearing',
    description: 'Funds being processed',
    colorDot: 'bg-amber-400',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'available',
    label: 'Available',
    description: 'Ready to use or transfer',
    colorDot: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'reserve',
    label: 'Funds on Hold',
    description: 'Reserve held for risk coverage',
    colorDot: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    key: 'spendable',
    label: 'Spendable',
    description: 'Available for cards & payments',
    colorDot: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
] as const

export default function FinanceBalanceBuckets({
  organizationId,
}: FinanceBalanceBucketsProps) {
  const { data: fundData, isLoading: fundLoading } = useQuery({
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

  const { data: financialAccount, isLoading: faLoading } = useQuery({
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

  const isLoading = fundLoading || faLoading

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="animate-pulse space-y-2">
              <div className="dark:bg-polar-700 h-3 w-16 rounded bg-gray-200" />
              <div className="dark:bg-polar-700 h-6 w-24 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const fund = fundData as any
  const fa = financialAccount as any

  const amounts: Record<string, number> = {
    pending: fund?.fund_summary?.pending_amount ?? 0,
    available: fa?.balance?.cash ?? 0,
    reserve: fund?.fund_summary?.reserve_amount ?? 0,
    spendable: fund?.fund_summary?.spendable_amount ?? 0,
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {bucketConfig.map((bucket) => (
        <div
          key={bucket.key}
          className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${bucket.colorDot}`} />
            <span className="dark:text-polar-400 text-xs font-medium text-gray-500">
              {bucket.label}
            </span>
          </div>
          <p className={`mt-1.5 text-xl font-semibold ${bucket.textColor}`}>
            {formatCents(amounts[bucket.key])}
          </p>
          <p className="dark:text-polar-500 mt-0.5 text-[11px] text-gray-400">
            {bucket.description}
          </p>
        </div>
      ))}
    </div>
  )
}
