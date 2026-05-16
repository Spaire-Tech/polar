'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import QuotaUsageCard from '@/components/Settings/SpaireTier/QuotaUsageCard'
import SpairePlanCards from '@/components/Settings/SpaireTier/SpairePlanCards'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@spaire/client'

export default function PlanPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody wrapperClassName="max-w-6xl" title="Plan">
      <div className="flex flex-col gap-y-12">
        <Section id="plans">
          <SpairePlanCards organization={organization} />
        </Section>

        <Section id="plan_usage">
          <SectionDescription
            title="Usage this period"
            description="What your organization has consumed against the limits on your current plan."
          />
          <QuotaUsageCard organization={organization} />
        </Section>
      </div>
    </DashboardBody>
  )
}
