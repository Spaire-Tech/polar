'use client'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { useQuery } from '@tanstack/react-query'
import React from 'react'

interface FundStateBreakdownProps {
  organizationId: string
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function ProgressBar({
  segments,
}: {
  segments: { label: string; amount: number; color: string }[]
}) {
  const total = segments.reduce((acc, s) => acc + s.amount, 0)
  if (total === 0) return null

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full">
      {segments.map((segment) => {
        const width = (segment.amount / total) * 100
        if (width === 0) return null
        return (
          <div
            key={segment.label}
            className={segment.color}
            style={{ width: `${width}%` }}
            title={`${segment.label}: ${formatCents(segment.amount)}`}
          />
        )
      })}
    </div>
  )
}

export default function FundStateBreakdown({
  organizationId,
}: FundStateBreakdownProps) {
  const { data, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <ShadowBoxOnMd>
        <div className="animate-pulse space-y-4 p-6">
          <div className="dark:bg-polar-700 h-4 w-1/3 rounded bg-gray-200" />
          <div className="dark:bg-polar-700 h-3 w-full rounded bg-gray-200" />
          <div className="dark:bg-polar-700 h-4 w-2/3 rounded bg-gray-200" />
        </div>
      </ShadowBoxOnMd>
    )
  }

  const status = data as any
  if (!status?.fund_summary) {
    return (
      <ShadowBoxOnMd>
        <div className="p-6">
          <h3 className="dark:text-white text-lg font-semibold text-gray-900">
            Fund States
          </h3>
          <p className="dark:text-polar-400 mt-2 text-sm text-gray-500">
            No fund data available. Fund lifecycle tracking begins when your
            Custom account receives its first payment.
          </p>
        </div>
      </ShadowBoxOnMd>
    )
  }

  const { fund_summary: summary } = status
  const segments = [
    {
      label: 'Pending',
      amount: summary.pending_amount,
      color: 'bg-amber-400',
    },
    {
      label: 'Reserve',
      amount: summary.reserve_amount,
      color: 'bg-orange-500',
    },
    {
      label: 'Spendable',
      amount: summary.spendable_amount,
      color: 'bg-emerald-500',
    },
  ]

  return (
    <ShadowBoxOnMd>
      <div className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h3 className="dark:text-white text-lg font-semibold text-gray-900">
            Fund States
          </h3>
          <span className="dark:text-polar-300 text-sm font-medium text-gray-700">
            {formatCents(summary.total_amount)} total
          </span>
        </div>

        <ProgressBar segments={segments} />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="dark:text-polar-400 text-xs text-gray-500">
              Pending
            </p>
            <p className="dark:text-white text-lg font-semibold text-gray-900">
              {formatCents(summary.pending_amount)}
            </p>
          </div>
          <div>
            <p className="dark:text-polar-400 text-xs text-gray-500">
              Reserve
            </p>
            <p className="dark:text-white text-lg font-semibold text-gray-900">
              {formatCents(summary.reserve_amount)}
            </p>
          </div>
          <div>
            <p className="dark:text-polar-400 text-xs text-gray-500">
              Spendable
            </p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCents(summary.spendable_amount)}
            </p>
          </div>
        </div>

        {status.pending_explanation && (
          <p className="dark:text-polar-400 text-sm text-gray-500">
            {status.pending_explanation}
          </p>
        )}
        {status.reserve_explanation && (
          <p className="dark:text-polar-400 text-sm text-gray-500">
            {status.reserve_explanation}
          </p>
        )}

        {status.restrictions?.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Restrictions active:
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-red-700 dark:text-red-400">
              {status.restrictions.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {status.last_recalculated_at && (
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Last updated:{' '}
            {new Date(status.last_recalculated_at).toLocaleString()}
          </p>
        )}
      </div>
    </ShadowBoxOnMd>
  )
}
