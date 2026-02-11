'use client'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { Well, WellContent, WellFooter, WellHeader } from '@/components/Shared/Well'
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
  const fund = fundData as any
  const fa = financialAccount as any

  const buckets = [
    {
      label: 'Clearing',
      amount: fund?.fund_summary?.pending_amount ?? 0,
      footnote: 'Funds being processed',
    },
    {
      label: 'Available',
      amount: fa?.balance?.cash ?? 0,
      footnote: 'Ready to use or transfer',
    },
    {
      label: 'Funds on Hold',
      amount: fund?.fund_summary?.reserve_amount ?? 0,
      footnote: 'Reserve held for risk coverage',
    },
    {
      label: 'Spendable',
      amount: fund?.fund_summary?.spendable_amount ?? 0,
      footnote: 'Available for cards & payments',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {buckets.map((bucket) => (
        <Well
          key={bucket.label}
          className="flex-1 justify-between rounded-2xl bg-gray-50 p-6"
        >
          <WellHeader>
            <h2 className="text-sm font-medium">{bucket.label}</h2>
          </WellHeader>
          <WellContent>
            <div className="text-2xl">
              {isLoading ? (
                <span className="dark:text-polar-600 text-gray-300">—</span>
              ) : (
                formatCents(bucket.amount)
              )}
            </div>
          </WellContent>
          <WellFooter>
            <p className="dark:text-polar-500 text-xs text-gray-500">
              {bucket.footnote}
            </p>
          </WellFooter>
        </Well>
      ))}
    </div>
  )
}
