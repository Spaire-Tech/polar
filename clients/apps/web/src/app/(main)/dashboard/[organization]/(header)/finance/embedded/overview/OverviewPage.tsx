'use client'

import FundStateBreakdown from '@/components/Finance/Embedded/FundStateBreakdown'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { useQuery } from '@tanstack/react-query'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export default function OverviewPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
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

  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Embedded Finance
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Manage your business finances — balances, cards, and payments.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fund State Breakdown */}
          <FundStateBreakdown organizationId={organization.id} />

          {/* Financial Account Summary */}
          <ShadowBoxOnMd>
            <div className="space-y-4 p-6">
              <h3 className="dark:text-white text-lg font-semibold text-gray-900">
                Financial Account
              </h3>
              {fa ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Cash Balance
                      </p>
                      <p className="dark:text-white text-lg font-semibold text-gray-900">
                        {formatCents(fa.balance?.cash ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Effective Balance
                      </p>
                      <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCents(fa.balance?.effective ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Inbound Pending
                      </p>
                      <p className="dark:text-white text-sm font-medium text-gray-900">
                        {formatCents(fa.balance?.inbound_pending ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        Outbound Pending
                      </p>
                      <p className="dark:text-white text-sm font-medium text-gray-900">
                        {formatCents(fa.balance?.outbound_pending ?? 0)}
                      </p>
                    </div>
                  </div>
                  {fa.aba_routing_number && (
                    <div className="dark:border-polar-700 mt-2 rounded-lg border border-gray-200 p-3">
                      <p className="dark:text-polar-400 text-xs text-gray-500">
                        ABA Routing
                      </p>
                      <p className="dark:text-white font-mono text-sm text-gray-900">
                        {fa.aba_routing_number} ****{fa.aba_account_number_last4}
                      </p>
                    </div>
                  )}
                  <p className="dark:text-polar-500 text-xs text-gray-400">
                    Status: {fa.status}
                  </p>
                </>
              ) : (
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  No Financial Account provisioned yet. Create one to hold
                  operating cash and enable card issuing.
                </p>
              )}
            </div>
          </ShadowBoxOnMd>
        </div>
      </div>
    </DashboardBody>
  )
}
