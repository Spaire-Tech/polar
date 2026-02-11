'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'

export default function CardsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Issued Cards
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Manage your virtual and physical cards. Create new cards, set
            spending limits, and view transaction details.
          </p>
        </div>

        <StripeConnectProvider organizationId={organization.id}>
          <ShadowBoxOnMd>
            <div className="p-6">
              <h3 className="dark:text-white mb-4 text-lg font-semibold text-gray-900">
                Card Management
              </h3>
              {/*
                Stripe Connect embedded component: <ConnectIssuingCardsList />
                Shows list of all issued cards with management capabilities.

                import { ConnectIssuingCardsList } from '@stripe/react-connect-js'
                <ConnectIssuingCardsList />

                For individual card view:
                import { ConnectIssuingCard } from '@stripe/react-connect-js'
                <ConnectIssuingCard card={cardId} />
              */}
              <div className="dark:border-polar-700 dark:bg-polar-900 flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Stripe Issuing Cards List component will render here.
                  Requires active Stripe Issuing program access.
                </p>
              </div>
            </div>
          </ShadowBoxOnMd>
        </StripeConnectProvider>
      </div>
    </DashboardBody>
  )
}
