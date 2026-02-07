'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateFinancialAccount,
  useOnboardingLink,
  useOnboardingStatus,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

type Step = 'intro' | 'creating' | 'kyc' | 'complete'

export default function OnboardingPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intro')
  const [error, setError] = useState<string | null>(null)

  const createFA = useCreateFinancialAccount()
  const getOnboardingLink = useOnboardingLink()
  const { data: onboardingStatus, refetch: refetchStatus } =
    useOnboardingStatus(organization.id)

  const handleCreateAccount = useCallback(async () => {
    setStep('creating')
    setError(null)
    try {
      await createFA.mutateAsync(organization.id)
      setStep('kyc')
    } catch (err: unknown) {
      const e = err as { detail?: string }
      if (e?.detail?.includes('already exists')) {
        setStep('kyc')
      } else {
        setError(e?.detail || 'Something went wrong. Please try again.')
        setStep('intro')
      }
    }
  }, [createFA, organization.id])

  const handleStartKYC = useCallback(async () => {
    try {
      const result = await getOnboardingLink.mutateAsync({
        organizationId: organization.id,
        returnPath: `/dashboard/${organization.slug}/business-wallet/onboarding`,
      })
      if (result?.url) {
        window.location.href = result.url
      }
    } catch (err: unknown) {
      const e = err as { detail?: string }
      setError(e?.detail || 'Could not generate verification link.')
    }
  }, [getOnboardingLink, organization])

  const handleCheckStatus = useCallback(async () => {
    await refetchStatus()
    if (onboardingStatus?.is_fully_onboarded) {
      setStep('complete')
    }
  }, [refetchStatus, onboardingStatus])

  if (onboardingStatus?.is_fully_onboarded) {
    return (
      <DashboardBody>
        <div className="flex flex-col items-center gap-y-6 py-24 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-y-1">
            <h3 className="text-lg font-medium dark:text-white text-gray-900">
              Your account is ready
            </h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              You can now receive payments and issue cards.
            </p>
          </div>
          <Button
            onClick={() =>
              router.push(
                `/dashboard/${organization.slug}/business-wallet/overview`,
              )
            }
          >
            Go to Business Wallet
          </Button>
        </div>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div className="mx-auto flex max-w-lg flex-col gap-y-10 py-8">
        {/* Progress */}
        <div className="flex gap-x-2">
          {['Account', 'Verification', 'Done'].map((label, index) => {
            const stepMap: Step[] = ['intro', 'kyc', 'complete']
            const currentIndex = stepMap.indexOf(
              step === 'creating' ? 'intro' : step,
            )
            const isActive = index <= currentIndex
            return (
              <div key={label} className="flex flex-1 flex-col gap-y-2">
                <div
                  className={`h-0.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-blue-500'
                      : 'dark:bg-polar-700 bg-gray-200'
                  }`}
                />
                <p
                  className={`text-xs transition-colors ${
                    isActive
                      ? 'font-medium dark:text-white text-gray-900'
                      : 'dark:text-polar-500 text-gray-400'
                  }`}
                >
                  {label}
                </p>
              </div>
            )
          })}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Intro */}
        {(step === 'intro' || step === 'creating') && (
          <div className="flex flex-col gap-y-8">
            <div className="flex flex-col gap-y-3">
              <h2 className="text-2xl font-medium dark:text-white text-gray-900">
                Open a Business Account
              </h2>
              <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
                A dedicated account for your business. Receive payments from
                customers directly, issue cards to spend your balance instantly,
                and send transfers when you need to. FDIC insured up to $250,000.
              </p>
            </div>

            <div className="dark:bg-polar-800 dark:border-polar-700 grid grid-cols-2 gap-6 rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex flex-col gap-y-1">
                <p className="text-sm font-medium dark:text-white text-gray-900">
                  Instant access
                </p>
                <p className="dark:text-polar-400 text-xs text-gray-500">
                  Spend your revenue the moment it arrives
                </p>
              </div>
              <div className="flex flex-col gap-y-1">
                <p className="text-sm font-medium dark:text-white text-gray-900">
                  Issue cards
                </p>
                <p className="dark:text-polar-400 text-xs text-gray-500">
                  Virtual and physical Visa cards
                </p>
              </div>
              <div className="flex flex-col gap-y-1">
                <p className="text-sm font-medium dark:text-white text-gray-900">
                  FDIC insured
                </p>
                <p className="dark:text-polar-400 text-xs text-gray-500">
                  Deposits protected up to $250,000
                </p>
              </div>
              <div className="flex flex-col gap-y-1">
                <p className="text-sm font-medium dark:text-white text-gray-900">
                  Send transfers
                </p>
                <p className="dark:text-polar-400 text-xs text-gray-500">
                  ACH and wire to any US bank account
                </p>
              </div>
            </div>

            <Button
              onClick={handleCreateAccount}
              loading={step === 'creating'}
              disabled={step === 'creating'}
            >
              {step === 'creating' ? 'Setting up...' : 'Continue'}
            </Button>
          </div>
        )}

        {/* KYC */}
        {step === 'kyc' && (
          <div className="flex flex-col gap-y-8">
            <div className="flex flex-col gap-y-3">
              <h2 className="text-2xl font-medium dark:text-white text-gray-900">
                Verify your identity
              </h2>
              <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
                To comply with financial regulations, we need to verify your
                identity and business information. You will be redirected to a
                secure form to complete this step.
              </p>
            </div>

            {onboardingStatus?.requirements_pending &&
              onboardingStatus.requirements_pending.length > 0 && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-400">
                    Pending
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    {onboardingStatus.requirements_pending
                      .map((r: string) => r.replace(/_/g, ' ').replace(/\./g, ' > '))
                      .join(', ')}
                  </p>
                </div>
              )}

            <div className="flex gap-x-3">
              <Button
                onClick={handleStartKYC}
                loading={getOnboardingLink.isPending}
              >
                Continue Verification
              </Button>
              <Button variant="ghost" onClick={handleCheckStatus}>
                I already did this
              </Button>
            </div>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="flex flex-col items-center gap-y-6 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="text-lg font-medium dark:text-white text-gray-900">
                All set
              </h3>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                Your account is active. Start issuing cards and receiving
                payments.
              </p>
            </div>
            <Button
              onClick={() =>
                router.push(
                  `/dashboard/${organization.slug}/business-wallet/overview`,
                )
              }
            >
              Go to Business Wallet
            </Button>
          </div>
        )}
      </div>
    </DashboardBody>
  )
}
