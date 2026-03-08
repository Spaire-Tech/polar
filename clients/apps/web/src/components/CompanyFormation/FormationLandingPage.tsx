'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const BENEFITS = [
  { title: '10% discount', description: 'Exclusive discount for Spaire founders' },
  { title: 'Company formation', description: 'LLC or C-Corp with state filings' },
  { title: 'Registered agent', description: '1 year of registered agent included' },
  { title: 'EIN assistance', description: 'Federal tax ID number setup' },
  { title: 'Startup perks', description: 'Banking access & partner credits' },
] as const

export default function FormationLandingPage() {
  const params = useParams<{ organization: string }>()
  const orgSlug = params?.organization

  return (
    <DashboardBody title="Start a Company">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Form your US company in minutes through our partner doola.
        </p>
      </div>

      <div className="mt-6">
        <Link href={`/dashboard/${orgSlug}/formation/new`}>
          <Button size="lg">
            Start Formation
            <ArrowForwardOutlined
              className="ml-2"
              style={{ fontSize: 18 }}
            />
          </Button>
        </Link>
      </div>

      {/* Partner benefits */}
      <div className="mt-8">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Partner Benefits
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="dark:border-polar-700 dark:bg-polar-800 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center gap-2">
                <CheckCircleOutlined
                  className="text-green-500"
                  style={{ fontSize: 20 }}
                />
                <h4 className="font-medium dark:text-white">
                  {benefit.title}
                </h4>
              </div>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="dark:text-polar-500 mt-8 text-xs text-gray-400">
        Powered by doola &middot; Formation typically takes ~10 minutes
      </p>
    </DashboardBody>
  )
}
