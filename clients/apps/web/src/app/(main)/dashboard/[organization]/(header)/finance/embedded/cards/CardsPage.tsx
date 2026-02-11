'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'

export default function CardsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <div className="flex flex-col gap-y-8">
      <StripeConnectProvider organizationId={organization.id}>
        <ShadowBoxOnMd>
          <div className="flex flex-col gap-y-4 p-6">
            <div className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-medium">Issued Cards</h2>
            </div>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Manage virtual and physical cards. Create new cards, set spending
              limits, and view transaction details.
            </p>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Requires active Stripe Issuing program access.
            </p>
          </div>
        </ShadowBoxOnMd>
      </StripeConnectProvider>
    </div>
  )
}
