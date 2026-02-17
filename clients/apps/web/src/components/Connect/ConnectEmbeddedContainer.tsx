'use client'

import {
  ConnectSessionScenario,
  useCreateConnectSession,
} from '@/hooks/queries/connect'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { ConnectComponentsProvider } from '@stripe/react-connect-js'
import React, { useEffect, useRef, useState } from 'react'

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
  const [connectInstance, setConnectInstance] = useState<ReturnType<
    typeof loadConnectAndInitialize
  > | null>(null)

  // Use refs to avoid dependency changes on every render
  const mutateAsyncRef = useRef(createConnectSession.mutateAsync)
  mutateAsyncRef.current = createConnectSession.mutateAsync
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_KEY || ''
    if (!publishableKey) {
      const err = new Error('Stripe publishable key is not configured')
      setInitError(err)
      onErrorRef.current?.(err)
      return
    }

    try {
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          try {
            const session = await mutateAsyncRef.current({
              accountId,
              scenario,
            })
            return session.client_secret
          } catch (err) {
            // Propagate fetchClientSecret failures to the parent so it can
            // fall back to hosted flows (e.g. when the backend endpoint 404s)
            const error =
              err instanceof Error
                ? err
                : new Error('Failed to create connect session')
            setInitError(error)
            onErrorRef.current?.(error)
            throw error
          }
        },
      })
      setConnectInstance(instance)
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to initialize Connect')
      setInitError(error)
      onErrorRef.current?.(error)
    }
  }, [accountId, scenario])

  if (initError) {
    return null // Parent handles fallback UI via onError callback
  }

  if (!connectInstance) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="dark:border-polar-600 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
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
