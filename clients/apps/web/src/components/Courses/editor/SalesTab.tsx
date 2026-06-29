'use client'

// SalesTab — course-scoped sales ledger, styled in the course-editor design
// language (matches CustomersTab: white rounded-2xl table, `ce-accent`
// token). Real orders for the course's linked product via the shared
// /v1/orders endpoint, plus a metrics-backed revenue header.

import { CourseRead } from '@/hooks/queries/courses'
import { useMetrics } from '@/hooks/queries/metrics'
import { useOrders } from '@/hooks/queries/orders'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { useMemo } from 'react'
import { toast } from '../../Toast/use-toast'

const STATUS_TONE: Record<string, string> = {
  paid: 'bg-green-50 text-green-700',
  pending: 'bg-gray-100 text-gray-600',
  refunded: 'bg-amber-50 text-amber-700',
  partially_refunded: 'bg-amber-50 text-amber-700',
}

function formatDate(value: string): string {
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
  const header = [
    'Order ID',
    'Customer',
    'Email',
    'Amount',
    'Currency',
    'Status',
    'Date',
  ]
  const lines = [header.join(',')]
  for (const o of orders) {
    lines.push(
      [
        o.id,
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
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
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
  // Last-12-months totals for the header. The table below lists the most
  // recent orders regardless of date.
  const range = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 365)
    return { startDate: start, endDate: end }
  }, [])

  const { data: metrics } = useMetrics({
    startDate: range.startDate,
    endDate: range.endDate,
    interval: 'month',
    organization_id: organization.id,
    product_id: [course.product_id],
  })

  const { data: ordersPage, isLoading } = useOrders(organization.id, {
    product_id: course.product_id,
    limit: 100,
  })

  const orders = useMemo(
    () =>
      [...(ordersPage?.items ?? [])].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [ordersPage],
  )

  const handleDownloadCsv = () => {
    if (orders.length === 0) {
      toast({ title: 'No sales to export yet' })
      return
    }
    downloadCsv(orders)
    toast({ title: 'CSV downloaded' })
  }

  const revenue = metrics?.totals.revenue ?? 0
  const orderCount = metrics?.totals.orders ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Sales</h1>
          <p className="mt-1 text-gray-500">
            Orders for this course over the last 12 months.
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Revenue (12 months)
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency('statistics')(revenue, 'usd')}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Orders (12 months)
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {orderCount.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1.2fr] gap-4 px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
          <span>Customer</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Loading sales…
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            No sales yet.
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[2.5fr_1fr_1fr_1.2fr] items-center gap-4 border-t border-gray-100 px-6 py-4 text-sm text-gray-900"
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
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    STATUS_TONE[order.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {order.status.replace(/_/g, ' ')}
                </span>
              </span>
              <span className="text-gray-700">
                {formatDate(order.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
