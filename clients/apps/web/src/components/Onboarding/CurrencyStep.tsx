'use client'

import revalidate from '@/app/actions'
import { useAuth, useOnboardingTracking } from '@/hooks'
import { useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'
import { OnboardingStepper } from './OnboardingStepper'

type PresentmentCurrency = schemas['PresentmentCurrency']

const CURRENCIES: {
  code: PresentmentCurrency
  name: string
  symbol: string
  flag: string
}[] = [
  { code: 'usd', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'eur', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'gbp', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'cad', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦' },
  { code: 'aud', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'chf', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'jpy', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'sek', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'inr', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'brl', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
]

export const CurrencyStep = () => {
  const { currentUser } = useAuth()
  const { organization } = useContext(OrganizationContext)
  const { trackStepStarted, trackStepCompleted, trackStepSkipped } =
    useOnboardingTracking()
  const updateOrganization = useUpdateOrganization()
  const router = useRouter()

  const [selected, setSelected] = useState<PresentmentCurrency>(
    (organization.default_presentment_currency as PresentmentCurrency) ?? 'usd',
  )

  useEffect(() => {
    trackStepStarted('integrate', organization.id)
  }, [organization.id, trackStepStarted])

  const handleContinue = async () => {
    const { error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: { default_presentment_currency: selected },
      userId: currentUser?.id,
    })

    if (error) return

    await revalidate(`organizations:${organization.id}`)
    await trackStepCompleted('integrate', organization.id)
    router.push(`/dashboard/${organization.slug}/onboarding/product`)
  }

  const handleSkip = () => {
    trackStepSkipped('integrate', organization.id)
    router.push(`/dashboard/${organization.slug}/onboarding/product`)
  }

  return (
    <div className="dark:md:bg-spaire-950 flex h-full w-full flex-row">
      <OnboardingStepper currentStep={1} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex w-full flex-col items-center px-6 pt-16 pb-24 md:px-20">
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.2 }}
            className="flex w-full max-w-2xl flex-col gap-12"
          >
            {/* Skip */}
            <FadeUp className="flex flex-row justify-end">
              <button
                onClick={handleSkip}
                className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-blue-500 transition-colors duration-100 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
              >
                I&apos;ll set this up later
              </button>
            </FadeUp>

            {/* Header */}
            <FadeUp className="flex flex-col gap-y-3">
              <div className="md:hidden mb-8">
                <LogoIcon size={36} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
                Pick your default currency
              </h1>
              <p className="dark:text-spaire-400 max-w-md text-base text-gray-500">
                This sets the default currency for your products and payouts. You can always support additional currencies per product later.
              </p>
            </FadeUp>

            {/* Currency grid */}
            <FadeUp className="flex flex-col gap-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                {CURRENCIES.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => setSelected(currency.code)}
                    className={twMerge(
                      'dark:bg-spaire-900 dark:border-spaire-700 flex cursor-pointer flex-row items-center gap-x-4 rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all',
                      selected === currency.code
                        ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-500'
                        : 'hover:border-gray-300 dark:hover:border-spaire-600',
                    )}
                  >
                    <span className="text-2xl">{currency.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {currency.name}
                      </span>
                      <span className="dark:text-spaire-500 text-xs text-gray-400">
                        {currency.code.toUpperCase()} · {currency.symbol}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <p className="dark:text-spaire-500 mt-2 text-xs text-gray-400">
                Stripe handles all currency conversion automatically — your customers can pay in their local currency regardless of this setting.
              </p>
            </FadeUp>

            {/* CTA */}
            <FadeUp className="flex flex-col gap-y-3 pt-2">
              <Button
                size="lg"
                loading={updateOrganization.isPending}
                onClick={handleContinue}
              >
                Continue
              </Button>
            </FadeUp>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
