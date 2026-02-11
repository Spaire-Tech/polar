'use client'

import FundStateBreakdown from '@/components/Finance/Embedded/FundStateBreakdown'
import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
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

export default function BalancesPage({
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
    <div className="flex flex-col gap-y-8">
      {fa ? (
        <>
          <div className="flex flex-col gap-8 md:flex-row">
            <ShadowBoxOnMd className="flex-1">
              <div className="flex flex-col gap-y-2 p-6">
                <h2 className="text-lg font-medium">Cash Balance</h2>
                <div className="text-4xl">
                  {formatCents(fa.balance?.cash ?? 0)}
                </div>
              </div>
            </ShadowBoxOnMd>
            <ShadowBoxOnMd className="flex-1">
              <div className="flex flex-col gap-y-2 p-6">
                <h2 className="text-lg font-medium">Effective Balance</h2>
                <div className="text-4xl">
                  {formatCents(fa.balance?.effective ?? 0)}
                </div>
              </div>
            </ShadowBoxOnMd>
          </div>

          <ShadowBoxOnMd>
            <div className="flex flex-col gap-y-4 p-6">
              <h2 className="text-lg font-medium">Pending</h2>
              <div className="flex flex-col gap-4 md:flex-row md:gap-16">
                <div>
                  <p className="dark:text-polar-400 text-sm text-gray-400">
                    Inbound
                  </p>
                  <p className="text-xl font-medium">
                    {formatCents(fa.balance?.inbound_pending ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="dark:text-polar-400 text-sm text-gray-400">
                    Outbound
                  </p>
                  <p className="text-xl font-medium">
                    {formatCents(fa.balance?.outbound_pending ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </ShadowBoxOnMd>

          {fa.aba_routing_number && (
            <ShadowBoxOnMd>
              <div className="flex flex-col gap-y-4 p-6">
                <h2 className="text-lg font-medium">Banking Details</h2>
                <div className="flex flex-col gap-4 md:flex-row md:gap-16">
                  <div>
                    <p className="dark:text-polar-400 text-sm text-gray-400">
                      ABA Routing
                    </p>
                    <p className="font-mono text-sm">
                      {fa.aba_routing_number}
                    </p>
                  </div>
                  <div>
                    <p className="dark:text-polar-400 text-sm text-gray-400">
                      Account Number
                    </p>
                    <p className="font-mono text-sm">
                      ****{fa.aba_account_number_last4}
                    </p>
                  </div>
                  <div>
                    <p className="dark:text-polar-400 text-sm text-gray-400">
                      Status
                    </p>
                    <p className="text-sm">
                      {fa.status === 'open' ? 'Active' : fa.status}
                    </p>
                  </div>
                </div>
              </div>
            </ShadowBoxOnMd>
          )}
        </>
      ) : (
        <ShadowBoxOnMd>
          <div className="flex flex-col gap-y-2 p-6">
            <h2 className="text-lg font-medium">Financial Account</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              No financial account provisioned yet. Complete account setup to
              enable banking features.
            </p>
          </div>
        </ShadowBoxOnMd>
      )}

      <FundStateBreakdown organizationId={organization.id} />

      {fa && (
        <StripeConnectProvider organizationId={organization.id}>
          <ShadowBoxOnMd>
            <div className="flex flex-col gap-y-4 p-6">
              <h2 className="text-lg font-medium">Transaction History</h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Powered by Stripe Connect. Requires active Treasury program
                access.
              </p>
            </div>
          </ShadowBoxOnMd>
        </StripeConnectProvider>
      )}
    </div>
  )
}
