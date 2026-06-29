'use client'

import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import { CourseRead } from '@/hooks/queries/courses'
import { useMetrics } from '@/hooks/queries/metrics'
import { useOrders } from '@/hooks/queries/orders'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
} from '@/utils/datatable'
import { getChartRangeParams } from '@/utils/metrics'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@spaire/ui/components/atoms/DataTable'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import { useMemo, useState } from 'react'
import { SalesOrderDetail } from './SalesOrderDetail'

// The course editor's sales surface reuses the SAME orders DataTable +
// MiniMetricChartBox + OrderStatus as the dashboard, scoped to this course's
// underlying product. Clicking a row opens the order detail inline (no route
// change, since we live inside the editor shell).

export function SalesTab({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: CourseRead
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<DataTableSortingState>([
    { id: 'created_at', desc: true },
  ])

  const productId = useMemo(() => [course.product_id], [course.product_id])

  const ordersHook = useOrders(organization.id, {
    ...getAPIParams(pagination, sorting),
    product_id: productId,
  })
  const orders = ordersHook.data?.items ?? []
  const rowCount = ordersHook.data?.pagination.total_count ?? 0
  const pageCount = ordersHook.data?.pagination.max_page ?? 1

  const [allTimeStart, allTimeEnd, allTimeInterval] = useMemo(
    () => getChartRangeParams('all_time', course.created_at),
    [course.created_at],
  )
  const { data: metricsData } = useMetrics({
    organization_id: organization.id,
    startDate: allTimeStart,
    endDate: allTimeEnd,
    interval: allTimeInterval,
    product_id: productId,
    metrics: ['orders', 'revenue', 'cumulative_revenue'],
  })
  const { data: todayMetricsData } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    product_id: productId,
    metrics: ['revenue'],
  })

  const columns: DataTableColumnDef<schemas['Order']>[] = [
    {
      accessorKey: 'customer',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: (props) => {
        const customer = props.getValue() as schemas['OrderCustomer']
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              className="h-8 w-8"
              avatar_url={customer.avatar_url}
              name={customer.name || customer.email}
            />
            <div className="fw-medium overflow-hidden text-ellipsis">
              {customer.email}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'net_amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: order } }) => (
        <span>
          {formatCurrency('compact')(order.net_amount, order.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: order } }) => (
        <span className="flex shrink">
          <OrderStatus status={order.status} />
        </span>
      ),
    },
    {
      accessorKey: 'invoice_number',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice number" />
      ),
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
  ]

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/v1/orders/export?organization_id=${organization.id}&product_id=${course.product_id}`,
    )
    window.open(url, '_blank')
  }

  if (selectedOrderId) {
    return (
      <SalesOrderDetail
        organization={organization}
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
      />
    )
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
          onClick={onExport}
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          Export
          <FileDownloadOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MiniMetricChartBox
          title="Transactions"
          value={metricsData?.totals.orders}
          metric={metricsData?.metrics.orders}
        />
        <MiniMetricChartBox
          title="Today's Revenue"
          value={todayMetricsData?.totals.revenue}
          metric={todayMetricsData?.metrics.revenue}
        />
        <MiniMetricChartBox
          title="Cumulative Revenue"
          value={metricsData?.totals.revenue}
          metric={metricsData?.metrics.cumulative_revenue}
        />
      </div>

      <DataTable
        columns={columns}
        data={orders}
        rowCount={rowCount}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={ordersHook.isLoading}
        onRowClick={(row) => setSelectedOrderId(row.original.id)}
        getRowId={(row) => row.id.toString()}
      />
    </div>
  )
}
