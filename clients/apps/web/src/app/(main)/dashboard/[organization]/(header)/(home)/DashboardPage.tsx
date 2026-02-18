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
    <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-y-0.5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Complete your profile to start receiving payouts
        </h3>
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Set up your payout account so you can get paid when customers purchase your products.
        </p>
      </div>
      <Link href={`/dashboard/${organization.slug}/finance/account`} className="shrink-0">
        <Button size="sm" className="rounded-lg">
          <span>Set Up Payouts</span>
          <ArrowForwardOutlined className="ml-1.5" fontSize="small" />
        </Button>
      </Link>
    </div>
  )
}

// --- Overview Metrics Grid ---

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
    <div className="dark:border-polar-800 overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-polar-900 shadow-sm">
      {/* Section header */}
      <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          Last 30 days
        </span>
        <Link
          href={`/dashboard/${organization.slug}/analytics/metrics`}
          className="dark:text-polar-400 flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-white"
        >
          View analytics
          <ArrowForwardOutlined sx={{ fontSize: 13 }} />
        </Link>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x sm:divide-y-0 dark:divide-polar-800 divide-gray-100">
        {OVERVIEW_METRICS.map((metricKey, index) => (
          <MetricChartBox
            key={metricKey}
            data={data}
            previousData={previousData}
            interval={interval}
            metric={metricKey}
            loading={isLoading}
            height={120}
            chartType="line"
            simple={true}
            shareable={false}
            compact={false}
            className={twMerge(
              'rounded-none! bg-transparent dark:bg-transparent border-0 shadow-none',
              index > 0 ? 'lg:border-l-0' : '',
            )}
          />
        ))}
      </div>
    </div>
  )
}

// --- Revenue Chart Section ---

const RevenueChart = ({
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
    metrics: ['revenue'],
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
      metrics: ['revenue'],
    },
    previousParams !== null,
  )

  return (
    <div className="dark:border-polar-800 overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-polar-900 shadow-sm">
      <MetricChartBox
        data={data}
        previousData={previousData}
        interval={interval}
        metric="revenue"
        loading={isLoading}
        height={220}
        chartType="line"
        shareable={true}
        compact={false}
        className="rounded-none! border-0 shadow-none"
      />
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
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Cancellation Insights</h2>
        <Link
          href={`/dashboard/${organization.slug}/analytics/metrics/cancellations`}
          className="dark:text-polar-400 flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-white"
        >
          View full analytics
          <ArrowForwardOutlined sx={{ fontSize: 13 }} />
        </Link>
      </div>
      <div className="dark:border-polar-800 overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-polar-900 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 dark:divide-polar-800 divide-gray-100 lg:divide-x">
          <div className="col-span-2 p-6">
            <CancellationsStackedChart
              data={data}
              interval={interval}
              height={260}
            />
          </div>
          <div className="dark:border-polar-800 border-t border-gray-100 p-6 lg:border-t-0">
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
    <DashboardBody className="gap-y-6" title={null}>
      {/* Profile completion banner */}
      <ProfileCompletionBanner organization={organization} />

      {/* Hero revenue chart */}
      <RevenueChart organization={organization} />

      {/* KPI snapshot grid */}
      <OverviewMetrics organization={organization} />

      {/* Cancellation insights — only shows if there are cancellations */}
      <CancellationInsights organization={organization} />

      {/* Recent transactions */}
      <OrdersWidget />
    </DashboardBody>
  )
}
