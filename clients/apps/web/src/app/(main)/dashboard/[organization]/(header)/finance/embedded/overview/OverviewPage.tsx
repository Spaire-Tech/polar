'use client'

import FinanceActivityTable from '@/components/Finance/Embedded/FinanceActivityTable'
import FinanceBalanceBuckets from '@/components/Finance/Embedded/FinanceBalanceBuckets'
import FinanceQuickActions from '@/components/Finance/Embedded/FinanceQuickActions'
import FinanceStatusBanner from '@/components/Finance/Embedded/FinanceStatusBanner'
import OnboardingRail from '@/components/Finance/Embedded/OnboardingRail'
import { schemas } from '@polar-sh/client'

export default function OverviewPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <div className="flex flex-col gap-y-8">
      <FinanceStatusBanner organizationId={organization.id} />
      <FinanceBalanceBuckets organizationId={organization.id} />
      <FinanceQuickActions />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FinanceActivityTable organizationId={organization.id} />
        </div>
        <div>
          <OnboardingRail organizationId={organization.id} />
        </div>
      </div>
    </div>
  )
}
