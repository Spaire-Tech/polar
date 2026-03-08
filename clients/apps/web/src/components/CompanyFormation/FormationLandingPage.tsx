'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { FadeUp } from '@/components/Animated/FadeUp'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import PublicOutlined from '@mui/icons-material/PublicOutlined'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'

const FEATURES = [
  {
    icon: PublicOutlined,
    title: 'Incorporate from anywhere',
    description:
      'Form a US company regardless of where you are based. Delaware C-Corp, Wyoming LLC, or any US state.',
  },
  {
    icon: AccountBalanceOutlined,
    title: 'Complete formation package',
    description:
      'State filings, registered agent for one year, and EIN setup all handled for you.',
  },
  {
    icon: BadgeOutlined,
    title: 'Built for founders',
    description:
      'Whether you are raising venture capital or bootstrapping, get the right entity structure for your startup.',
  },
  {
    icon: PercentOutlined,
    title: 'Exclusive partner discount',
    description:
      'Spaire founders get 10% off formation through our partnership with doola.',
  },
] as const

const DoolaLogo = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="doola"
  >
    <rect width="40" height="40" rx="10" className="fill-[#1a1a2e] dark:fill-[#f5f5f5]" />
    <text
      x="50%"
      y="54%"
      dominantBaseline="middle"
      textAnchor="middle"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontSize="13"
      fontWeight="800"
      letterSpacing="-0.5"
      className="fill-white dark:fill-[#1a1a2e]"
    >
      doola
    </text>
  </svg>
)

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization

  return (
    <DashboardBody title={null}>
      <div className="flex w-full flex-col items-center pb-16">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ duration: 1, staggerChildren: 0.2 }}
          className="flex w-full max-w-2xl flex-col gap-16"
        >
          {/* Header */}
          <FadeUp className="flex flex-col gap-y-4">
            <div className="flex items-center gap-x-3">
              <DoolaLogo />
              <span className="dark:bg-spaire-800 dark:text-spaire-300 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Company Formation
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-3xl">
              Incorporate your startup
            </h1>
            <p className="dark:text-spaire-400 max-w-lg text-base leading-relaxed text-gray-500">
              Spaire partners with doola to help you form a US company in
              minutes — no matter where you are in the world. Get the legal
              foundation your startup needs to open a bank account, raise
              funding, and start selling.
            </p>
          </FadeUp>

          {/* What's included */}
          <FadeUp className="flex flex-col gap-y-5">
            <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400 dark:text-spaire-500">
              What&apos;s included
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="dark:bg-spaire-900 flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-none"
                >
                  <feature.icon
                    className="dark:text-spaire-400 text-gray-400"
                    style={{ fontSize: 22 }}
                  />
                  <div className="flex flex-col gap-y-1">
                    <span className="text-sm font-medium dark:text-white">
                      {feature.title}
                    </span>
                    <span className="dark:text-spaire-500 text-xs leading-relaxed text-gray-400">
                      {feature.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>

          {/* CTA */}
          <FadeUp className="flex flex-col gap-y-3 pt-2">
            <Link
              href={`/dashboard/${orgSlug}/formation/new`}
              className="w-full"
            >
              <Button size="lg" fullWidth>
                <span>Get started</span>
                <ArrowForwardOutlined className="ml-2" fontSize="small" />
              </Button>
            </Link>
          </FadeUp>
        </motion.div>
      </div>
    </DashboardBody>
  )
}
