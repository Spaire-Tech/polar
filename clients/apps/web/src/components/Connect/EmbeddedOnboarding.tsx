'use client'

import { toast } from '@/components/Toast/use-toast'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ConnectAccountOnboarding } from '@stripe/react-connect-js'
import React, { useCallback, useState } from 'react'
import ConnectEmbeddedContainer from './ConnectEmbeddedContainer'

interface EmbeddedOnboardingProps {
  account: schemas['Account']
  organization: schemas['Organization']
  onComplete?: () => void
}

/**
 * Renders Stripe's embedded ConnectAccountOnboarding component inside
 * a ConnectEmbeddedContainer. Falls back to hosted onboarding link
 * if the embedded component fails to initialize.
 */
const EmbeddedOnboarding: React.FC<EmbeddedOnboardingProps> = ({
  account,
  organization,
  onComplete,
}) => {
  const [fallbackToHosted, setFallbackToHosted] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const handleExit = useCallback(() => {
    onComplete?.()
  }, [onComplete])

  const handleError = useCallback(() => {
    setFallbackToHosted(true)
  }, [])

  const handleHostedFallback = useCallback(async () => {
    setRedirecting(true)
    try {
      const link = await unwrap(
        api.POST('/v1/accounts/{id}/onboarding_link', {
          params: {
            path: { id: account.id },
            query: {
              return_path: `/dashboard/${organization.slug}/finance/account`,
            },
          },
        }),
      )
      window.location.href = link.url
    } catch {
      setRedirecting(false)
      toast({
        title: 'Error',
        description: 'Failed to create onboarding link. Please try again.',
      })
    }
  }, [account.id, organization.slug])

  if (fallbackToHosted) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p className="text-sm text-gray-500">
          Embedded onboarding is unavailable. You can continue setup on
          Stripe&apos;s hosted page.
        </p>
        <Button onClick={handleHostedFallback} loading={redirecting}>
          Continue on Stripe
        </Button>
      </div>
    )
  }

  return (
    <ConnectEmbeddedContainer
      accountId={account.id}
      scenario="onboarding"
      onError={handleError}
    >
      <ConnectAccountOnboarding onExit={handleExit} />
    </ConnectEmbeddedContainer>
  )
}

export default EmbeddedOnboarding
