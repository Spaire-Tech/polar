'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useDeleteManualInvoice,
  useGeneratePaymentLink,
  useIssueManualInvoice,
  useManualInvoice,
  useMarkPaidManualInvoice,
  useSendInvoiceEmail,
  useVoidManualInvoice,
} from '@/hooks/queries/manualInvoices'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
  issued: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  paid: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
  void: 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400',
}

interface InvoiceDetailPageProps {
  organization: schemas['Organization']
  invoiceId: string
}

const InvoiceDetailPage: React.FC<InvoiceDetailPageProps> = ({
  organization,
  invoiceId,
}) => {
  const router = useRouter()
  const { data: invoice, isLoading, refetch } = useManualInvoice(invoiceId)
  const issueInvoice = useIssueManualInvoice()
  const markPaid = useMarkPaidManualInvoice()
  const voidInvoice = useVoidManualInvoice()
  const generateLink = useGeneratePaymentLink()
  const sendEmail = useSendInvoiceEmail()
  const deleteInvoice = useDeleteManualInvoice()
  const [copied, setCopied] = useState(false)

  const handleAction = async (
    action: () => Promise<any>,
  ) => {
    try {
      await action()
      refetch()
    } catch {
      // Error handled by mutation
    }
  }

  const handleDelete = async () => {
    try {
      await deleteInvoice.mutateAsync(invoiceId)
      router.push(`/dashboard/${organization.slug}/invoices`)
    } catch {
      // Error handled by mutation
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <DashboardBody>
        <div className="flex items-center justify-center py-20">
          <div className="dark:bg-polar-700 h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        </div>
      </DashboardBody>
    )
  }

  if (!invoice) {
    return (
      <DashboardBody>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="dark:text-polar-400 text-gray-500">
            Invoice not found
          </p>
        </div>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody
      title={
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/${organization.slug}/invoices`}>
            <Button size="icon" variant="ghost">
              <ArrowBackOutlined fontSize="inherit" />
            </Button>
          </Link>
          <span>
            {invoice.invoice_number || 'Draft Invoice'}
          </span>
          <Status
            status={
              invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
            }
            className={statusColors[invoice.status] || ''}
          />
        </div>
      }
      header={
        <div className="flex items-center gap-2">
          {invoice.status === 'draft' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDelete}
                loading={deleteInvoice.isPending}
              >
                Delete
              </Button>
              <Link
                href={`/dashboard/${organization.slug}/invoices/${invoice.id}`}
              >
                <Button
                  size="sm"
                  onClick={() =>
                    handleAction(() =>
                      issueInvoice.mutateAsync(invoice.id),
                    )
                  }
                  loading={issueInvoice.isPending}
                >
                  Issue Invoice
                </Button>
              </Link>
            </>
          )}
          {invoice.status === 'issued' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  handleAction(() => voidInvoice.mutateAsync(invoice.id))
                }
                loading={voidInvoice.isPending}
              >
                Void
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  handleAction(() =>
                    markPaid.mutateAsync(invoice.id),
                  )
                }
                loading={markPaid.isPending}
              >
                Mark Paid
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Payment Link Card */}
        {invoice.status === 'issued' && (
          <ShadowBox>
            <div className="flex flex-col gap-4 p-6">
              <h3 className="text-lg font-medium dark:text-white">
                Payment Link
              </h3>
              {invoice.checkout_url ? (
                <div className="flex items-center gap-2">
                  <div className="dark:border-polar-700 dark:bg-polar-800 min-w-0 flex-1 overflow-hidden text-ellipsis rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm">
                    {invoice.checkout_url}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(invoice.checkout_url!)}
                    wrapperClassNames="gap-x-2"
                  >
                    <ContentCopyOutlined fontSize="inherit" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="dark:text-polar-400 text-sm text-gray-500">
                    No payment link generated yet.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      handleAction(() =>
                        generateLink.mutateAsync(invoice.id),
                      )
                    }
                    loading={generateLink.isPending}
                    wrapperClassNames="gap-x-2"
                  >
                    <LinkOutlined fontSize="inherit" />
                    Generate Payment Link
                  </Button>
                </div>
              )}

              {/* Send Email */}
              <div className="dark:border-polar-700 flex items-center justify-between border-t border-gray-200 pt-4">
                <div>
                  <p className="text-sm font-medium dark:text-white">
                    Send to Customer
                  </p>
                  {invoice.email_sent_at && (
                    <p className="dark:text-polar-400 text-xs text-gray-500">
                      Last sent:{' '}
                      <FormattedDateTime datetime={invoice.email_sent_at} />
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleAction(() => sendEmail.mutateAsync(invoice.id))
                  }
                  loading={sendEmail.isPending}
                  disabled={!invoice.customer_id}
                  wrapperClassNames="gap-x-2"
                >
                  <EmailOutlined fontSize="inherit" />
                  {invoice.email_sent_at ? 'Resend Email' : 'Send Email'}
                </Button>
              </div>
            </div>
          </ShadowBox>
        )}

        {/* Invoice Info */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ShadowBox>
            <div className="flex flex-col gap-4 p-6">
              <h3 className="text-lg font-medium dark:text-white">Details</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="dark:text-polar-400 text-sm text-gray-500">
                    Status
                  </dt>
                  <dd>
                    <Status
                      status={
                        invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)
                      }
                      className={statusColors[invoice.status] || ''}
                    />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="dark:text-polar-400 text-sm text-gray-500">
                    Invoice #
                  </dt>
                  <dd className="text-sm font-mono dark:text-white">
                    {invoice.invoice_number || '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="dark:text-polar-400 text-sm text-gray-500">
                    Currency
                  </dt>
                  <dd className="text-sm uppercase dark:text-white">
                    {invoice.currency}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="dark:text-polar-400 text-sm text-gray-500">
                    Created
                  </dt>
                  <dd className="text-sm dark:text-white">
                    <FormattedDateTime datetime={invoice.created_at} />
                  </dd>
                </div>
                {invoice.issued_at && (
                  <div className="flex justify-between">
                    <dt className="dark:text-polar-400 text-sm text-gray-500">
                      Issued
                    </dt>
                    <dd className="text-sm dark:text-white">
                      <FormattedDateTime datetime={invoice.issued_at} />
                    </dd>
                  </div>
                )}
                {invoice.paid_at && (
                  <div className="flex justify-between">
                    <dt className="dark:text-polar-400 text-sm text-gray-500">
                      Paid
                    </dt>
                    <dd className="text-sm dark:text-white">
                      <FormattedDateTime datetime={invoice.paid_at} />
                    </dd>
                  </div>
                )}
                {invoice.due_date && (
                  <div className="flex justify-between">
                    <dt className="dark:text-polar-400 text-sm text-gray-500">
                      Due Date
                    </dt>
                    <dd className="text-sm dark:text-white">
                      <FormattedDateTime datetime={invoice.due_date} />
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </ShadowBox>

          <ShadowBox>
            <div className="flex flex-col gap-4 p-6">
              <h3 className="text-lg font-medium dark:text-white">Customer</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="dark:text-polar-400 text-sm text-gray-500">
                    Name
                  </dt>
                  <dd className="text-sm dark:text-white">
                    {invoice.billing_name || '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="dark:text-polar-400 text-sm text-gray-500">
                    Customer ID
                  </dt>
                  <dd className="text-sm font-mono dark:text-white">
                    {invoice.customer_id || '—'}
                  </dd>
                </div>
              </dl>

              {invoice.notes && (
                <div className="dark:border-polar-700 border-t border-gray-200 pt-4">
                  <p className="dark:text-polar-400 mb-1 text-sm text-gray-500">
                    Notes
                  </p>
                  <p className="dark:text-polar-300 whitespace-pre-wrap text-sm text-gray-700">
                    {invoice.notes}
                  </p>
                </div>
              )}
            </div>
          </ShadowBox>
        </div>

        {/* Line Items */}
        <ShadowBox>
          <div className="flex flex-col gap-4 p-6">
            <h3 className="text-lg font-medium dark:text-white">Line Items</h3>
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-polar-700">
              <table className="w-full">
                <thead>
                  <tr className="dark:bg-polar-800 border-b border-gray-200 bg-gray-50 dark:border-polar-700">
                    <th className="dark:text-polar-400 px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Description
                    </th>
                    <th className="dark:text-polar-400 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Unit Price
                    </th>
                    <th className="dark:text-polar-400 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="dark:text-polar-400 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-200 last:border-0 dark:border-polar-700"
                    >
                      <td className="px-4 py-3 text-sm dark:text-white">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-right text-sm dark:text-polar-300">
                        {formatCurrency('compact')(
                          item.unit_amount,
                          invoice.currency,
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm dark:text-polar-300">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium dark:text-white">
                        {formatCurrency('compact')(
                          item.amount,
                          invoice.currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="dark:text-polar-400 text-gray-500">
                    Subtotal
                  </span>
                  <span className="dark:text-polar-300 text-gray-700">
                    {formatCurrency('compact')(
                      invoice.subtotal_amount,
                      invoice.currency,
                    )}
                  </span>
                </div>
                <div className="dark:border-polar-700 border-t border-gray-200 pt-2">
                  <div className="flex justify-between font-semibold">
                    <span className="dark:text-white">Total</span>
                    <span className="dark:text-white">
                      {formatCurrency('compact')(
                        invoice.total_amount,
                        invoice.currency,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ShadowBox>
      </div>
    </DashboardBody>
  )
}

export default InvoiceDetailPage
