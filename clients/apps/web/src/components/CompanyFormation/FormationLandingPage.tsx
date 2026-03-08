'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { FadeUp } from '@/components/Animated/FadeUp'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'

const HOW_IT_WORKS = [
  {
    title: 'Tell us about your startup',
    description: 'Answer a few questions so we can recommend the right entity type and state.',
  },
  {
    title: 'Review your company details',
    description: 'Confirm your company name, entity type, formation state, and founders.',
  },
  {
    title: 'Complete with doola',
    description: 'Finish formation on doola with an exclusive Spaire discount.',
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

const HowItWorksCard = ({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) => (
  <div className="dark:bg-spaire-900 flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-none">
    <span className="dark:bg-spaire-800 dark:text-spaire-300 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
      {number}
    </span>
    <div className="flex flex-col gap-y-1">
      <span className="text-sm font-medium">{title}</span>
      <span className="dark:text-spaire-500 text-xs leading-relaxed text-gray-400">
        {description}
      </span>
    </div>
  </div>
)

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization

  return (
    <DashboardBody title={null}>
      {/* Left-aligned title + description */}
      <div className="flex flex-col gap-y-2">
        <h1 className="text-2xl font-medium tracking-tight md:text-3xl dark:text-white">
          Incorporate your startup
        </h1>
        <p className="dark:text-spaire-400 max-w-lg text-base leading-relaxed text-gray-500">
          Spaire partners with doola to help you form a US company in minutes —
          no matter where you are in the world. Get the legal foundation your
          startup needs to open a bank account, raise funding, and start
          selling.
        </p>
      </div>

      {/* Centered content below */}
      <div className="flex w-full flex-col items-center pb-16">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ duration: 1, staggerChildren: 0.2 }}
          className="flex w-full max-w-2xl flex-col gap-16"
        >
          {/* Header with doola logo */}
          <FadeUp className="flex flex-col gap-y-4">
            <div className="flex items-center gap-x-3">
              <DoolaLogo />
              <span className="dark:bg-spaire-800 dark:text-spaire-300 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Company Formation
              </span>
            </div>
          </FadeUp>

          {/* How it works */}
          <FadeUp className="flex flex-col gap-y-5">
            <h2 className="dark:text-spaire-500 text-sm font-medium uppercase tracking-wider text-gray-400">
              How it works
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <HowItWorksCard
                  key={i}
                  number={i + 1}
                  title={step.title}
                  description={step.description}
                />
              ))}
            </div>
          </FadeUp>

          {/* CTA */}
          <FadeUp className="flex flex-col gap-y-3 pt-2">
            <Link
              href={`/dashboard/${orgSlug}/founder-tools/new`}
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
