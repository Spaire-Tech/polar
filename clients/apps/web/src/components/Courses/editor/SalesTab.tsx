'use client'

import { CourseRead } from '@/hooks/queries/courses'
import { useMetrics } from '@/hooks/queries/metrics'
import { useOrders } from '@/hooks/queries/orders'
import { getChartRangeParams, getFormattedMetricValue } from '@/utils/metrics'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { cn } from '@spaire/ui/lib/utils'
import { useMemo, useState } from 'react'
import { toast } from '../../Toast/use-toast'

// Single source of truth for the editor's sales surface. Mirrors the
// CustomersTab table pattern + the `--*-ce-*` tokens so it inherits the course
// editor look automatically — NOT the dashboard sales design.

// Top summary cards. Labels + value formatting come from the metrics API so
// they stay in lock-step with the backend.
const SUMMARY_SLUGS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'average_order_value',
]

const STATUS_STYLES: Record<schemas['OrderStatus'], string> = {
  paid: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  refunded: 'bg-gray-100 text-gray-600',
  partially_refunded: 'bg-gray-100 text-gray-600',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCsv(orders: schemas['Order'][]): void {
  const header = ['Customer', 'Email', 'Amount', 'Currency', 'Status', 'Date']
  const lines = [header.join(',')]
  for (const o of orders) {
    lines.push(
      [
        o.customer?.name ?? '',
        o.customer?.email ?? '',
        (o.net_amount / 100).toFixed(2),
        o.currency.toUpperCase(),
        o.status,
        o.created_at,
      ]
        .map((v) => csvEscape(String(v)))
        .join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function SalesTab({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: CourseRead
}) {
  const [query, setQuery] = useState('')

  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams('all_time', course.created_at),
    [course.created_at],
  )

  const { data: metrics } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    product_id: [course.product_id],
  })

  const { data: ordersPage, isLoading } = useOrders(organization.id, {
    product_id: [course.product_id],
    sorting: ['-created_at'],
    limit: 100,
  })
  const orders = useMemo(() => ordersPage?.items ?? [], [ordersPage])

  const visibleOrders = query.trim()
    ? orders.filter((o) => {
        const q = query.toLowerCase()
        return (
          o.customer?.email?.toLowerCase().includes(q) ||
          o.customer?.name?.toLowerCase().includes(q)
        )
      })
    : orders

  const handleDownloadCsv = () => {
    if (orders.length === 0) {
      toast({ title: 'No sales to export yet' })
      return
    }
    downloadCsv(orders)
    toast({ title: 'CSV downloaded' })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Sales</h1>
          <p className="mt-1 text-gray-500">
            Every order placed for this course.
          </p>
        </div>
        <button
          onClick={handleDownloadCsv}
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          Download CSV
          <FileDownloadOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        {SUMMARY_SLUGS.map((slug) => {
          const metric = metrics?.metrics?.[slug]
          const total = metrics?.totals?.[slug]
          return (
            <div
              key={slug}
              className="rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="text-[13px] tracking-tight text-gray-500">
                {metric?.display_name ?? '—'}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                {!metric || total == null
                  ? '—'
                  : getFormattedMetricValue(metric, total as number)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Orders table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="relative border-b border-gray-100 px-4 py-3">
          <SearchOutlined
            className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-gray-400"
            fontSize="small"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sales"
            className="focus:border-ce-accent focus:ring-ce-accent-ring w-full rounded-lg border border-transparent bg-transparent py-1.5 pr-3 pl-8 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-4 px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
          <span>Customer</span>
          <span>Amount</span>
          <span>Status</span>
          <span className="text-right">Date</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Loading sales…
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            {query.trim() ? 'No sales match your search.' : 'No sales yet.'}
          </div>
        ) : (
          visibleOrders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[2.5fr_1fr_1fr_1fr] items-center gap-4 border-t border-gray-100 px-6 py-4 text-sm text-gray-900"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={order.customer?.name || order.customer?.email || '—'}
                  avatar_url={order.customer?.avatar_url ?? null}
                  className="h-10 w-10 text-sm"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-gray-900">
                    {order.customer?.name ||
                      order.customer?.email ||
                      'Customer'}
                  </span>
                  <span className="truncate text-xs text-gray-500">
                    {order.customer?.email ?? '—'}
                  </span>
                </div>
              </div>
              <span className="font-medium text-gray-900">
                {formatCurrency('compact')(order.net_amount, order.currency)}
              </span>
              <span>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    STATUS_STYLES[order.status],
                  )}
                >
                  {order.status.replace('_', ' ')}
                </span>
              </span>
              <span className="text-right text-gray-700">
                {formatDate(order.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
