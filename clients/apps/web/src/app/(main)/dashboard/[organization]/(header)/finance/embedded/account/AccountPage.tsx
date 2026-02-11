'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export default function AccountPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()

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

  const handleOnboardingExit = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="flex flex-col gap-y-8">
      <ShadowBoxOnMd>
        <div className="flex flex-col gap-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Account</h2>
            {isActive ? (
              <Pill color="green">Active</Pill>
            ) : (
              <Pill color="blue">Setup required</Pill>
            )}
          </div>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {isActive
              ? 'Your account is active. Manage your business details, identity verification, and banking settings below.'
              : 'Complete the steps below to activate banking, cards, and payment features.'}
          </p>
        </div>
      </ShadowBoxOnMd>

      <StripeConnectProvider organizationId={organization.id}>
        {isActive ? (
          <ConnectAccountManagement />
        ) : (
          <ConnectAccountOnboarding onExit={handleOnboardingExit} />
        )}
      </StripeConnectProvider>
    </div>
  )
}
