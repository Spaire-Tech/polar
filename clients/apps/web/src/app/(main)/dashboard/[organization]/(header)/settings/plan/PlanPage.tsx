'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import BillingManagementCard from '@/components/Settings/SpaireTier/BillingManagementCard'
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
    <DashboardBody wrapperClassName="max-w-6xl" title="Subscription">
      <div className="flex flex-col gap-y-12">
        <Section id="plans">
          <SpairePlanCards organization={organization} />
        </Section>

        <Section id="billing">
          <SectionDescription
            title="Billing & invoices"
            description="Manage the card on file for your Spaire subscription and view your invoices."
          />
          <BillingManagementCard organization={organization} />
        </Section>

        <Section id="plan_usage">
          <SectionDescription
            title="Usage this period"
            description="What you have consumed against the limits on your current plan."
          />
          <QuotaUsageCard organization={organization} />
        </Section>
      </div>
    </DashboardBody>
  )
}
