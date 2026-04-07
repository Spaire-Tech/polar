'use client'

import revalidate from '@/app/actions'
import { FadeUp } from '@/components/Animated/FadeUp'
import LogoIcon from '@/components/Brand/LogoIcon'
import { OnboardingStepper } from '@/components/Onboarding/OnboardingStepper'
import { ThemeStep } from '@/components/Onboarding/ThemeStep'
import { useAuth } from '@/hooks'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'

export default function ThemePage() {
  const { organization } = useContext(OrganizationContext)
  const { currentUser } = useAuth()
  const router = useRouter()

  const handleContinue = async () => {
    // Revalidate caches so the dashboard layout fetches fresh org data (including avatar)
    await Promise.all([
      revalidate(`organizations:${organization.id}`),
      revalidate(`organizations:${organization.slug}`),
      revalidate(`users:${currentUser?.id}:organizations`, { expire: 0 }),
    ])
    router.push(`/dashboard/${organization.slug}`)
  }

  return (
    <div className="flex h-full w-full flex-row">
      <OnboardingStepper currentStep={2} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex w-full flex-col items-center px-6 pt-16 pb-24 md:px-20">
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.2 }}
            className="flex w-full max-w-2xl flex-col gap-14"
          >
            <FadeUp className="flex flex-col items-center gap-y-3 text-center">
              <div className="mb-4">
                <LogoIcon size={36} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
                How do you like it?
              </h1>
              <p className="dark:text-spaire-400 max-w-md text-base text-gray-500">
                Choose the appearance that feels right to you. You can change this anytime.
              </p>
            </FadeUp>

            <FadeUp>
              <ThemeStep onContinue={handleContinue} />
            </FadeUp>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
