'use client'

import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { ArrowRight, Building2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import React, { useCallback, useState } from 'react'

interface AccountStepProps {
  organizationAccount?: schemas['Account']
  isNotAdmin: boolean
  onStartAccountSetup: () => void
  onSkipAccountSetup?: () => void
  onCheckStatus?: () => Promise<void>
}

export default function AccountStep({
  organizationAccount,
  isNotAdmin,
  onStartAccountSetup,
  onSkipAccountSetup,
  onCheckStatus,
}: AccountStepProps) {
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckStatus = useCallback(async () => {
    if (!onCheckStatus || isChecking) return
    setIsChecking(true)
    try {
      await onCheckStatus()
    } finally {
      setIsChecking(false)
    }
  }, [onCheckStatus, isChecking])

  const isAccountSetupComplete =
    organizationAccount?.stripe_id !== null &&
    organizationAccount?.is_details_submitted &&
    organizationAccount?.is_charges_enabled &&
    organizationAccount?.is_payouts_enabled

  const isStripeReviewing =
    !!organizationAccount?.stripe_id &&
    !!organizationAccount?.is_details_submitted &&
    !organizationAccount?.is_payouts_enabled

  if (isAccountSetupComplete) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
          <Building2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">
            Payout account connected
          </h3>
          <p className="dark:text-spaire-400 mt-1 text-sm text-gray-500">
            Your account is configured and ready to receive payouts.
          </p>
        </div>
      </div>
    )
  }

  if (isStripeReviewing) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">
            Reviewing your information
          </h3>
          <p className="dark:text-spaire-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Stripe is verifying your account details. This can take a few
            minutes to a few hours. You&apos;ll be automatically moved to the
            next step once complete.
          </p>
        </div>
        {onCheckStatus && (
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="dark:text-spaire-400 mt-2 inline-flex items-center gap-2 text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check status now'}
          </button>
        )}
      </div>
    )
  }

  if (isNotAdmin) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">Admin required</h3>
          <p className="dark:text-spaire-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Only the account admin can connect a payout account. You can skip
            this step and continue with identity verification.
          </p>
        </div>
        {onSkipAccountSetup && (
          <Button onClick={onSkipAccountSetup} className="mt-2">
            Skip & Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
        <Building2 className="h-6 w-6 text-blue-500" />
      </div>
      <div>
        <h3 className="font-medium dark:text-white">
          Connect your payout account
        </h3>
        <p className="dark:text-spaire-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
          Connect your bank account so Spaire can send you your earnings.
          You&apos;ll be redirected to Stripe to complete this step.
        </p>
      </div>
      <Button onClick={onStartAccountSetup} className="mt-2">
        Connect Account
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
