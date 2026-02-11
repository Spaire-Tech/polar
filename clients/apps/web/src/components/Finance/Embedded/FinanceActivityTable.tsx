'use client'

import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  Loader2,
} from 'lucide-react'

// Placeholder activity types until real API integration
interface ActivityItem {
  id: string
  type: 'card_spend' | 'ach_out' | 'wire_out' | 'inbound' | 'transfer'
  description: string
  amount: number
  date: string
  status: 'completed' | 'pending' | 'failed'
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const typeConfig: Record<
  ActivityItem['type'],
  { icon: React.ReactNode; label: string }
> = {
  card_spend: {
    icon: <CreditCard className="h-4 w-4 text-blue-500" />,
    label: 'Card',
  },
  ach_out: {
    icon: <ArrowUpRight className="h-4 w-4 text-red-500" />,
    label: 'ACH',
  },
  wire_out: {
    icon: <Landmark className="h-4 w-4 text-purple-500" />,
    label: 'Wire',
  },
  inbound: {
    icon: <ArrowDownLeft className="h-4 w-4 text-emerald-500" />,
    label: 'Received',
  },
  transfer: {
    icon: <ArrowUpRight className="h-4 w-4 text-amber-500" />,
    label: 'Transfer',
  },
}

const statusStyles: Record<ActivityItem['status'], string> = {
  completed: 'text-emerald-600 dark:text-emerald-400',
  pending: 'text-amber-600 dark:text-amber-400',
  failed: 'text-red-600 dark:text-red-400',
}

const statusLabels: Record<ActivityItem['status'], string> = {
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
}

interface FinanceActivityTableProps {
  organizationId: string
}

export default function FinanceActivityTable({
  organizationId: _organizationId,
}: FinanceActivityTableProps) {
  // Placeholder: in production, this would fetch from the API
  const isLoading = false
  const activities: ActivityItem[] = []

  if (isLoading) {
    return (
      <ShadowBoxOnMd>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="dark:text-polar-400 h-6 w-6 animate-spin text-gray-400" />
        </div>
      </ShadowBoxOnMd>
    )
  }

  if (activities.length === 0) {
    return (
      <ShadowBoxOnMd>
        <div className="p-6">
          <h3 className="dark:text-white text-sm font-semibold text-gray-900">
            Recent Activity
          </h3>
          <div className="dark:border-polar-700 mt-4 flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200">
            <div className="text-center">
              <p className="dark:text-polar-400 text-sm text-gray-500">
                No recent activity
              </p>
              <p className="dark:text-polar-500 mt-1 text-xs text-gray-400">
                Transactions will appear here once you start using your account.
              </p>
            </div>
          </div>
        </div>
      </ShadowBoxOnMd>
    )
  }

  return (
    <ShadowBoxOnMd>
      <div className="p-6">
        <h3 className="dark:text-white mb-4 text-sm font-semibold text-gray-900">
          Recent Activity
        </h3>
        <div className="space-y-0 divide-y divide-gray-100 dark:divide-polar-700">
          {activities.map((item) => {
            const config = typeConfig[item.type]
            const isOutbound = item.amount < 0
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="dark:text-white truncate text-sm font-medium text-gray-900">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="dark:text-polar-500 text-xs text-gray-400">
                      {config.label}
                    </span>
                    <span className="dark:text-polar-600 text-gray-300">
                      &middot;
                    </span>
                    <span className="dark:text-polar-500 text-xs text-gray-400">
                      {formatDate(item.date)}
                    </span>
                    <span className="dark:text-polar-600 text-gray-300">
                      &middot;
                    </span>
                    <span
                      className={`text-xs font-medium ${statusStyles[item.status]}`}
                    >
                      {statusLabels[item.status]}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${isOutbound ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                >
                  {isOutbound ? '-' : '+'}
                  {formatCents(Math.abs(item.amount))}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </ShadowBoxOnMd>
  )
}
