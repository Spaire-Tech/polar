'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import {
  ClientInvoice,
  useClientInvoices,
} from '@/hooks/queries/client_invoices'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@spaire/ui/components/atoms/DataTable'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import ShadowBoxOnMd from '@spaire/ui/components/atoms/ShadowBoxOnMd'
import { formatCurrency } from '@spaire/currency'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import InvoicePage from './[id]/InvoicePage'

const statusColors: Record<string, string> = {
  draft:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  void: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  uncollectible:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[status] ?? ''}`}
  >
    {status}
  </span>
)

interface InvoicesPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({
  organization,
  pagination,
  sorting,
}) => {
  const router = useRouter()
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  const invoicesHook = useClientInvoices(
    organization.id,
    getAPIParams(pagination, sorting),
  )

  const invoices = invoicesHook.data?.items ?? []
  const rowCount = invoicesHook.data?.pagination.total_count ?? 0
  const pageCount = invoicesHook.data?.pagination.max_page ?? 1

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updated =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue
    router.push(
      `/dashboard/${organization.slug}/invoices?${serializeSearchParams(updated, sorting)}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updated =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue
    router.push(
      `/dashboard/${organization.slug}/invoices?${serializeSearchParams(pagination, updated)}`,
    )
  }

  const columns: DataTableColumnDef<ClientInvoice>[] = [
    {
      accessorKey: 'customer_id',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: invoice } }) => (
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {invoice.customer_id}
        </span>
      ),
    },
    {
      accessorKey: 'total_amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: invoice } }) => (
        <span className="font-medium">
          {formatCurrency('compact')(invoice.total_amount, invoice.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: invoice } }) => (
        <StatusBadge status={invoice.status} />
      ),
    },
    {
      accessorKey: 'due_date',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row: { original: invoice } }) =>
        invoice.due_date ? (
          <FormattedDateTime datetime={invoice.due_date} />
        ) : (
          <span className="text-gray-400 dark:text-gray-500">—</span>
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

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        {!invoicesHook.isLoading && invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-8 pt-4 pb-12 text-center">
            <div style={{ isolation: 'isolate' }} className="relative h-[88px] w-[88px]">
              <div style={{ mixBlendMode: 'multiply' }} className="absolute top-2 left-0 h-11 w-16 rounded-2xl bg-amber-300" />
              <div style={{ mixBlendMode: 'multiply' }} className="absolute bottom-0 right-0 h-14 w-14 rounded-full bg-emerald-300" />
            </div>
            <div className="flex max-w-lg flex-col gap-3">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create and send invoices in minutes
              </h2>
              <p className="text-gray-500 dark:text-spaire-400">
                Send invoices with a link to pay online. Accept cards, bank
                transfers, and more.
              </p>
            </div>
            <Link href={`/dashboard/${organization.slug}/sales/invoices/new`}>
              <Button size="lg" className="gap-2">
                Create Invoice
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-row items-center justify-between">
              <h1 className="text-xl font-medium dark:text-white">Invoices</h1>
              <Link href={`/dashboard/${organization.slug}/sales/invoices/new`}>
                <Button>
                  <AddOutlined fontSize="small" />
                  New Invoice
                </Button>
              </Link>
            </div>
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
              onRowClick={(row) => setSelectedInvoiceId(row.original.id)}
            />
          </>
        )}
      </div>
      <InlineModal
        isShown={!!selectedInvoiceId}
        hide={() => setSelectedInvoiceId(null)}
        className="md:w-[720px]"
        modalContent={
          selectedInvoiceId ? (
            <InvoicePage
              organization={organization}
              invoiceId={selectedInvoiceId}
              panelMode
              onClose={() => setSelectedInvoiceId(null)}
            />
          ) : (
            <div />
          )
        }
      />
    </DashboardBody>
  )
}

export default InvoicesPage
