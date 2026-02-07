'use client'

import {
  useFinancialAccount,
  useTreasuryTransactions,
} from '@/hooks/queries'
import type { TreasuryTransactionData } from '@/hooks/queries/businessWallet'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useState } from 'react'

function formatCurrency(cents: number, signed = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: signed ? 'always' : 'auto',
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    received_credit: 'Received',
    received_debit: 'Debit',
    outbound_payment: 'Payment',
    outbound_transfer: 'Transfer',
    inbound_transfer: 'Transfer In',
    issuing_authorization: 'Card Spend',
    other: 'Other',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

export default function TransactionsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: financialAccount, isLoading: faLoading } =
    useFinancialAccount(organization.id)

  const { data: transactionsData, isLoading: txLoading } =
    useTreasuryTransactions(financialAccount?.id, page, limit)

  const transactions = transactionsData?.items ?? []
  const totalCount = transactionsData?.pagination?.total_count ?? 0
  const maxPage = transactionsData?.pagination?.max_page ?? 1

  if (faLoading) {
    return (
      <div className="flex flex-col gap-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="dark:bg-polar-700 h-14 animate-pulse rounded-xl bg-gray-100"
          />
        ))}
      </div>
    )
  }

  if (!financialAccount) {
    return (
      <div className="flex flex-col items-center gap-y-4 py-24 text-center">
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Open a business account to view transactions.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-8">
      {/* Balance row */}
      <div className="flex gap-x-8">
        <div className="flex flex-col gap-y-0.5">
          <p className="dark:text-polar-500 text-xs text-gray-400">Available</p>
          <p className="text-lg font-medium dark:text-white text-gray-900">
            {formatCurrency(financialAccount.balance_cash)}
          </p>
        </div>
        <div className="flex flex-col gap-y-0.5">
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Pending In
          </p>
          <p className="text-lg font-medium dark:text-white text-gray-900">
            {formatCurrency(financialAccount.balance_inbound_pending)}
          </p>
        </div>
        <div className="flex flex-col gap-y-0.5">
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Pending Out
          </p>
          <p className="text-lg font-medium dark:text-white text-gray-900">
            {formatCurrency(financialAccount.balance_outbound_pending)}
          </p>
        </div>
      </div>

      {/* Transactions */}
      <div className="dark:border-polar-700 overflow-hidden rounded-2xl border border-gray-200">
        {/* Header */}
        <div className="dark:border-polar-700 dark:bg-polar-900 flex items-center border-b border-gray-100 bg-gray-50 px-6 py-3">
          <div className="flex-1 text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
            Description
          </div>
          <div className="hidden w-28 text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500 md:block">
            Type
          </div>
          <div className="hidden w-20 text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500 md:block">
            Status
          </div>
          <div className="w-28 text-right text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
            Amount
          </div>
          <div className="hidden w-28 text-right text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500 md:block">
            Date
          </div>
        </div>

        {/* Loading */}
        {txLoading && (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="dark:border-polar-700 flex items-center border-b border-gray-100 px-6 py-4 last:border-b-0"
              >
                <div className="dark:bg-polar-700 h-4 w-40 animate-pulse rounded bg-gray-100" />
                <div className="ml-auto">
                  <div className="dark:bg-polar-700 h-4 w-16 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!txLoading && transactions.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="dark:text-polar-400 text-sm text-gray-500">
              No transactions yet.
            </p>
          </div>
        )}

        {/* Rows */}
        {!txLoading &&
          transactions.map((tx: TreasuryTransactionData) => (
            <div
              key={tx.id}
              className="dark:border-polar-700 dark:hover:bg-polar-900/50 flex items-center border-b border-gray-100 px-6 py-4 transition-colors last:border-b-0 hover:bg-gray-50"
            >
              <div className="flex flex-1 flex-col gap-y-0.5">
                <p className="text-sm dark:text-white text-gray-900">
                  {tx.description || 'Transaction'}
                </p>
                {tx.counterparty_name && (
                  <p className="dark:text-polar-500 text-xs text-gray-400">
                    {tx.counterparty_name}
                  </p>
                )}
              </div>
              <div className="hidden w-28 md:block">
                <span className="dark:text-polar-400 text-xs text-gray-500">
                  {getTypeLabel(tx.transaction_type)}
                </span>
              </div>
              <div className="hidden w-20 md:block">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tx.status === 'posted'
                      ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                      : tx.status === 'open'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        : 'dark:bg-polar-700 dark:text-polar-400 bg-gray-100 text-gray-500'
                  }`}
                >
                  {tx.status}
                </span>
              </div>
              <div className="w-28 text-right">
                <span
                  className={`text-sm font-medium ${
                    tx.amount >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'dark:text-white text-gray-900'
                  }`}
                >
                  {formatCurrency(tx.amount, true)}
                </span>
              </div>
              <div className="hidden w-28 text-right md:block">
                <span className="dark:text-polar-400 text-xs text-gray-500">
                  {formatDate(tx.created_at)}
                </span>
              </div>
            </div>
          ))}
      </div>

      {/* Pagination */}
      {maxPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="dark:text-polar-400 text-xs text-gray-500">
            {totalCount} transactions
          </p>
          <div className="flex gap-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= maxPage}
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
