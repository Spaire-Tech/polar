'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  ManualInvoice,
  useManualInvoices,
} from '@/hooks/queries/manualInvoices'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { RowSelectionState } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
  issued: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  paid: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
  void: 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400',
}

const InvoiceStatusBadge = ({ status }: { status: string }) => (
  <Status
    status={status.charAt(0).toUpperCase() + status.slice(1)}
    className={statusColors[status] || 'text-xs'}
  />
)

interface InvoicesPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  status?: string
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({
  organization,
  pagination,
  sorting,
  status,
}) => {
  const [selectedRowState, setSelectedRowState] = useState<RowSelectionState>({})
  const router = useRouter()

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    status?: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (status) params.set('status', status)
    return params
  }

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue
    router.push(
      `/dashboard/${organization.slug}/invoices?${getSearchParams(
        updatedPagination,
        sorting,
        status,
      )}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue
    router.push(
      `/dashboard/${organization.slug}/invoices?${getSearchParams(
        pagination,
        updatedSorting,
        status,
      )}`,
    )
  }

  const onStatusFilter = (value: string) => {
    const newStatus = value === 'all' ? undefined : value
    router.push(
      `/dashboard/${organization.slug}/invoices?${getSearchParams(
        { ...pagination, pageIndex: 0 },
        sorting,
        newStatus,
      )}`,
    )
  }

  const apiParams = getAPIParams(pagination, sorting)
  const invoicesHook = useManualInvoices(organization.id, {
    page: apiParams.page,
    limit: apiParams.limit,
    sorting: apiParams.sorting,
    status,
  })

  const invoices = invoicesHook.data?.items || []
  const rowCount = invoicesHook.data?.pagination.total_count ?? 0
  const pageCount = invoicesHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<ManualInvoice>[] = [
    {
      accessorKey: 'invoice_number',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice #" />
      ),
      cell: ({ row: { original } }) => (
        <span className="font-mono text-sm">
          {original.invoice_number || 'Draft'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original } }) => (
        <InvoiceStatusBadge status={original.status} />
      ),
    },
    {
      accessorKey: 'billing_name',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original } }) => (
        <span>{original.billing_name || '—'}</span>
      ),
    },
    {
      accessorKey: 'total_amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original } }) => (
        <span>
          {formatCurrency('compact')(original.total_amount, original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'due_date',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row: { original } }) =>
        original.due_date ? (
          <FormattedDateTime datetime={original.due_date} />
        ) : (
          <span className="dark:text-polar-500 text-gray-400">—</span>
        ),
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
  ]

  const selectedInvoice = invoices.find(
    (invoice) => selectedRowState[invoice.id],
  )

  useEffect(() => {
    if (selectedInvoice) {
      router.push(
        `/dashboard/${organization.slug}/invoices/${selectedInvoice.id}`,
      )
    }
  }, [selectedInvoice, router, organization])

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <Select value={status || 'all'} onValueChange={onStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href={`/dashboard/${organization.slug}/invoices/new`}>
            <Button wrapperClassNames="gap-x-2">
              <AddOutlined fontSize="inherit" />
              <span>New Invoice</span>
            </Button>
          </Link>
        </div>

        {invoices && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={invoices}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={invoicesHook.isLoading}
            onRowSelectionChange={(row) => setSelectedRowState(row)}
            rowSelection={selectedRowState}
            getRowId={(row) => row.id}
            enableRowSelection
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default InvoicesPage
