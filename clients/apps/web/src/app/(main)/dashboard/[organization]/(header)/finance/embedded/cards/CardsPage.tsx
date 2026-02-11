'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { ConnectIssuingCardsList } from '@stripe/react-connect-js'
import { useQuery } from '@tanstack/react-query'

export default function CardsPage({
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
  const isActive = fa?.status === 'open'

  return (
    <div className="flex flex-col gap-y-8">
      <ShadowBoxOnMd>
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium">Cards</h2>
              {isActive && <Pill color="green">Active</Pill>}
            </div>
            {isActive && (
              <Button variant="secondary" size="sm">
                Issue Card
              </Button>
            )}
          </div>
          {!isActive && (
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Complete account setup to issue virtual and physical cards.
            </p>
          )}
        </div>
      </ShadowBoxOnMd>

      {isActive && (
        <StripeConnectProvider organizationId={organization.id}>
          <ConnectIssuingCardsList showSpendControls={true} />
        </StripeConnectProvider>
      )}
    </div>
  )
}
