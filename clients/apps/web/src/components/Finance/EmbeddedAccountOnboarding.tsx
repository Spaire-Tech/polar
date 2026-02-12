'use client'

import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from '@stripe/react-connect-js'
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from '@stripe/connect-js'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface EmbeddedAccountOnboardingProps {
  account: schemas['Account']
  onOnboardingComplete: () => void
}

export default function EmbeddedAccountOnboarding({
  account,
  onOnboardingComplete,
}: EmbeddedAccountOnboardingProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [error, setError] = useState<string | null>(null)
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)

  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await api.POST(
      '/v1/accounts/{id}/account_session',
      {
        params: { path: { id: account.id } },
      },
    )

    if (error || !data) {
      setError('Failed to initialize onboarding. Please try again.')
      return ''
    }

    return data.client_secret
  }, [account.id])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      try {
        const instance = loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_KEY || '',
          fetchClientSecret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#3381FF',
              colorBackground: isDark ? '#171719' : '#FFFFFF',
              colorText: isDark ? '#E5E5E1' : '#181A1F',
              colorDanger: isDark ? '#F17878' : '#E64D4D',
              colorSecondaryText: isDark ? '#767678' : '#6C7080',
              colorBorder: isDark ? '#242629' : '#EEEEEE',
              formBackgroundColor: isDark ? '#171719' : '#FFFFFF',
              formHighlightColorBorder: isDark
                ? 'rgb(0, 84, 219)'
                : 'rgb(102, 161, 255)',
              formAccentColor: '#3381FF',
              buttonPrimaryColorBackground: '#3381FF',
              buttonPrimaryColorText: '#FFFFFF',
              buttonPrimaryColorBorder: '#3381FF',
              actionPrimaryColorText: '#3381FF',
              actionSecondaryColorText: isDark ? '#E5E5E1' : '#181A1F',
              badgeNeutralColorBackground: isDark ? '#242629' : '#F5F5F5',
              badgeNeutralColorText: isDark ? '#E5E5E1' : '#181A1F',
              badgeNeutralColorBorder: isDark ? '#353641' : '#EEEEEE',
              offsetBackgroundColor: isDark ? '#111113' : '#FAFBFC',
              fontFamily:
                '"Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSizeBase: '16px',
              spacingUnit: '12px',
              borderRadius: '12px',
            },
          },
        })
        setConnectInstance(instance)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load Stripe Connect:', err)
        setError(
          'Failed to load the onboarding form. Please refresh and try again.',
        )
        setLoading(false)
      }
    }

    init()
  }, [fetchClientSecret, isDark])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setLoading(true)
            initRef.current = false
          }}
          className="text-sm text-blue-500 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (loading || !connectInstance) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Loading onboarding form...
        </p>
      </div>
    )
  }

  return (
    <div className="embedded-onboarding-container">
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          onExit={() => {
            onOnboardingComplete()
          }}
        />
      </ConnectComponentsProvider>
    </div>
  )
}
