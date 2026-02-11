'use client'

import Pill from '@polar-sh/ui/components/atoms/Pill'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'

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

const typeLabels: Record<ActivityItem['type'], string> = {
  card_spend: 'Card',
  ach_out: 'ACH',
  wire_out: 'Wire',
  inbound: 'Received',
  transfer: 'Transfer',
}

const statusPillColor: Record<
  ActivityItem['status'],
  'green' | 'yellow' | 'red'
> = {
  completed: 'green',
  pending: 'yellow',
  failed: 'red',
}

interface FinanceActivityTableProps {
  organizationId: string
}

export default function FinanceActivityTable({
  organizationId: _organizationId,
}: FinanceActivityTableProps) {
  // Placeholder: in production, this would fetch from the API
  const activities: ActivityItem[] = []

  return (
    <ShadowBoxOnMd>
      <div className="flex flex-col gap-y-4">
        <h2 className="text-lg font-medium">Recent Activity</h2>
        {activities.length === 0 ? (
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Transactions will appear here once you start using your account.
          </p>
        ) : (
          <div className="flex flex-col">
            {activities.map((item) => (
              <div
                key={item.id}
                className="dark:border-polar-700 flex items-center justify-between border-b border-gray-100 py-3 last:border-0"
              >
                <div className="flex flex-col gap-y-0.5">
                  <span className="text-sm font-medium">
                    {item.description}
                  </span>
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    {typeLabels[item.type]} &middot;{' '}
                    {new Date(item.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Pill color={statusPillColor[item.status]}>
                    {item.status}
                  </Pill>
                  <span className="text-sm font-medium">
                    {item.amount < 0 ? '-' : '+'}
                    {formatCents(Math.abs(item.amount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ShadowBoxOnMd>
  )
}
