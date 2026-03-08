'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import PublicOutlined from '@mui/icons-material/PublicOutlined'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

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

  return (
    <DashboardBody title="Incorporate your startup">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-spaire-500 text-sm text-gray-500">
          Form a US company in minutes, no matter where you are in the world.
          Get the legal foundation your startup needs to open a bank account,
          raise funding, and start selling.
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center">
        {/* doola partnership */}
        <div className="flex items-center gap-x-3">
          <svg
            viewBox="0 0 120 32"
            className="h-7"
            aria-label="doola"
          >
            <text
              x="0"
              y="26"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize="28"
              fontWeight="700"
              fill="currentColor"
              className="dark:fill-white fill-gray-900"
            >
              doola
            </text>
          </svg>
        </div>
        <p className="dark:text-spaire-400 mt-2 text-center text-sm text-gray-500">
          Spaire partners with doola to help you incorporate your US company
          with exclusive benefits and a streamlined process.
        </p>

        {/* Features 2x2 grid */}
        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="dark:border-spaire-700 flex flex-col gap-y-3 rounded-2xl border border-gray-200 p-6"
            >
              <feature.icon
                className="dark:text-spaire-400 text-gray-400"
                style={{ fontSize: 22 }}
              />
              <div className="flex flex-col gap-y-1">
                <span className="text-sm font-medium dark:text-white">
                  {feature.title}
                </span>
                <span className="dark:text-spaire-400 text-xs leading-relaxed text-gray-500">
                  {feature.description}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
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
      </div>
    </DashboardBody>
  )
}
