'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DownloadInvoiceDashboard } from '@/components/Orders/DownloadInvoice'
import { DetailRow } from '@/components/Shared/DetailRow'
import { toast } from '@/components/Toast/use-toast'
import {
  useClientInvoice,
  useSendClientInvoice,
  useVoidClientInvoice,
} from '@/hooks/queries/client_invoices'
import { useCustomer } from '@/hooks/queries/customers'
import { api } from '@/utils/client'
import Send from '@mui/icons-material/Send'
import { schemas, unwrap } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Button from '@spaire/ui/components/atoms/Button'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import { Status } from '@spaire/ui/components/atoms/Status'
import { Separator } from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface InvoicePageProps {
  organization: schemas['Organization']
  invoiceId: string
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  open: 'bg-blue-100 text-blue-500 dark:bg-blue-950',
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  void: 'bg-gray-100 text-gray-500 dark:bg-gray-800',
  uncollectible: 'bg-red-100 text-red-500 dark:bg-red-950',
}

const InvoicePage: React.FC<InvoicePageProps> = ({
  organization,
  invoiceId,
}) => {
  const [confirmVoid, setConfirmVoid] = useState(false)

  const { data: invoice, isLoading, refetch } = useClientInvoice(invoiceId)
  const { data: customer } = useCustomer(
    invoice ? invoice.customer_id.toString() : null,
  )
  const { data: linkedOrder } = useQuery({
    queryKey: ['orders', { id: invoice?.order_id }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/orders/{id}', {
          params: { path: { id: invoice!.order_id! } },
        }),
      ),
    enabled: !!invoice?.order_id,
  })

  const sendInvoice = useSendClientInvoice(invoiceId)
  const voidInvoice = useVoidClientInvoice(invoiceId)

  if (isLoading || !invoice) {
    return (
      <DashboardBody title="Invoice" wrapperClassName="max-w-(--breakpoint-lg)!">
        <div className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </DashboardBody>
    )
  }

  const handleSend = async () => {
    try {
      await sendInvoice.mutateAsync()
      toast({ title: 'Invoice sent successfully' })
    } catch (err: any) {
      toast({
        title: 'Failed to send invoice',
        description: err?.detail ?? String(err),
      })
    }
  }

  const handleVoid = async () => {
    if (!confirmVoid) {
      setConfirmVoid(true)
      return
    }
    try {
      await voidInvoice.mutateAsync()
      toast({ title: 'Invoice voided' })
      setConfirmVoid(false)
    } catch (err: any) {
      toast({
        title: 'Failed to void invoice',
        description: err?.detail ?? String(err),
      })
      setConfirmVoid(false)
    }
  }

  const isDraft = invoice.status === 'draft'
  const isOpen = invoice.status === 'open'
  const isPaid = invoice.status === 'paid'
  const isVoidable = isDraft || isOpen

  const fmt = (cents: number) =>
    formatCurrency('accounting')(cents, invoice.currency)

  return (
    <DashboardBody
      title={
        <div className="flex flex-row items-center gap-4">
          <h2 className="text-xl font-normal">Invoice</h2>
          <Status
            status={invoice.status}
            className={twMerge(STATUS_COLOR[invoice.status], 'capitalize')}
          />
        </div>
      }
      header={
        <>
          {isDraft && (
            <Button loading={sendInvoice.isPending} onClick={handleSend}>
              <Send fontSize="small" />
              Send Invoice
            </Button>
          )}
          {isPaid && linkedOrder && (
            <DownloadInvoiceDashboard
              order={linkedOrder}
              organization={organization}
              onInvoiceGenerated={refetch}
            />
          )}
          {isVoidable && (
            <Button
              variant="secondary"
              loading={voidInvoice.isPending}
              onClick={handleVoid}
              className={
                confirmVoid
                  ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30'
                  : ''
              }
            >
              {confirmVoid ? 'Confirm void?' : 'Void invoice'}
            </Button>
          )}
        </>
      }
      className="gap-y-12"
      contextView={
        customer ? (
          <CustomerContextView
            organization={organization}
            customer={customer as schemas['Customer']}
          />
        ) : undefined
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:block hidden md:shadow-none"
    >
      <ShadowBox className="dark:divide-spaire-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0 md:rounded-3xl!">
        <div className="flex flex-col gap-6 p-4 md:p-8">
          <div className="flex flex-col gap-1">
            <DetailRow
              label="Invoice ID"
              value={invoice.id.slice(0, 8).toUpperCase()}
              valueClassName="font-mono text-sm"
            />
            <DetailRow
              label="Invoice date"
              value={
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="time"
                  datetime={invoice.created_at}
                />
              }
            />
            {invoice.due_date && (
              <DetailRow
                label="Due date"
                value={
                  <FormattedDateTime
                    dateStyle="medium"
                    datetime={invoice.due_date}
                  />
                }
              />
            )}
            <DetailRow
              label="Status"
              value={
                <Status
                  status={invoice.status}
                  className={twMerge(
                    STATUS_COLOR[invoice.status],
                    'w-fit capitalize',
                  )}
                />
              }
            />
            <DetailRow
              label="Currency"
              value={invoice.currency.toUpperCase()}
            />
            {invoice.po_number && (
              <DetailRow label="PO number" value={invoice.po_number} />
            )}
            {invoice.on_behalf_of_label && (
              <DetailRow
                label="On behalf of"
                value={invoice.on_behalf_of_label}
              />
            )}

            <Separator className="dark:bg-spaire-700 my-4 h-px bg-gray-300" />

            {/* Line items */}
            <div className="flex flex-col gap-1 pb-4">
              {invoice.line_items.map((item) => (
                <DetailRow
                  key={item.id}
                  label={
                    item.quantity > 1
                      ? `${item.description} × ${item.quantity}`
                      : item.description
                  }
                  value={fmt(item.unit_amount * item.quantity)}
                />
              ))}
            </div>

            {/* Totals */}
            <DetailRow label="Subtotal" value={fmt(invoice.subtotal_amount)} />
            <DetailRow
              label="Discount"
              value={
                invoice.discount_amount ? fmt(-invoice.discount_amount) : '—'
              }
            />
            <DetailRow label="Tax" value={fmt(invoice.tax_amount)} />
            <DetailRow label="Total" value={fmt(invoice.total_amount)} />

            {/* Memo */}
            {invoice.memo && (
              <>
                <Separator className="dark:bg-spaire-700 my-4 h-px bg-gray-300" />
                <DetailRow label="Note" value={invoice.memo} />
              </>
            )}

            {/* Invoice number from linked order (set after payment) */}
            {linkedOrder?.invoice_number && (
              <>
                <Separator className="dark:bg-spaire-700 my-4 h-px bg-gray-300" />
                <DetailRow
                  label="Invoice number"
                  value={linkedOrder.invoice_number}
                />
              </>
            )}
          </div>
        </div>
      </ShadowBox>
    </DashboardBody>
  )
}

export default InvoicePage
