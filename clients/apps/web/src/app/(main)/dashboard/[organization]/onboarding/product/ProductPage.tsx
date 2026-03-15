'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'

import { FadeUp } from '@/components/Animated/FadeUp'
import LogoIcon from '@/components/Brand/LogoIcon'
import { AssistantStep } from '@/components/Onboarding/AssistantStep'
import { OnboardingStepper } from '@/components/Onboarding/OnboardingStepper'
import { ProductStep } from '@/components/Onboarding/ProductStep'
import { useOnboardingTracking } from '@/hooks/onboarding'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  isAssistantEnabled,
}: {
  isAssistantEnabled: boolean
}) {
  const { organization, organizations } = useContext(OrganizationContext)
  const { trackStepSkipped } = useOnboardingTracking()
  const [mode, setMode] = useState<'assistant' | 'manual'>(
    isAssistantEnabled ? 'assistant' : 'manual',
  )
  const [isAssistantFinished, setIsAssistantFinished] = useState(false)
  const [shouldShowSkip, setShouldShowSkip] = useState(organizations.length > 1)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isAssistantFinished) {
        setShouldShowSkip(true)
      }
    }, 4000)

    return () => clearTimeout(timer)
  }, [isAssistantFinished])

  return (
    <div className="dark:md:bg-spaire-950 flex h-full w-full flex-row">
      {/* Stepper Sidebar - desktop only */}
      <OnboardingStepper currentStep={2} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex w-full flex-col items-center px-6 pt-16 pb-24 md:px-20">
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.2 }}
            className="flex w-full max-w-2xl flex-col gap-14"
          >
            {/* Header */}
            <FadeUp className="flex flex-col gap-y-3">
              <div className="md:hidden mb-8">
                <LogoIcon size={36} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
                Create your first product
              </h1>
              <p className="dark:text-spaire-400 max-w-md text-base text-gray-500">
                Define what you&apos;re selling — you can always add more later.
              </p>
            </FadeUp>

            {mode === 'assistant' && (
              <AssistantStep
                onEjectToManual={() => setMode('manual')}
                onFinished={() => {
                  setShouldShowSkip(false)
                  setIsAssistantFinished(true)
                }}
              />
            )}

            {mode === 'manual' && (
              <motion.div
                initial="hidden"
                animate="visible"
                transition={{ duration: 1, staggerChildren: 0.3 }}
                className="flex flex-col gap-10"
              >
                <ProductStep />
              </motion.div>
            )}

            {mode === 'assistant' && (
              <FadeUp
                className={twMerge(
                  'flex flex-row items-center justify-center gap-x-1 text-sm transition-opacity duration-1000 ease-out',
                  shouldShowSkip
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0',
                  organizations.length === 1 && !shouldShowSkip ? 'opacity-0!' : '',
                )}
              >
                <button
                  className="dark:text-spaire-500 dark:hover:text-spaire-400 dark:hover:bg-spaire-700 cursor-pointer rounded-full px-2.5 py-1 text-gray-500 transition-colors duration-100 hover:bg-gray-100 hover:text-gray-600"
                  onClick={() => setMode('manual')}
                >
                  Set up manually
                </button>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <Link
                  href={`/dashboard/${organization.slug}`}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-blue-500 transition-colors duration-100 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  onClick={() => trackStepSkipped('product', organization.id)}
                >
                  I&apos;ll do this later
                </Link>
              </FadeUp>
            )}

            {mode === 'manual' && (
              <FadeUp className="flex flex-row items-center justify-center">
                <Link
                  href={`/dashboard/${organization.slug}`}
                  className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-blue-500 transition-colors duration-100 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  onClick={() => trackStepSkipped('product', organization.id)}
                >
                  I&apos;ll do this later
                </Link>
              </FadeUp>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
