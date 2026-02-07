'use client'

import {
  useFinancialAccount,
  useSyncTransactions,
  useTreasuryTransactions,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { useCallback, useState } from 'react'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always',
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    received_credit: 'Received',
    received_debit: 'Debit',
    outbound_payment: 'Outbound Payment',
    outbound_transfer: 'Outbound Transfer',
    inbound_transfer: 'Inbound Transfer',
    issuing_authorization: 'Card Spend',
    other: 'Other',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    posted:
      'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
    open: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    void: 'dark:bg-polar-700 dark:text-polar-400 bg-gray-100 text-gray-500',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.open}`}
    >
      {status}
    </span>
  )
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

  const {
    data: transactionsData,
    isLoading: txLoading,
    refetch: refetchTx,
  } = useTreasuryTransactions(financialAccount?.id, page, limit)

  const syncTransactions = useSyncTransactions()

  const handleSync = useCallback(async () => {
    if (!financialAccount?.id) return
    await syncTransactions.mutateAsync(financialAccount.id)
    refetchTx()
  }, [financialAccount, syncTransactions, refetchTx])

  const transactions = transactionsData?.items ?? []
  const totalCount = transactionsData?.pagination?.total_count ?? 0
  const maxPage = transactionsData?.pagination?.max_page ?? 1

  if (faLoading) {
    return (
      <div className="flex flex-col gap-y-8">
        <h2 className="text-lg font-medium dark:text-white text-gray-900">
          Transactions
        </h2>
        <div className="flex flex-col gap-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="dark:bg-polar-700 h-16 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!financialAccount) {
    return (
      <div className="flex flex-col gap-y-8">
        <h2 className="text-lg font-medium dark:text-white text-gray-900">
          Transactions
        </h2>
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardContent className="flex flex-col items-center gap-y-4 py-12 text-center">
            <p className="dark:text-polar-400 text-sm text-gray-500">
              Open a Financial Business Account to view transactions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Transactions
          </h2>
          <span className="dark:text-polar-400 text-sm text-gray-500">
            {totalCount} total
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          loading={syncTransactions.isPending}
        >
          Sync from Stripe
        </Button>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardContent className="flex flex-col gap-y-1 p-4">
            <p className="dark:text-polar-400 text-xs text-gray-500">
              Available
            </p>
            <p className="text-lg font-medium dark:text-white text-gray-900">
              {formatCurrency(financialAccount.balance_cash)}
            </p>
          </CardContent>
        </Card>
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardContent className="flex flex-col gap-y-1 p-4">
            <p className="dark:text-polar-400 text-xs text-gray-500">
              Pending In
            </p>
            <p className="text-lg font-medium dark:text-white text-gray-900">
              {formatCurrency(financialAccount.balance_inbound_pending)}
            </p>
          </CardContent>
        </Card>
        <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
          <CardContent className="flex flex-col gap-y-1 p-4">
            <p className="dark:text-polar-400 text-xs text-gray-500">
              Pending Out
            </p>
            <p className="text-lg font-medium dark:text-white text-gray-900">
              {formatCurrency(financialAccount.balance_outbound_pending)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
        <CardContent className="p-0">
          {txLoading && (
            <div className="flex flex-col gap-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="dark:border-polar-700 flex items-center justify-between border-b border-gray-100 px-6 py-4 last:border-b-0"
                >
                  <div className="dark:bg-polar-700 h-5 w-40 animate-pulse rounded bg-gray-100" />
                  <div className="dark:bg-polar-700 h-5 w-20 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {!txLoading && transactions.length === 0 && (
            <div className="flex flex-col items-center gap-y-2 py-12 text-center">
              <p className="dark:text-polar-400 text-sm text-gray-500">
                No transactions yet. Transactions will appear here once funds
                start flowing through your account.
              </p>
            </div>
          )}

          {!txLoading && transactions.length > 0 && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="dark:border-polar-700 dark:bg-polar-900 flex items-center border-b border-gray-100 bg-gray-50 px-6 py-3">
                <div className="flex-1 text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
                  Description
                </div>
                <div className="w-32 text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
                  Type
                </div>
                <div className="w-24 text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
                  Status
                </div>
                <div className="w-32 text-right text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
                  Amount
                </div>
                <div className="w-40 text-right text-xs font-medium uppercase tracking-wider dark:text-polar-400 text-gray-500">
                  Date
                </div>
              </div>

              {/* Rows */}
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="dark:border-polar-700 dark:hover:bg-polar-900/50 flex items-center border-b border-gray-100 px-6 py-4 transition-colors last:border-b-0 hover:bg-gray-50"
                >
                  <div className="flex flex-1 flex-col gap-y-0.5">
                    <p className="text-sm font-medium dark:text-white text-gray-900">
                      {tx.description || 'Transaction'}
                    </p>
                    {tx.counterparty_name && (
                      <p className="dark:text-polar-500 text-xs text-gray-400">
                        {tx.counterparty_name}
                      </p>
                    )}
                  </div>
                  <div className="w-32">
                    <span className="dark:text-polar-300 text-xs capitalize text-gray-600">
                      {getTransactionTypeLabel(tx.transaction_type)}
                    </span>
                  </div>
                  <div className="w-24">{getStatusBadge(tx.status)}</div>
                  <div className="w-32 text-right">
                    <span
                      className={`text-sm font-medium ${
                        tx.amount >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className="w-40 text-right">
                    <span className="dark:text-polar-400 text-xs text-gray-500">
                      {formatDate(tx.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {maxPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="dark:text-polar-400 text-sm text-gray-500">
            Page {page} of {maxPage}
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
