'use client'

import { formatCurrency } from '@spaire/currency'
import { format } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  open: 'bg-blue-50 text-blue-700 border border-blue-200',
  paid: 'bg-green-50 text-green-700 border border-green-200',
  void: 'bg-gray-100 text-gray-500 border border-gray-200',
  uncollectible: 'bg-red-50 text-red-700 border border-red-200',
}

export interface InvoiceDocumentData {
  invoiceNumber?: string
  status?: string
  issueDate?: Date | string | null
  dueDate?: Date | string | null
  currency: string
  customerName?: string
  customerEmail?: string
  onBehalfOfLabel?: string
  organizationName?: string
  organizationLogoUrl?: string
  showLogo?: boolean
  showMorAttribution?: boolean
  lineItems: Array<{
    description: string
    quantity: number
    unitAmount: number
  }>
  subtotalAmount: number
  discountAmount: number
  discountLabel?: string
  taxAmount: number
  totalAmount: number
  memo?: string
  poNumber?: string
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    return format(date, 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

const InvoiceDocument: React.FC<{
  data: InvoiceDocumentData
  isPreview?: boolean
}> = ({ data, isPreview }) => {
  const fmt = (cents: number) => formatCurrency('compact')(cents, data.currency)
  const currency = data.currency.toUpperCase()

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-950">
      {isPreview && (
        <div className="border-b border-dashed border-gray-200 bg-gray-50 px-6 py-2 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Live Preview
          </span>
        </div>
      )}

      <div className="p-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {data.showLogo !== false && data.organizationLogoUrl && (
              <img
                src={data.organizationLogoUrl}
                alt={data.organizationName ?? 'Logo'}
                className="h-10 w-10 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                {data.showMorAttribution !== false
                  ? 'Spaire, Inc.'
                  : data.organizationName ?? 'Spaire, Inc.'}
              </p>
              {data.showMorAttribution !== false ? (
                <p className="mt-0.5 text-xs text-gray-400">Merchant of Record</p>
              ) : data.organizationName ? (
                <p className="mt-0.5 text-xs text-gray-400">Invoice</p>
              ) : (
                <p className="mt-0.5 text-xs text-gray-400">Merchant of Record</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-thin uppercase tracking-[0.25em] text-gray-200 dark:text-gray-700">
              Invoice
            </p>
            {data.invoiceNumber && (
              <p className="mt-1 font-mono text-xs text-gray-400">
                #{data.invoiceNumber}
              </p>
            )}
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              {currency}
            </p>
          </div>
        </div>

        {/* ── Date / Status Bar ───────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              Date Issued
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {fmtDate(data.issueDate ?? new Date())}
            </p>
          </div>
          <div className="border-x border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              Due Date
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {fmtDate(data.dueDate)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              Status
            </p>
            {data.status ? (
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[data.status] ?? ''}`}
              >
                {data.status}
              </span>
            ) : (
              <p className="mt-1 text-sm text-gray-400">Draft</p>
            )}
          </div>
        </div>

        {/* ── Addresses ───────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              From
            </p>
            {data.showMorAttribution !== false ? (
              <>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Spaire, Inc.
                </p>
                {data.onBehalfOfLabel && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    on behalf of {data.onBehalfOfLabel}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                {data.onBehalfOfLabel || data.organizationName || 'Your Organization'}
              </p>
            )}
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              Bill To
            </p>
            {data.customerName ? (
              <>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {data.customerName}
                </p>
                {data.customerEmail && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {data.customerEmail}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-300 dark:text-gray-600">
                No customer selected
              </p>
            )}
            {data.poNumber && (
              <p className="mt-1 text-xs text-gray-500">PO: {data.poNumber}</p>
            )}
          </div>
        </div>

        {/* ── Line Items ──────────────────────────────────────────── */}
        <div className="mt-8">
          <div className="grid grid-cols-[1fr_44px_90px_90px] gap-x-3 border-b-2 border-gray-100 pb-2 dark:border-gray-800">
            {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
              <span
                key={h}
                className={`text-[9px] font-semibold uppercase tracking-wider text-gray-400 ${i === 1 ? 'text-center' : i > 1 ? 'text-right' : ''}`}
              >
                {h}
              </span>
            ))}
          </div>

          {data.lineItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-300 dark:text-gray-700">
              No items yet
            </div>
          ) : (
            data.lineItems.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_44px_90px_90px] gap-x-3 border-b border-gray-50 py-3 last:border-0 dark:border-gray-800/50"
              >
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {item.description || (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </span>
                <span className="text-center text-sm text-gray-500">
                  {item.quantity}
                </span>
                <span className="text-right text-sm text-gray-500">
                  {item.unitAmount > 0 ? fmt(item.unitAmount) : '—'}
                </span>
                <span className="text-right text-sm font-medium text-gray-900 dark:text-white">
                  {item.unitAmount > 0 ? fmt(item.unitAmount * item.quantity) : '—'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* ── Totals ──────────────────────────────────────────────── */}
        <div className="mt-4 flex justify-end">
          <div className="w-56 space-y-2.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{fmt(data.subtotalAmount)}</span>
            </div>
            {data.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                <span>{data.discountLabel ?? 'Discount'}</span>
                <span>−{fmt(data.discountAmount)}</span>
              </div>
            )}
            {data.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span>{fmt(data.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2.5 text-base font-bold text-gray-900 dark:border-gray-700 dark:text-white">
              <span>Total due</span>
              <span>{fmt(data.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Memo ────────────────────────────────────────────────── */}
        {data.memo && (
          <div className="mt-8 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-900">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              Note
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {data.memo}
            </p>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="mt-8 border-t border-gray-100 pt-4 dark:border-gray-800">
          {data.showMorAttribution !== false ? (
            <p className="text-[10px] leading-relaxed text-gray-400">
              Issued by Spaire, Inc. as Merchant of Record on behalf of{' '}
              {data.onBehalfOfLabel ?? 'the organization'}.
            </p>
          ) : (
            <p className="text-[10px] leading-relaxed text-gray-400">
              Issued by{' '}
              {data.onBehalfOfLabel || data.organizationName || 'the organization'}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvoiceDocument
