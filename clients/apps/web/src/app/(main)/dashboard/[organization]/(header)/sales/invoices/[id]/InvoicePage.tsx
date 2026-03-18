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
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import OpenInNew from '@mui/icons-material/OpenInNew'
import Send from '@mui/icons-material/Send'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import React, { useState } from 'react'
import InvoiceDocument, {
  InvoiceDocumentData,
} from '../InvoiceDocument'

interface InvoicePageProps {
  organization: schemas['Organization']
  invoiceId: string
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

  const invoiceNumber =
    invoice.stripe_invoice_id?.replace('in_', '') ??
    invoice.id.slice(0, 8).toUpperCase()

  const docData: InvoiceDocumentData = {
    invoiceNumber,
    status: invoice.status,
    issueDate: invoice.created_at,
    dueDate: invoice.due_date,
    currency: invoice.currency,
    customerName: customer?.name ?? customer?.email,
    customerEmail: customer?.name ? customer?.email : undefined,
    onBehalfOfLabel: invoice.on_behalf_of_label ?? organization.name,
    lineItems: invoice.line_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unit_amount,
    })),
    subtotalAmount: invoice.subtotal_amount,
    discountAmount: invoice.discount_amount,
    discountLabel: invoice.discount_label ?? undefined,
    taxAmount: invoice.tax_amount,
    totalAmount: invoice.total_amount,
    memo: invoice.memo ?? undefined,
    poNumber: invoice.po_number ?? undefined,
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
        {/* ── Main: invoice document ───────────────────────────── */}
        <div className="min-w-0 flex-1 flex flex-col gap-6">
          <InvoiceDocument data={docData} />

          {/* Payment link card */}
          {invoice.include_payment_link &&
            invoice.stripe_hosted_invoice_url && (
              <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 dark:border-blue-900/40 dark:bg-blue-950/30">
                <LinkOutlined className="shrink-0 text-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Payment link
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-blue-500">
                    {invoice.stripe_hosted_invoice_url}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      invoice.stripe_hosted_invoice_url!,
                    )
                    toast({ title: 'Copied to clipboard' })
                  }}
                  className="shrink-0 text-blue-400 transition-colors hover:text-blue-600"
                  title="Copy link"
                >
                  <ContentCopyOutlined fontSize="small" />
                </button>
                <a
                  href={invoice.stripe_hosted_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-blue-400 transition-colors hover:text-blue-600"
                  title="Open link"
                >
                  <OpenInNew fontSize="small" />
                </a>
              </div>
            )}
        </div>

        {/* ── Sidebar: actions + details ───────────────────────── */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <ShadowBox className="flex flex-col gap-5">
            {/* Actions */}
            {(isDraft || invoice.stripe_hosted_invoice_url) && (
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
                {invoice.stripe_hosted_invoice_url && (
                  <a
                    href={invoice.stripe_hosted_invoice_url}
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
            )}

            {/* Divider */}
            {(isDraft || invoice.stripe_hosted_invoice_url) && (
              <div className="border-t border-gray-100 dark:border-gray-800" />
            )}

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
              {customer?.name && (
                <DetailRow label="Customer" value={customer.name} />
              )}
              {customer?.email && (
                <DetailRow label="Email" value={customer.email} />
              )}
              {invoice.memo && (
                <DetailRow label="Notes" value={invoice.memo} />
              )}
              {invoice.po_number && (
                <DetailRow label="PO Number" value={invoice.po_number} />
              )}
              {invoice.on_behalf_of_label && (
                <DetailRow
                  label="On behalf of"
                  value={invoice.on_behalf_of_label}
                />
              )}
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
