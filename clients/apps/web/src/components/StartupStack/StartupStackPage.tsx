'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { PERKS, type Perk } from '@/constants/perksData'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

const PerkCard = ({ perk }: { perk: Perk }) => {
  return (
    <div className="dark:border-polar-700 flex flex-col gap-y-5 rounded-2xl border border-gray-200 p-6">
      <div className="flex flex-row items-start gap-x-4">
        <img
          src={perk.logo}
          alt={perk.name}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
        <div className="flex flex-col gap-y-1">
          <h3 className="text-base font-medium dark:text-white">{perk.name}</h3>
          <span className="text-sm font-medium text-emerald-500">
            {perk.incentive}
          </span>
        </div>
      </div>

      <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
        {perk.description}
      </p>

      <div className="dark:border-polar-700 dark:bg-polar-800 flex flex-row items-start gap-x-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <InfoOutlined className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-polar-500" />
        <p className="dark:text-polar-500 text-xs leading-relaxed text-gray-400">
          {perk.advice}
        </p>
      </div>

      <Link href={perk.url} target="_blank" rel="noopener noreferrer">
        <Button fullWidth>
          <span>Apply Now</span>
          <ArrowOutwardOutlined className="h-4 w-4" fontSize="inherit" />
        </Button>
      </Link>
    </div>
  )
}

export default function StartupStackPage() {
  return (
    <DashboardBody title="Startup Stack">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Verified deals and credits from the tools that high-growth startups
          actually use. Each offer has been negotiated and confirmed.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PERKS.map((perk) => (
          <PerkCard key={perk.name} perk={perk} />
        ))}
      </div>
    </DashboardBody>
  )
}
