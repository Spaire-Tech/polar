'use client'

import CancellationsDistributionChart from '@/components/Metrics/CancellationsDistributionChart'
import CancellationsStackedChart from '@/components/Metrics/CancellationsStackedChart'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import {
  useMetrics,
  useOrganizationPaymentStatus,
} from '@/hooks/queries'
import {
  getChartRangeParams,
  getPreviousParams,
} from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { CANCELLATION_METRICS } from '../analytics/metrics/components/metrics-config'

const OVERVIEW_METRICS: (keyof schemas['Metrics'])[] = [
  'revenue',
  'orders',
  'average_order_value',
  'cumulative_revenue',
]

// --- Profile Completion Banner ---

const ProfileCompletionBanner = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { data: paymentStatus, isLoading } =
    useOrganizationPaymentStatus(organization.id)

  if (isLoading || !paymentStatus || paymentStatus.payment_ready) {
    return null
  }

  return (
    <div className="glass-panel-strong flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(96, 165, 250, 0.15)' }}>
      <div className="flex flex-col gap-y-1">
        <h3 className="text-sm font-medium text-white">
          Complete your profile to start receiving payouts
        </h3>
        <p className="text-polar-400 text-sm">
          Set up your payout account so you can get paid when customers purchase your products.
        </p>
      </div>
      <Link href={`/dashboard/${organization.slug}/finance/account`} className="shrink-0">
        <Button size="sm">
          <span>Set Up Payouts</span>
          <ArrowForwardOutlined className="ml-1.5" fontSize="small" />
        </Button>
      </Link>
    </div>
  )
}

// --- Overview Metrics ---

const OverviewMetrics = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams('30d', organization.created_at),
    [organization.created_at],
  )

  const { data, isLoading } = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval,
    metrics: OVERVIEW_METRICS,
  })

  const previousParams = useMemo(
    () => getPreviousParams(startDate, '30d'),
    [startDate],
  )

  const { data: previousData } = useMetrics(
    {
      organization_id: organization.id,
      startDate: previousParams ? previousParams[0] : startDate,
      endDate: previousParams ? previousParams[1] : endDate,
      interval,
      metrics: OVERVIEW_METRICS,
    },
    previousParams !== null,
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="glass-panel flex flex-col overflow-hidden rounded-2xl">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          {OVERVIEW_METRICS.map((metricKey, index) => (
            <MetricChartBox
              key={metricKey}
              data={data}
              previousData={previousData}
              interval={interval}
              metric={metricKey}
              loading={isLoading}
              height={200}
              chartType="line"
              className={twMerge(
                'rounded-none! bg-transparent dark:bg-transparent',
                index === 0 && 'lg:col-span-2',
                'glass-stroke border-t-0 border-r border-b border-l-0 shadow-none',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Cancellation Insights ---

const CancellationInsights = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams('30d', organization.created_at),
    [organization.created_at],
  )

  const { data, isLoading } = useMetrics({
    organization_id: organization.id,
    startDate,
    endDate,
    interval,
    metrics: CANCELLATION_METRICS,
  })

  if (isLoading || !data) {
    return null
  }

  const hasCancellations = data.periods.some(
    (p) => (p.canceled_subscriptions ?? 0) > 0,
  )

  if (!hasCancellations) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Cancellation Insights</h2>
        <Link
          href={`/dashboard/${organization.slug}/analytics/metrics/cancellations`}
          className="text-polar-400 text-sm hover:underline"
        >
          View full analytics
        </Link>
      </div>
      <div className="glass-panel flex flex-col overflow-hidden rounded-2xl">
        <div className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-3">
          <div className="glass-stroke col-span-2 border-t-0 border-r border-b border-l-0 p-4">
            <CancellationsStackedChart
              data={data}
              interval={interval}
              height={300}
            />
          </div>
          <div className="glass-stroke border-t-0 border-r border-b border-l-0 p-4">
            <CancellationsDistributionChart
              data={data}
              interval={interval}
              height={20}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Overview Page ---

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-10">
      {/* Profile completion banner — disappears when payout is set up */}
      <ProfileCompletionBanner organization={organization} />

      {/* Metric charts — 30-day snapshot */}
      <OverviewMetrics organization={organization} />

      {/* Cancellation insights — only shows if there are cancellations */}
      <CancellationInsights organization={organization} />

      {/* Recent transactions */}
      <OrdersWidget />
    </DashboardBody>
  )
}
