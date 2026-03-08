'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import LanguageOutlined from '@mui/icons-material/LanguageOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined'
import CardGiftcardOutlined from '@mui/icons-material/CardGiftcardOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const FEATURES = [
  {
    icon: LanguageOutlined,
    title: 'Incorporate from anywhere',
    description:
      'Form a US company regardless of where you are based. Delaware C-Corp, Wyoming LLC, or any US state.',
  },
  {
    icon: DescriptionOutlined,
    title: 'Complete formation package',
    description:
      'State filings, registered agent for one year, and EIN setup all handled for you.',
  },
  {
    icon: RocketLaunchOutlined,
    title: 'Built for founders',
    description:
      'Whether you are raising venture capital or bootstrapping, get the right entity structure for your startup.',
  },
  {
    icon: CardGiftcardOutlined,
    title: '$100K+ in Perks From Top Brands Worldwide',
    description:
      'Get exclusive credits and discounts from leading tools and platforms when you incorporate through Spaire.',
  },
] as const

function FeatureCard({
  feature,
}: {
  feature: (typeof FEATURES)[number]
}) {
  return (
    <div className="dark:border-spaire-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-x-3">
        <feature.icon
          className="text-gray-500 dark:text-white"
          style={{ fontSize: 24 }}
        />
        <h3 className="text-base font-medium dark:text-white">
          {feature.title}
        </h3>
      </div>
      <p className="dark:text-spaire-400 text-sm leading-relaxed text-gray-500">
        {feature.description}
      </p>
    </div>
  )
}

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization

  return (
    <DashboardBody title="Incorporate your startup">
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
        <Link href={`/dashboard/${orgSlug}/founder-tools/new`}>
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
