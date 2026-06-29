'use client'

import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { DownloadInvoiceDashboard } from '@/components/Orders/DownloadInvoice'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { RefundModal } from '@/components/Refunds/RefundModal'
import {
  RefundReasonDisplay,
  RefundStatusDisplayColor,
  RefundStatusDisplayTitle,
} from '@/components/Refunds/utils'
import { DetailRow } from '@/components/Shared/DetailRow'
import { useOrder } from '@/hooks/queries/orders'
import { usePayments } from '@/hooks/queries/payments'
import { useRefunds } from '@/hooks/queries/refunds'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Button from '@spaire/ui/components/atoms/Button'
import { DataTable } from '@spaire/ui/components/atoms/DataTable'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import { Status } from '@spaire/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

// Inline order detail rendered inside the editor's Sales tab. Reuses the same
// data hooks (useOrder/usePayments/useRefunds) and building blocks (DetailRow,
// RefundModal, payment/refund tables) as the dashboard order page, wrapped in
// editor card styling with a back link instead of the dashboard chrome.

export function SalesOrderDetail({
  organization,
  orderId,
  onBack,
}: {
  organization: schemas['Organization']
  orderId: string
  onBack: () => void
}) {
  const { data: order, refetch: refetchOrder } = useOrder(orderId)
  const { data: payments, isLoading: paymentsLoading } = usePayments(
    organization.id,
    { order_id: orderId },
  )
  const { data: refunds, isLoading: refundsLoading } = useRefunds(orderId)

  const {
    isShown: isRefundModalShown,
    show: showRefundModal,
    hide: hideRefundModal,
  } = useModal()

  const canRefund =
    order?.paid && (order?.refunded_amount ?? 0) < (order?.net_amount ?? 0)

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-8">
      <button
        type="button"
        onClick={onBack}
        className="text-ce-accent mb-6 flex items-center gap-0.5 text-[13px] tracking-tight transition-opacity hover:opacity-70"
      >
        <ChevronLeftOutlined sx={{ fontSize: 16 }} />
        Sales
      </button>

      {!order ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-medium text-gray-900">Order</h1>
              <OrderStatus status={order.status} />
            </div>
            {order.paid && (
              <DownloadInvoiceDashboard
                order={order}
                organization={organization}
                onInvoiceGenerated={refetchOrder}
              />
            )}
          </div>

          {/* Summary + amounts breakdown */}
          <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-6">
            <DetailRow label="Invoice number" value={order.invoice_number} />
            <DetailRow
              label="Order ID"
              value={order.id}
              valueClassName="font-mono text-sm"
            />
            <DetailRow
              label="Order Date"
              value={
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="time"
                  datetime={order.created_at}
                />
              }
            />
            <DetailRow
              label="Discount Code"
              value={order.discount ? order.discount.code : '—'}
              valueClassName="font-mono capitalize"
            />
            <DetailRow
              label="Billing Reason"
              value={order.billing_reason.split('_').join(' ')}
              valueClassName="capitalize"
            />

            <div className="my-4 h-px bg-gray-200" />

            <div className="flex flex-col gap-1 pb-4">
              {order.items.map((item) => (
                <DetailRow
                  key={item.id}
                  label={item.label}
                  value={formatCurrency('accounting')(
                    item.amount,
                    order.currency,
                  )}
                />
              ))}
            </div>

            <DetailRow
              label="Subtotal"
              value={formatCurrency('accounting')(
                order.subtotal_amount,
                order.currency,
              )}
            />
            <DetailRow
              label="Discount"
              value={
                order.discount_amount
                  ? formatCurrency('accounting')(
                      -order.discount_amount,
                      order.currency,
                    )
                  : '—'
              }
            />
            <DetailRow
              label="Net amount"
              value={formatCurrency('accounting')(
                order.net_amount,
                order.currency,
              )}
            />
            <DetailRow
              label="Tax"
              value={formatCurrency('accounting')(
                order.tax_amount,
                order.currency,
              )}
            />
            <DetailRow
              label="Total"
              value={formatCurrency('accounting')(
                order.total_amount,
                order.currency,
              )}
            />

            {order.billing_address && (
              <>
                <div className="my-4 h-px bg-gray-200" />
                <DetailRow
                  label="Country"
                  value={order.billing_address.country}
                />
                <DetailRow
                  label="Address"
                  value={order.billing_address.line1}
                />
                <DetailRow label="City" value={order.billing_address.city} />
                <DetailRow label="State" value={order.billing_address.state} />
                <DetailRow
                  label="Postal Code"
                  value={order.billing_address.postal_code}
                />
              </>
            )}
          </div>

          {/* Payment attempts */}
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-medium text-gray-900">
              Payment Attempts
            </h3>
            <DataTable
              isLoading={paymentsLoading}
              columns={[
                {
                  accessorKey: 'created_at',
                  header: 'Created At',
                  cell: ({
                    row: {
                      original: { created_at },
                    },
                  }) => (
                    <FormattedDateTime
                      dateStyle="medium"
                      resolution="time"
                      datetime={created_at}
                    />
                  ),
                },
                {
                  accessorKey: 'method',
                  header: 'Method',
                  cell: ({ row: { original } }) => (
                    <PaymentMethod payment={original} />
                  ),
                },
                {
                  accessorKey: 'status',
                  header: 'Status',
                  cell: ({ row: { original } }) => (
                    <PaymentStatus payment={original} />
                  ),
                },
              ]}
              data={payments?.items ?? []}
            />
          </div>

          {/* Refunds */}
          {order.paid && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-medium text-gray-900">Refunds</h3>
                {canRefund && (
                  <Button onClick={showRefundModal}>Refund Order</Button>
                )}
              </div>
              <DataTable
                isLoading={refundsLoading}
                columns={[
                  {
                    accessorKey: 'created_at',
                    header: 'Created At',
                    cell: ({ row }) => (
                      <FormattedDateTime
                        dateStyle="long"
                        datetime={row.original.created_at}
                      />
                    ),
                  },
                  {
                    accessorKey: 'amount',
                    header: 'Amount',
                    cell: ({ row }) =>
                      formatCurrency('compact')(
                        row.original.amount,
                        row.original.currency,
                      ),
                  },
                  {
                    accessorKey: 'status',
                    header: 'Status',
                    cell: ({ row }) => (
                      <Status
                        className={twMerge(
                          RefundStatusDisplayColor[row.original.status],
                          'w-fit',
                        )}
                        status={RefundStatusDisplayTitle[row.original.status]}
                      />
                    ),
                  },
                  {
                    accessorKey: 'reason',
                    header: 'Reason',
                    cell: ({ row }) => RefundReasonDisplay[row.original.reason],
                  },
                ]}
                data={refunds?.items ?? []}
              />
            </div>
          )}

          <InlineModal
            isShown={isRefundModalShown}
            hide={hideRefundModal}
            modalContent={<RefundModal order={order} hide={hideRefundModal} />}
          />
        </div>
      )}
    </div>
  )
}
