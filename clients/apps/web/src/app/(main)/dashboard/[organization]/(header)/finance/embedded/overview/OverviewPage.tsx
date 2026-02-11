'use client'

import FinanceActivityTable from '@/components/Finance/Embedded/FinanceActivityTable'
import FinanceBalanceBuckets from '@/components/Finance/Embedded/FinanceBalanceBuckets'
import FinanceQuickActions from '@/components/Finance/Embedded/FinanceQuickActions'
import FinanceStatusBanner from '@/components/Finance/Embedded/FinanceStatusBanner'
import OnboardingRail from '@/components/Finance/Embedded/OnboardingRail'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'

export default function OverviewPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        {/* Status Banner */}
        <FinanceStatusBanner organizationId={organization.id} />

        {/* Balance Buckets */}
        <FinanceBalanceBuckets organizationId={organization.id} />

        {/* Quick Actions */}
        <div>
          <h3 className="dark:text-polar-400 mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Quick Actions
          </h3>
          <FinanceQuickActions />
        </div>

        {/* Main Content: Activity + Onboarding Rail */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FinanceActivityTable organizationId={organization.id} />
          </div>
          <div className="space-y-4">
            <OnboardingRail organizationId={organization.id} />
          </div>
        </div>
      </div>
    </DashboardBody>
  )
}
