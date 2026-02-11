'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'

export default function AccountsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Financial Account
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Your FDIC pass-through eligible business balance account. View
            balances, account details, and transaction history.
          </p>
        </div>

        <StripeConnectProvider organizationId={organization.id}>
          <div className="space-y-6">
            {/* Financial Account Details */}
            <ShadowBoxOnMd>
              <div className="p-6">
                <h3 className="dark:text-white mb-4 text-lg font-semibold text-gray-900">
                  Account Details
                </h3>
                {/*
                  Stripe Connect embedded component: <ConnectFinancialAccount />
                  Shows balance, ABA routing info, external account management.

                  Note: The actual embedded component requires @stripe/connect-js
                  react bindings. Import and render:

                  import { ConnectFinancialAccount } from '@stripe/connect-js/react'
                  <ConnectFinancialAccount financialAccount={faId} />
                */}
                <div className="dark:border-polar-700 dark:bg-polar-900 flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  <p className="dark:text-polar-400 text-sm text-gray-500">
                    Stripe Financial Account component will render here.
                    Requires active Stripe Treasury program access.
                  </p>
                </div>
              </div>
            </ShadowBoxOnMd>

            {/* Transaction History */}
            <ShadowBoxOnMd>
              <div className="p-6">
                <h3 className="dark:text-white mb-4 text-lg font-semibold text-gray-900">
                  Transaction History
                </h3>
                {/*
                  Stripe Connect embedded component: <ConnectFinancialAccountTransactions />
                  Shows detailed transaction history for the Financial Account.

                  import { ConnectFinancialAccountTransactions } from '@stripe/connect-js/react'
                  <ConnectFinancialAccountTransactions financialAccount={faId} />
                */}
                <div className="dark:border-polar-700 dark:bg-polar-900 flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  <p className="dark:text-polar-400 text-sm text-gray-500">
                    Stripe Financial Account Transactions component will render
                    here. Requires active Stripe Treasury program access.
                  </p>
                </div>
              </div>
            </ShadowBoxOnMd>
          </div>
        </StripeConnectProvider>
      </div>
    </DashboardBody>
  )
}
