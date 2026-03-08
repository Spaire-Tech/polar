'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import PublicOutlined from '@mui/icons-material/PublicOutlined'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
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

      {/* Powered by doola */}
      <div className="mt-6 flex items-center gap-x-3">
        <img
          src="https://cdn.doola.com/favicons/favicon-96x96.png"
          alt="doola"
          className="h-8 w-8 rounded-lg"
        />
        <span className="dark:text-spaire-400 text-sm text-gray-500">
          Powered by{' '}
          <span className="font-medium text-gray-900 dark:text-white">
            doola
          </span>
        </span>
      </div>

      {/* Features */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    </DashboardBody>
  )
}
