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
    label: 'Global',
    description:
      'Form a US company regardless of where you are based. Delaware C-Corp, Wyoming LLC, or any US state.',
  },
  {
    icon: AccountBalanceOutlined,
    title: 'Complete formation package',
    label: 'All-in-one',
    description:
      'State filings, registered agent for one year, and EIN setup all handled for you.',
  },
  {
    icon: BadgeOutlined,
    title: 'Built for founders',
    label: 'Startups',
    description:
      'Whether you are raising venture capital or bootstrapping, get the right entity structure for your startup.',
  },
  {
    icon: PercentOutlined,
    title: 'Exclusive partner discount',
    label: 'Savings',
    description:
      'Spaire founders get 10% off formation through our partnership with doola.',
  },
] as const

function FeatureCard({
  feature,
}: {
  feature: (typeof FEATURES)[number]
}) {
  return (
    <div className="dark:border-spaire-700 flex flex-col gap-y-5 rounded-2xl border border-gray-200 p-6">
      <div className="flex flex-row items-start justify-between">
        <div className="flex items-center gap-x-3">
          <feature.icon
            className="text-gray-500 dark:text-white"
            style={{ fontSize: 24 }}
          />
          <div className="flex flex-col gap-y-0.5">
            <h3 className="text-base font-medium dark:text-white">
              {feature.title}
            </h3>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
              {feature.label}
            </span>
          </div>
        </div>
      </div>

      <p className="dark:text-spaire-400 text-sm leading-relaxed text-gray-500">
        {feature.description}
      </p>

      <div className="flex flex-row items-center gap-x-2">
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          Company Formation
        </span>
      </div>
    </div>
  )
}

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization

  return (
    <DashboardBody title="Incorporate">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-spaire-500 text-sm text-gray-500">
          Spaire partners with doola to help you form a US company in minutes —
          no matter where you are in the world. Get the legal foundation your
          startup needs to open a bank account, raise funding, and start
          selling.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </div>
      <div className="mt-8">
        <Link href={`/dashboard/${orgSlug}/founder-tools/incorporate/new`}>
          <Button size="lg">
            Get started
            <ArrowForwardOutlined
              className="ml-2"
              style={{ fontSize: 18 }}
            />
          </Button>
        </Link>
      </div>
    </DashboardBody>
  )
}
