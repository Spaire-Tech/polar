'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateFinancialAccount,
  useOnboardingLink,
  useOnboardingStatus,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardContent,
} from '@polar-sh/ui/components/atoms/Card'
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
    } catch (err: any) {
      if (err?.detail?.includes('already exists')) {
        setStep('kyc')
      } else {
        setError(
          err?.detail ||
            'Failed to create financial account. Please try again.',
        )
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
    } catch (err: any) {
      setError(
        err?.detail || 'Failed to generate onboarding link. Please try again.',
      )
    }
  }, [getOnboardingLink, organization])

  const handleCheckStatus = useCallback(async () => {
    await refetchStatus()
    if (onboardingStatus?.is_fully_onboarded) {
      setStep('complete')
    }
  }, [refetchStatus, onboardingStatus])

  // If already onboarded, redirect to overview
  if (onboardingStatus?.is_fully_onboarded) {
    return (
      <DashboardBody>
        <div className="flex flex-col gap-y-8">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Open a Financial Business Account
          </h2>
          <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
            <CardContent className="flex flex-col items-center gap-y-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                <svg
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-y-2">
                <h3 className="text-xl font-medium dark:text-white text-gray-900">
                  Your account is ready
                </h3>
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Your Financial Business Account is fully set up and active.
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
            </CardContent>
          </Card>
        </div>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <h2 className="text-lg font-medium dark:text-white text-gray-900">
          Open a Financial Business Account
        </h2>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex gap-x-2">
          {['Create Account', 'Verify Identity', 'Ready'].map(
            (label, index) => {
              const stepMap: Step[] = ['intro', 'kyc', 'complete']
              const currentIndex = stepMap.indexOf(
                step === 'creating' ? 'intro' : step,
              )
              const isActive = index <= currentIndex
              return (
                <div key={label} className="flex flex-1 flex-col gap-y-2">
                  <div
                    className={`h-1 rounded-full ${
                      isActive
                        ? 'bg-blue-500'
                        : 'dark:bg-polar-700 bg-gray-200'
                    }`}
                  />
                  <p
                    className={`text-xs ${
                      isActive
                        ? 'font-medium dark:text-white text-gray-900'
                        : 'dark:text-polar-500 text-gray-400'
                    }`}
                  >
                    {label}
                  </p>
                </div>
              )
            },
          )}
        </div>

        {/* Step: Intro */}
        {(step === 'intro' || step === 'creating') && (
          <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
            <CardContent className="flex flex-col gap-y-8 py-8">
              <div className="flex flex-col gap-y-4">
                <h3 className="text-lg font-medium dark:text-white text-gray-900">
                  What is a Financial Business Account?
                </h3>
                <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-600">
                  A Financial Business Account is a Stripe Treasury-powered
                  account that gives you a real US bank account with routing
                  and account numbers. Funds from your customer subscriptions
                  and one-time payments flow directly into this account
                  instead of waiting for traditional payouts.
                </p>
                <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-600">
                  Once your account is open, you can issue virtual or physical
                  Visa cards that draw directly from your balance — giving you
                  instant access to your revenue. You can also send ACH or
                  wire transfers to external bank accounts.
                </p>
              </div>

              <div className="dark:bg-polar-900 grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-6 md:grid-cols-2">
                <div className="flex flex-col gap-y-1">
                  <p className="text-sm font-medium dark:text-white text-gray-900">
                    Instant Card Access
                  </p>
                  <p className="dark:text-polar-400 text-xs text-gray-500">
                    Issue virtual cards instantly to spend your balance without
                    waiting for bank transfers.
                  </p>
                </div>
                <div className="flex flex-col gap-y-1">
                  <p className="text-sm font-medium dark:text-white text-gray-900">
                    FDIC Insured
                  </p>
                  <p className="dark:text-polar-400 text-xs text-gray-500">
                    Deposits are eligible for up to $250,000 in FDIC
                    pass-through insurance.
                  </p>
                </div>
                <div className="flex flex-col gap-y-1">
                  <p className="text-sm font-medium dark:text-white text-gray-900">
                    Direct Revenue Flow
                  </p>
                  <p className="dark:text-polar-400 text-xs text-gray-500">
                    Subscription and payment revenue auto-routes to your
                    financial account.
                  </p>
                </div>
                <div className="flex flex-col gap-y-1">
                  <p className="text-sm font-medium dark:text-white text-gray-900">
                    ACH & Wire Transfers
                  </p>
                  <p className="dark:text-polar-400 text-xs text-gray-500">
                    Send payments to any US bank account via ACH or wire
                    transfer.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-y-3">
                <p className="dark:text-polar-400 text-xs text-gray-500">
                  By opening an account, you agree to Stripe Treasury's terms
                  of service. Your account information will be verified by
                  Stripe's banking partners.
                </p>
                <Button
                  onClick={handleCreateAccount}
                  loading={step === 'creating'}
                  disabled={step === 'creating'}
                >
                  {step === 'creating'
                    ? 'Creating Account...'
                    : 'Create Financial Account'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: KYC */}
        {step === 'kyc' && (
          <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
            <CardContent className="flex flex-col gap-y-6 py-8">
              <div className="flex flex-col gap-y-3">
                <h3 className="text-lg font-medium dark:text-white text-gray-900">
                  Verify Your Identity
                </h3>
                <p className="dark:text-polar-400 text-sm text-gray-600">
                  To comply with federal banking regulations, Stripe needs to
                  verify your identity and business information. This is a
                  standard KYC (Know Your Customer) process required for all
                  financial accounts.
                </p>
                <p className="dark:text-polar-400 text-sm text-gray-600">
                  You'll be redirected to Stripe's secure onboarding form to
                  provide:
                </p>
                <ul className="dark:text-polar-400 list-inside list-disc space-y-1 text-sm text-gray-600">
                  <li>Business name and type</li>
                  <li>Business address</li>
                  <li>Personal identification (owner/representative)</li>
                  <li>Tax identification number (EIN)</li>
                </ul>
              </div>

              {onboardingStatus?.requirements_pending &&
                onboardingStatus.requirements_pending.length > 0 && (
                  <div className="dark:bg-polar-900 rounded-xl bg-amber-50 p-4 dark:border-amber-900/50">
                    <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-400">
                      Pending requirements:
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-xs text-amber-700 dark:text-amber-500">
                      {onboardingStatus.requirements_pending.map(
                        (req: string) => (
                          <li key={req}>
                            {req.replace(/_/g, ' ').replace(/\./g, ' > ')}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              <div className="flex gap-x-3">
                <Button
                  onClick={handleStartKYC}
                  loading={getOnboardingLink.isPending}
                >
                  Continue to Stripe Verification
                </Button>
                <Button variant="outline" onClick={handleCheckStatus}>
                  I already completed this
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
            <CardContent className="flex flex-col items-center gap-y-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                <svg
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-y-2">
                <h3 className="text-xl font-medium dark:text-white text-gray-900">
                  Account Created Successfully
                </h3>
                <p className="dark:text-polar-400 text-sm text-gray-500">
                  Your Financial Business Account is now active. You can start
                  issuing cards and receiving payments.
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
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardBody>
  )
}
