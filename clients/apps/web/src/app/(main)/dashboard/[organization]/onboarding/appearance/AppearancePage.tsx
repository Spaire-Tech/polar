'use client'

import { FadeUp } from '@/components/Animated/FadeUp'
import LogoIcon from '@/components/Brand/LogoIcon'
import { OnboardingStepper } from '@/components/Onboarding/OnboardingStepper'
import { useOnboardingTracking } from '@/hooks'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function AppearancePage() {
  const { organization } = useContext(OrganizationContext)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { trackStepStarted, trackStepCompleted, trackCompleted, getSession } =
    useOnboardingTracking()

  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const session = getSession()
    if (session) {
      trackStepStarted('appearance', organization.id)
    }
  }, [organization.id, getSession, trackStepStarted])

  // Sync with current theme once mounted
  useEffect(() => {
    if (theme === 'light' || theme === 'dark') {
      setSelectedTheme(theme)
    }
  }, [theme])

  const handleSelect = (t: 'dark' | 'light') => {
    setSelectedTheme(t)
    setTheme(t)
  }

  const handleContinue = async () => {
    setTheme(selectedTheme)
    const session = getSession()
    if (session) {
      await trackStepCompleted('appearance', organization.id)
      await trackCompleted(organization.id)
    }
    router.push(`/dashboard/${organization.slug}`)
  }

  return (
    <div className="dark:md:bg-polar-950 flex h-full w-full flex-row">
      <OnboardingStepper currentStep={4} />

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
                Choose your appearance
              </h1>
              <p className="dark:text-polar-400 max-w-md text-base text-gray-500">
                Pick the theme that feels right for you. You can always change
                it later in settings.
              </p>
            </FadeUp>

            {/* Theme Cards */}
            <FadeUp className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ThemeCard
                themeKey="dark"
                label="Dark"
                description="Easy on the eyes"
                selected={selectedTheme === 'dark'}
                onSelect={() => handleSelect('dark')}
              />
              <ThemeCard
                themeKey="light"
                label="Light"
                description="Clean and bright"
                selected={selectedTheme === 'light'}
                onSelect={() => handleSelect('light')}
              />
            </FadeUp>

            {/* CTA */}
            <FadeUp>
              <Button size="lg" fullWidth onClick={handleContinue}>
                Launch Dashboard
              </Button>
            </FadeUp>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

interface ThemeCardProps {
  themeKey: 'dark' | 'light'
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

const ThemeCard = ({
  themeKey,
  label,
  description,
  selected,
  onSelect,
}: ThemeCardProps) => {
  const isDark = themeKey === 'dark'

  return (
    <button
      onClick={onSelect}
      className={twMerge(
        'group flex flex-col gap-y-4 rounded-2xl border-2 p-5 text-left transition-all duration-200',
        selected
          ? 'border-blue-500 dark:border-blue-400'
          : 'dark:bg-polar-900 dark:border-polar-700 border-gray-200 bg-white hover:border-gray-300 dark:hover:border-polar-600',
      )}
    >
      {/* Theme preview mockup */}
      <div
        className={twMerge(
          'relative w-full overflow-hidden rounded-xl',
          isDark ? 'bg-gray-900' : 'bg-gray-50 border border-gray-200',
        )}
        style={{ aspectRatio: '16/9' }}
      >
        {/* Sidebar mockup */}
        <div
          className={twMerge(
            'absolute inset-y-0 left-0 w-1/4 flex flex-col gap-y-1.5 p-2',
            isDark ? 'bg-gray-800' : 'bg-white border-r border-gray-200',
          )}
        >
          <div
            className={twMerge(
              'h-2 w-3/4 rounded-full',
              isDark ? 'bg-gray-600' : 'bg-gray-200',
            )}
          />
          <div
            className={twMerge(
              'h-1.5 w-1/2 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-gray-100',
            )}
          />
          <div
            className={twMerge(
              'h-1.5 w-2/3 rounded-full mt-1',
              isDark ? 'bg-gray-700' : 'bg-gray-100',
            )}
          />
          <div
            className={twMerge(
              'h-1.5 w-1/2 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-gray-100',
            )}
          />
        </div>

        {/* Content area mockup */}
        <div className="absolute inset-y-0 right-0 left-1/4 p-2 flex flex-col gap-y-1.5">
          <div
            className={twMerge(
              'h-2 w-1/2 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-gray-200',
            )}
          />
          <div
            className={twMerge(
              'mt-1 flex-1 rounded-lg',
              isDark ? 'bg-gray-800' : 'bg-white border border-gray-100',
            )}
          />
        </div>

        {/* Icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={twMerge(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isDark
                ? 'bg-gray-700/80 text-white'
                : 'bg-white/80 text-gray-800 shadow-sm',
            )}
          >
            {isDark ? (
              <DarkModeOutlined fontSize="small" />
            ) : (
              <LightModeOutlined fontSize="small" />
            )}
          </div>
        </div>
      </div>

      {/* Label row */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-y-0.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="dark:text-polar-500 text-xs text-gray-400">
            {description}
          </span>
        </div>
        {selected && (
          <CheckCircleOutlined
            className="text-blue-500 dark:text-blue-400"
            fontSize="small"
          />
        )}
      </div>
    </button>
  )
}
