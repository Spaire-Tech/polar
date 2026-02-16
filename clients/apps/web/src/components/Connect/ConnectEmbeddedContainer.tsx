'use client'

import {
  ConnectSessionScenario,
  useCreateConnectSession,
} from '@/hooks/queries/connect'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { ConnectComponentsProvider } from '@stripe/react-connect-js'
import React, { useCallback, useMemo, useState } from 'react'

interface ConnectEmbeddedContainerProps {
  accountId: string
  scenario: ConnectSessionScenario
  children: React.ReactNode
  onError?: (error: Error) => void
}

/**
 * Container that initializes a Stripe Connect embedded component instance.
 *
 * It creates an Account Session via the backend, then initializes ConnectJS
 * with the returned client_secret. The ConnectJS instance is provided to
 * children via ConnectComponentsProvider.
 *
 * If session creation or initialization fails, it calls onError so the parent
 * can fall back to hosted flows.
 */
const ConnectEmbeddedContainer: React.FC<ConnectEmbeddedContainerProps> = ({
  accountId,
  scenario,
  children,
  onError,
}) => {
  const createConnectSession = useCreateConnectSession()
  const [initError, setInitError] = useState<Error | null>(null)

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const session = await createConnectSession.mutateAsync({
      accountId,
      scenario,
    })
    return session.client_secret
  }, [accountId, scenario, createConnectSession])

  const connectInstance = useMemo(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_KEY || ''
    if (!publishableKey) {
      const err = new Error('Stripe publishable key is not configured')
      setInitError(err)
      onError?.(err)
      return null
    }

    try {
      return loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
      })
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to initialize Connect')
      setInitError(error)
      onError?.(error)
      return null
    }
  }, [fetchClientSecret, onError])

  if (initError || !connectInstance) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-gray-500">
        Failed to load embedded component. Please try again.
      </div>
    )
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      {children}
    </ConnectComponentsProvider>
  )
}

export default ConnectEmbeddedContainer
