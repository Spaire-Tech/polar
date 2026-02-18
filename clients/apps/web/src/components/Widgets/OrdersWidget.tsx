import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  refunded: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  partially_refunded: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
}

const formatOrderDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatOrderTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

interface OrderRowProps {
  order: schemas['Order']
  orgSlug: string
}

const OrderRow = ({ order, orgSlug }: OrderRowProps) => {
  const statusLabel = order.status.split('_').join(' ')
  const statusClass = STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-500'

  return (
    <Link
      href={`/dashboard/${orgSlug}/sales/${order.id}`}
      className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-polar-800/50"
    >
      {/* Description + date */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {order.description}
        </p>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-white/30">
          {formatOrderDate(order.created_at)} · {formatOrderTime(order.created_at)}
        </p>
      </div>

      {/* Status badge */}
      <span
        className={twMerge(
          'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize',
          statusClass,
        )}
      >
        {statusLabel}
      </span>

      {/* Amount */}
      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
        {formatCurrency('compact')(order.net_amount, order.currency)}
      </span>
    </Link>
  )
}

export interface OrdersWidgetProps {
  className?: string
}

export const OrdersWidget = ({ className }: OrdersWidgetProps) => {
  const { organization: org } = useContext(OrganizationContext)
  const orders = useOrders(org.id, { limit: 10, sorting: ['-created_at'] })

  const items = orders.data?.items ?? []

  return (
    <div
      className={twMerge(
        'dark:border-polar-800 overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-polar-900 shadow-sm',
        className,
      )}
    >
      {/* Header */}
      <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          Recent Transactions
        </span>
        <Link
          href={`/dashboard/${org.slug}/sales`}
          className="dark:text-polar-400 flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-white"
        >
          View all
          <ArrowForwardOutlined sx={{ fontSize: 13 }} />
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="dark:divide-polar-800 divide-y divide-gray-100">
          {items.map((order) => (
            <OrderRow key={order.id} order={order} orgSlug={org.slug} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <div className="dark:bg-polar-800 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <ShoppingCartOutlined
              className="text-gray-400 dark:text-white/30"
              fontSize="small"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No transactions yet
            </p>
            <p className="text-xs text-gray-400 dark:text-white/30">
              Transactions will appear here as customers complete checkouts
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
