'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DetailRow } from '@/components/Shared/DetailRow'
import { toast } from '@/components/Toast/use-toast'
import {
  useClientInvoice,
  useSendClientInvoice,
  useVoidClientInvoice,
} from '@/hooks/queries/client_invoices'
import OpenInNew from '@mui/icons-material/OpenInNew'
import Send from '@mui/icons-material/Send'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import { formatCurrency } from '@spaire/currency'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

const statusColors: Record<string, string> = {
  draft:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  void: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  uncollectible:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

interface InvoicePageProps {
  organization: schemas['Organization']
  invoiceId: string
}

const InvoicePage: React.FC<InvoicePageProps> = ({
  organization,
  invoiceId,
}) => {
  const router = useRouter()
  const [confirmVoid, setConfirmVoid] = useState(false)

  const { data: invoice, isLoading } = useClientInvoice(invoiceId)
  const sendInvoice = useSendClientInvoice(invoiceId)
  const voidInvoice = useVoidClientInvoice(invoiceId)

  if (isLoading || !invoice) {
    return (
      <DashboardBody title="Invoice">
        <div className="dark:bg-spaire-800 h-32 animate-pulse rounded-xl bg-gray-100" />
      </DashboardBody>
    )
  }

  const handleSend = async () => {
    try {
      await sendInvoice.mutateAsync()
      toast({ title: 'Invoice sent' })
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

  return (
    <DashboardBody
      title={
        <div className="flex flex-row items-center gap-3">
          <span>Invoice</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[invoice.status] ?? ''}`}
          >
            {invoice.status}
          </span>
        </div>
      }
      header={
        <div className="flex gap-2">
          {invoice.stripe_hosted_invoice_url && (
            <a
              href={invoice.stripe_hosted_invoice_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm">
                <OpenInNew fontSize="small" />
                View online
              </Button>
            </a>
          )}
          {isDraft && (
            <Button
              size="sm"
              loading={sendInvoice.isPending}
              onClick={handleSend}
            >
              <Send fontSize="small" />
              Send Invoice
            </Button>
          )}
          {isVoidable && (
            <Button
              variant="secondary"
              size="sm"
              loading={voidInvoice.isPending}
              onClick={handleVoid}
              className={
                confirmVoid
                  ? 'border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : ''
              }
            >
              {confirmVoid ? 'Confirm void?' : 'Void'}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Main content */}
        <div className="flex flex-1 flex-col gap-6">
          {/* Line items */}
          <ShadowBox className="flex flex-col gap-0 p-0">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-sm font-medium dark:text-white">Items</h3>
            </div>
            <div className="flex flex-col">
              <div className="grid grid-cols-[1fr_60px_100px_100px] gap-3 border-b border-gray-100 px-6 py-2 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Amount</span>
              </div>
              {invoice.line_items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_60px_100px_100px] items-center gap-3 border-b border-gray-100 px-6 py-3 text-sm last:border-0 dark:border-gray-800"
                >
                  <span className="dark:text-white">{item.description}</span>
                  <span className="text-center text-gray-500">
                    {item.quantity}
                  </span>
                  <span className="text-right text-gray-500">
                    {formatCurrency('compact')(item.unit_amount, invoice.currency)}
                  </span>
                  <span className="text-right font-medium dark:text-white">
                    {formatCurrency('compact')(item.amount, invoice.currency)}
                  </span>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex flex-col items-end gap-2 text-sm">
                <div className="flex w-48 justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>
                    {formatCurrency('compact')(
                      invoice.subtotal_amount,
                      invoice.currency,
                    )}
                  </span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex w-48 justify-between text-green-600 dark:text-green-400">
                    <span>{invoice.discount_label ?? 'Discount'}</span>
                    <span>
                      -
                      {formatCurrency('compact')(
                        invoice.discount_amount,
                        invoice.currency,
                      )}
                    </span>
                  </div>
                )}
                {invoice.tax_amount > 0 && (
                  <div className="flex w-48 justify-between text-gray-500">
                    <span>Tax</span>
                    <span>
                      {formatCurrency('compact')(
                        invoice.tax_amount,
                        invoice.currency,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex w-48 justify-between border-t border-gray-200 pt-2 font-semibold dark:border-gray-700 dark:text-white">
                  <span>Total</span>
                  <span>
                    {formatCurrency('compact')(
                      invoice.total_amount,
                      invoice.currency,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </ShadowBox>

          {/* Payment link */}
          {invoice.stripe_hosted_invoice_url && invoice.include_payment_link && (
            <ShadowBox className="flex flex-col gap-3">
              <h3 className="text-sm font-medium dark:text-white">
                Payment Link
              </h3>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
                <span className="flex-1 truncate text-xs text-blue-500 underline">
                  {invoice.stripe_hosted_invoice_url}
                </span>
                <a
                  href={invoice.stripe_hosted_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNew
                    fontSize="small"
                    className="text-gray-400 hover:text-gray-600"
                  />
                </a>
              </div>
            </ShadowBox>
          )}
        </div>

        {/* Right: invoice details */}
        <div className="w-full lg:w-72">
          <ShadowBox className="flex flex-col gap-4">
            <h3 className="text-sm font-medium dark:text-white">Details</h3>
            <DetailRow label="Invoice ID" value={invoice.id} />
            <DetailRow
              label="Created"
              value={<FormattedDateTime datetime={invoice.created_at} />}
            />
            {invoice.due_date && (
              <DetailRow
                label="Due date"
                value={<FormattedDateTime datetime={invoice.due_date} />}
              />
            )}
            <DetailRow
              label="Currency"
              value={invoice.currency.toUpperCase()}
            />
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
          </ShadowBox>
        </div>
      </div>
    </DashboardBody>
  )
}

export default InvoicePage
