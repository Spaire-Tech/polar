'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DetailRow } from '@/components/Shared/DetailRow'
import { toast } from '@/components/Toast/use-toast'
import {
  useClientInvoice,
  useSendClientInvoice,
  useVoidClientInvoice,
} from '@/hooks/queries/client_invoices'
import { useCustomer } from '@/hooks/queries/customers'
import OpenInNew from '@mui/icons-material/OpenInNew'
import Send from '@mui/icons-material/Send'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Button from '@spaire/ui/components/atoms/Button'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import React, { useState } from 'react'

interface InvoicePageProps {
  organization: schemas['Organization']
  invoiceId: string
}

const STATUS_BADGE: Record<string, string> = {
  draft:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  void: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  uncollectible:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const InvoicePage: React.FC<InvoicePageProps> = ({
  organization,
  invoiceId,
}) => {
  const [confirmVoid, setConfirmVoid] = useState(false)

  const { data: invoice, isLoading } = useClientInvoice(invoiceId)
  const { data: customer } = useCustomer(
    invoice ? invoice.customer_id.toString() : null,
  )
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
  const isVoidable = isDraft || isOpen

  const fmt = (cents: number) =>
    formatCurrency('accounting')(cents, invoice.currency)

  // Stripe dashboard URL for admin access
  const stripeDashboardUrl = invoice.stripe_invoice_id
    ? `https://dashboard.stripe.com/invoices/${invoice.stripe_invoice_id}`
    : null

  return (
    <DashboardBody
      title={
        <div className="flex items-center gap-3">
          <span>Invoice</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[invoice.status] ?? ''}`}
          >
            {invoice.status}
          </span>
        </div>
      }
      wrapperClassName="max-w-(--breakpoint-lg)!"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 flex flex-col gap-8">
          {/* Customer section */}
          <div className="flex flex-col">
            {customer?.name && (
              <DetailRow label="Customer" value={customer.name} />
            )}
            {customer?.email && (
              <DetailRow label="Email" value={customer.email} />
            )}
            <DetailRow
              label="Invoice date"
              value={<FormattedDateTime datetime={invoice.created_at} />}
            />
            {invoice.due_date && (
              <DetailRow
                label="Due date"
                value={<FormattedDateTime datetime={invoice.due_date} />}
              />
            )}
            {invoice.po_number && (
              <DetailRow label="PO number" value={invoice.po_number} />
            )}
            {invoice.on_behalf_of_label && (
              <DetailRow
                label="On behalf of"
                value={invoice.on_behalf_of_label}
              />
            )}
          </div>

          {/* Line items */}
          {invoice.line_items.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Items
              </h3>
              <div className="flex flex-col">
                {invoice.line_items.map((item) => (
                  <DetailRow
                    key={item.id}
                    label={
                      item.quantity > 1
                        ? `${item.description} × ${item.quantity}`
                        : item.description
                    }
                    value={fmt(item.unit_amount * item.quantity)}
                    valueClassName="justify-end"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex flex-col">
            <DetailRow
              label="Subtotal"
              value={fmt(invoice.subtotal_amount)}
              valueClassName="justify-end"
            />
            {invoice.discount_amount > 0 && (
              <DetailRow
                label={invoice.discount_label ?? 'Discount'}
                value={fmt(-invoice.discount_amount)}
                valueClassName="justify-end"
              />
            )}
            {invoice.tax_amount > 0 && (
              <DetailRow
                label="Tax"
                value={fmt(invoice.tax_amount)}
                valueClassName="justify-end"
              />
            )}
            <DetailRow
              label={
                <span className="font-semibold text-gray-900 dark:text-white">
                  Total
                </span>
              }
              value={
                <span className="font-semibold text-gray-900 dark:text-white">
                  {fmt(invoice.total_amount)}
                </span>
              }
              valueClassName="justify-end"
            />
          </div>

          {/* Memo */}
          {invoice.memo && (
            <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Note
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {invoice.memo}
              </p>
            </div>
          )}
        </div>

        {/* ── Sidebar: actions + details ───────────────────────────── */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <ShadowBox className="flex flex-col gap-5">
            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isDraft && (
                <Button
                  fullWidth
                  loading={sendInvoice.isPending}
                  onClick={handleSend}
                >
                  <Send fontSize="small" />
                  Send Invoice
                </Button>
              )}
              {isOpen && invoice.checkout_link && (
                <a
                  href={invoice.checkout_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button fullWidth>
                    Pay online
                  </Button>
                </a>
              )}
              {stripeDashboardUrl && (
                <a
                  href={stripeDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="secondary" fullWidth>
                    <OpenInNew fontSize="small" />
                    View on Stripe
                  </Button>
                </a>
              )}
              {isVoidable && (
                <Button
                  variant="secondary"
                  fullWidth
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
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800" />

            {/* Details */}
            <div className="flex flex-col gap-3">
              <DetailRow
                label="Invoice ID"
                value={
                  <span className="font-mono text-xs">
                    {invoice.id.slice(0, 8).toUpperCase()}
                  </span>
                }
              />
              <DetailRow
                label="Created"
                value={<FormattedDateTime datetime={invoice.created_at} />}
              />
              {invoice.due_date && (
                <DetailRow
                  label="Due"
                  value={<FormattedDateTime datetime={invoice.due_date} />}
                />
              )}
              <DetailRow
                label="Currency"
                value={invoice.currency.toUpperCase()}
              />
              {invoice.order_id && (
                <DetailRow
                  label="Order"
                  value={
                    <Link
                      href={`/dashboard/${organization.slug}/sales/${invoice.order_id}`}
                      className="text-blue-500 underline"
                    >
                      View order
                    </Link>
                  }
                />
              )}
            </div>
          </ShadowBox>
        </div>
      </div>
    </DashboardBody>
  )
}

export default InvoicePage
