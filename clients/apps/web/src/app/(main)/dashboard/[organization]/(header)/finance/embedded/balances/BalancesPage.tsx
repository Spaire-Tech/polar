'use client'

import FinanceBalanceBuckets from '@/components/Finance/Embedded/FinanceBalanceBuckets'
import FundStateBreakdown from '@/components/Finance/Embedded/FundStateBreakdown'
import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, Landmark } from 'lucide-react'
import { useState } from 'react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export default function BalancesPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [copied, setCopied] = useState(false)

  const { data: financialAccount } = useQuery({
    queryKey: ['financial-account', organization.id],
    queryFn: () =>
      unwrap(
        api.GET(
          '/v1/treasury/organizations/{organization_id}/financial-account' as any,
          {
            params: { path: { organization_id: organization.id } },
          },
        ),
      ),
    enabled: !!organization.id,
    retry: false,
  })

  const fa = financialAccount as any

  const handleCopyRouting = () => {
    if (fa?.aba_routing_number) {
      navigator.clipboard.writeText(fa.aba_routing_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Balances
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Your money at a glance — clearing, available, held, and spendable
            funds.
          </p>
        </div>

        {/* Balance Buckets */}
        <FinanceBalanceBuckets organizationId={organization.id} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fund State Breakdown (detailed) */}
          <FundStateBreakdown organizationId={organization.id} />

          {/* Financial Account Details */}
          <ShadowBoxOnMd>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="dark:text-white text-sm font-semibold text-gray-900">
                  Account Details
                </h3>
                {fa?.status && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      fa.status === 'open'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                    }`}
                  >
                    {fa.status === 'open' ? 'Active' : fa.status}
                  </span>
                )}
              </div>

              {fa ? (
                <div className="space-y-4">
                  {/* Balance Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-3">
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Cash Balance
                      </p>
                      <p className="dark:text-white mt-1 text-lg font-semibold text-gray-900">
                        {formatCents(fa.balance?.cash ?? 0)}
                      </p>
                    </div>
                    <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-3">
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Effective Balance
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCents(fa.balance?.effective ?? 0)}
                      </p>
                    </div>
                    <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-3">
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Inbound Pending
                      </p>
                      <p className="dark:text-white mt-1 text-sm font-medium text-gray-900">
                        {formatCents(fa.balance?.inbound_pending ?? 0)}
                      </p>
                    </div>
                    <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-3">
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Outbound Pending
                      </p>
                      <p className="dark:text-white mt-1 text-sm font-medium text-gray-900">
                        {formatCents(fa.balance?.outbound_pending ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Banking Details */}
                  {fa.aba_routing_number && (
                    <div className="dark:border-polar-700 rounded-lg border border-gray-200 p-4">
                      <p className="dark:text-polar-400 mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                        Banking Details
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="dark:text-polar-400 text-xs text-gray-500">
                            ABA Routing
                          </p>
                          <p className="dark:text-white font-mono text-sm text-gray-900">
                            {fa.aba_routing_number}
                          </p>
                        </div>
                        <div>
                          <p className="dark:text-polar-400 text-xs text-gray-500">
                            Account
                          </p>
                          <p className="dark:text-white font-mono text-sm text-gray-900">
                            ****{fa.aba_account_number_last4}
                          </p>
                        </div>
                        <button
                          onClick={handleCopyRouting}
                          className="dark:text-polar-400 dark:hover:text-polar-300 rounded p-1.5 text-gray-400 transition-colors hover:text-gray-600"
                        >
                          {copied ? (
                            <span className="text-xs text-emerald-500">
                              Copied
                            </span>
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="dark:border-polar-700 flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-200">
                  <div className="text-center">
                    <Landmark className="dark:text-polar-500 mx-auto h-8 w-8 text-gray-300" />
                    <p className="dark:text-polar-400 mt-2 text-sm text-gray-500">
                      No financial account provisioned yet
                    </p>
                    <p className="dark:text-polar-500 mt-1 text-xs text-gray-400">
                      Complete account setup to enable banking features
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ShadowBoxOnMd>
        </div>

        {/* Stripe Embedded Financial Account (if available) */}
        {fa && (
          <ShadowBoxOnMd>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="dark:text-white text-sm font-semibold text-gray-900">
                  Transaction History
                </h3>
                <ExternalLink className="dark:text-polar-500 h-4 w-4 text-gray-400" />
              </div>
              <StripeConnectProvider organizationId={organization.id}>
                <div className="dark:border-polar-700 mt-4 flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200">
                  <div className="text-center">
                    <p className="dark:text-polar-400 text-sm text-gray-500">
                      Transaction history powered by Stripe Connect
                    </p>
                    <p className="dark:text-polar-500 mt-1 text-xs text-gray-400">
                      Requires active Stripe Treasury program access
                    </p>
                  </div>
                </div>
              </StripeConnectProvider>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>
    </DashboardBody>
  )
}
