'use client'

import { toast } from '@/components/Toast/use-toast'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ConnectPayouts } from '@stripe/react-connect-js'
import React, { useCallback, useState } from 'react'
import ConnectEmbeddedContainer from './ConnectEmbeddedContainer'

interface EmbeddedPayoutsProps {
  account: schemas['Account']
  onError?: () => void
}

/**
 * Renders Stripe's embedded ConnectPayouts component inside
 * a ConnectEmbeddedContainer. Falls back to hosted Express Dashboard
 * if the embedded component fails to initialize.
 */
const EmbeddedPayouts: React.FC<EmbeddedPayoutsProps> = ({
  account,
  onError,
}) => {
  const [fallbackToHosted, setFallbackToHosted] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const handleError = useCallback(() => {
    setFallbackToHosted(true)
    onError?.()
  }, [onError])

  const handleHostedFallback = useCallback(async () => {
    setRedirecting(true)
    try {
      const link = await unwrap(
        api.POST('/v1/accounts/{id}/dashboard_link', {
          params: {
            path: { id: account.id },
          },
        }),
      )
      window.location.href = link.url
    } catch {
      setRedirecting(false)
      toast({
        title: 'Error',
        description: 'Failed to open dashboard. Please try again.',
      })
    }
  }, [account.id])

  if (fallbackToHosted) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p className="text-sm text-gray-500">
          Embedded payouts view is unavailable. You can manage payouts on
          Stripe&apos;s hosted dashboard.
        </p>
        <Button onClick={handleHostedFallback} loading={redirecting}>
          Open Stripe Dashboard
        </Button>
      </div>
    )
  }

  return (
    <ConnectEmbeddedContainer
      accountId={account.id}
      scenario="payouts"
      onError={handleError}
    >
      <ConnectPayouts />
    </ConnectEmbeddedContainer>
  )
}

export default EmbeddedPayouts
