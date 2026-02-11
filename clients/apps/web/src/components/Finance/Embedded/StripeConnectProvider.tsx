'use client'

import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import {
  ConnectComponentsProvider,
  ConnectNotificationBanner,
} from '@stripe/connect-js/react'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import React, { useMemo } from 'react'

interface StripeConnectProviderProps {
  organizationId: string
  children: React.ReactNode
}

export default function StripeConnectProvider({
  organizationId,
  children,
}: StripeConnectProviderProps) {
  const stripeConnectInstance = useMemo(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_KEY

    if (!publishableKey) {
      return null
    }

    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const result = await unwrap(
          api.POST(
            '/v1/treasury/organizations/{organization_id}/account-session' as any,
            {
              params: { path: { organization_id: organizationId } },
            },
          ),
        )
        return (result as any).client_secret
      },
      appearance: {
        overlays: 'dialog',
        variables: {
          colorPrimary: '#0062FF',
          colorBackground: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '8px',
        },
      },
    })
  }, [organizationId])

  if (!stripeConnectInstance) {
    return (
      <div className="dark:text-polar-400 p-4 text-gray-500">
        Stripe Connect is not configured. Set NEXT_PUBLIC_STRIPE_KEY.
      </div>
    )
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <ConnectNotificationBanner />
      {children}
    </ConnectComponentsProvider>
  )
}
