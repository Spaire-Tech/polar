'use client'

import { useState } from 'react'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { FadeUp } from '@/components/Animated/FadeUp'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import PublicOutlined from '@mui/icons-material/PublicOutlined'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'

const DISCOUNT_CODE = 'DOOLASPAIRE10'

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

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(DISCOUNT_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <DashboardBody title={null}>
      <div className="flex w-full flex-col items-center pb-16">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ duration: 1, staggerChildren: 0.15 }}
          className="flex w-full max-w-2xl flex-col gap-16"
        >
          {/* Hero */}
          <FadeUp className="flex flex-col gap-y-6">
            <h1 className="text-3xl font-medium tracking-tight md:text-4xl dark:text-white">
              Incorporate your startup
            </h1>
            <p className="dark:text-spaire-400 max-w-lg text-lg leading-relaxed text-gray-500">
              Form a US company in minutes, no matter where you are in the
              world. Get the legal foundation your startup needs to open a bank
              account, raise funding, and start selling.
            </p>
            <div className="pt-2">
              <Link href={`/dashboard/${orgSlug}/formation/new`}>
                <Button size="lg">
                  Get started
                  <ArrowForwardOutlined
                    className="ml-2"
                    style={{ fontSize: 18 }}
                  />
                </Button>
              </Link>
            </div>
          </FadeUp>

          {/* Features */}
          <FadeUp className="flex flex-col gap-y-5">
            <h2 className="dark:text-spaire-500 text-sm font-medium uppercase tracking-wider text-gray-400">
              What&apos;s included
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="dark:bg-spaire-900 flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none"
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

          {/* Discount code */}
          <FadeUp className="flex flex-col gap-y-4">
            <h2 className="dark:text-spaire-500 text-sm font-medium uppercase tracking-wider text-gray-400">
              Your discount
            </h2>
            <div className="dark:bg-spaire-900 dark:border-spaire-800 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
              <div className="flex flex-col gap-y-1">
                <span className="dark:text-spaire-400 text-xs text-gray-500">
                  Use this code at checkout for 10% off
                </span>
                <span className="font-mono text-lg font-semibold tracking-wider dark:text-white">
                  {DISCOUNT_CODE}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="dark:bg-spaire-800 dark:hover:bg-spaire-700 dark:text-spaire-300 flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200"
              >
                {copied ? (
                  <>
                    <CheckOutlined style={{ fontSize: 16 }} />
                    Copied
                  </>
                ) : (
                  <>
                    <ContentCopyOutlined style={{ fontSize: 16 }} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </FadeUp>
        </motion.div>
      </div>
    </DashboardBody>
  )
}
