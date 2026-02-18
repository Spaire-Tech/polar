'use client'

import Spinner from '@/components/Shared/Spinner'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { getFormattedMetricValue } from '@/utils/metrics'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import MetricChart from './MetricChart'
import { ShareChartModal } from './ShareChartModal'

interface MetricOption {
  slug: keyof schemas['Metrics']
  display_name: string
}

interface MetricChartBoxProps {
  metric: keyof schemas['Metrics']
  onMetricChange?: (metric: keyof schemas['Metrics']) => void
  data?: ParsedMetricsResponse
  previousData?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  className?: string
  height?: number
  width?: number
  loading?: boolean
  compact?: boolean
  shareable?: boolean
  simple?: boolean
  chartType?: 'line' | 'bar'
  /** Override the list of metrics shown in the dropdown. If not provided, uses metrics from data. */
  availableMetrics?: MetricOption[]
}

const EXPERIMENTAL_METRICS: Record<string, { tooltip: string }> = {
  churn_rate: {
    tooltip:
      'Churn rate values vary based on the selected time interval. For best results, use monthly or longer intervals.',
  },
  ltv: {
    tooltip:
      'LTV is based on Churn Rate, and values vary based on the selected interval. For best results, use monthly or longer intervals.',
  },
}

const MetricChartBox = ({
  ref,
  metric,
  onMetricChange,
  data,
  previousData,
  interval,
  className,
  height = 300,
  width,
  loading,
  compact = false,
  shareable = true,
  simple = false,
  chartType = 'line',
  availableMetrics,
}: MetricChartBoxProps & {
  ref?: React.RefObject<HTMLDivElement>
}) => {
  const { isShown: isModalOpen, show: showModal, hide: hideModal } = useModal()

  const startDate = useMemo(() => {
    if (!data || !data.periods.length) return null
    return data.periods[0].timestamp
  }, [data])
  const endDate = useMemo(() => {
    if (!data || !data.periods.length) return null
    return data.periods[data.periods.length - 1].timestamp
  }, [data])
  const previousStartDate = useMemo(() => {
    if (!previousData || !previousData.periods.length) return null
    return previousData.periods[0].timestamp
  }, [previousData])
  const previousEndDate = useMemo(() => {
    if (!previousData || !previousData.periods.length) return null
    return previousData.periods[previousData.periods.length - 1].timestamp
  }, [previousData])

  const selectedMetric = useMemo(() => data?.metrics[metric], [data, metric])
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = React.useState<
    number | null
  >(null)

  const hoveredPeriod = useMemo(() => {
    if (!data || !hoveredPeriodIndex) return null
    return data.periods[hoveredPeriodIndex]
  }, [data, hoveredPeriodIndex])

  const hoveredPreviousPeriod = useMemo(() => {
    if (!previousData || !hoveredPeriodIndex) return null
    return previousData.periods[hoveredPeriodIndex]
  }, [previousData, hoveredPeriodIndex])

  const metricValue = useMemo(() => {
    if (!data) return 0
    const metricInfo = data.metrics[metric]
    if (!metricInfo) return 0

    const currentPeriod = hoveredPeriod
      ? hoveredPeriod
      : data.periods[data.periods.length - 1]

    const value = hoveredPeriod ? currentPeriod[metric] : data.totals[metric]

    return getFormattedMetricValue(metricInfo, value ?? 0)
  }, [hoveredPeriod, data, metric])

  const trend = useMemo(() => {
    if (!data || !previousData) return 0

    const currentPeriod =
      hoveredPeriod ?? data?.periods[data.periods.length - 1]
    const previousPeriod =
      hoveredPreviousPeriod ??
      previousData?.periods[previousData?.periods.length - 1]

    const currentValue = currentPeriod[metric] ?? 0
    const previousValue = previousPeriod[metric] ?? 0

    return ((currentValue - previousValue) / previousValue) * 100
  }, [data, previousData, hoveredPeriod, hoveredPreviousPeriod, metric])

  const hasTrend = trend !== 0 && !isNaN(trend) && trend !== Infinity
  const isPositive = trend > 0

  return (
    <div
      ref={ref}
      className={twMerge(
        'group flex w-full flex-col',
        className,
      )}
    >
      {/* Header: label + trend badge + share */}
      <div
        className={twMerge(
          'flex items-start justify-between',
          compact ? 'px-4 pt-4 pb-2' : 'px-6 pt-6 pb-3',
        )}
      >
        <div className="flex flex-col gap-1 min-w-0">
          {/* Metric name or selector */}
          {onMetricChange ? (
            <div className="flex flex-row items-center gap-x-2">
              <Select value={metric} onValueChange={onMetricChange}>
                <SelectTrigger className="dark:hover:bg-polar-700 -mt-1.5 -ml-2 h-fit w-fit rounded-md border-0 border-none bg-transparent px-2 py-1.5 text-xs font-medium uppercase tracking-widest shadow-none ring-0 transition-colors hover:bg-gray-100 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white/50 text-gray-400">
                  <SelectValue placeholder="Select a metric" />
                </SelectTrigger>
                <SelectContent className="dark:bg-polar-800 dark:ring-polar-700 ring-1 ring-gray-200">
                  {availableMetrics
                    ? availableMetrics.map((m) => (
                        <SelectItem key={m.slug} value={m.slug}>
                          {m.display_name}
                        </SelectItem>
                      ))
                    : data &&
                      Object.values(data.metrics)
                        .filter(
                          (m): m is NonNullable<typeof m> =>
                            m !== null && m !== undefined,
                        )
                        .map((m) => (
                          <SelectItem key={m.slug} value={m.slug}>
                            {m.display_name}
                          </SelectItem>
                        ))}
                </SelectContent>
              </Select>
              {metric in EXPERIMENTAL_METRICS && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help">
                      <Status
                        status="Experimental"
                        className="bg-blue-100 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {EXPERIMENTAL_METRICS[metric]?.tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="flex flex-row items-center gap-x-2">
              <span className={twMerge(
                'font-medium uppercase tracking-widest',
                compact ? 'text-xs' : 'text-xs',
                'dark:text-white/40 text-gray-400',
              )}>
                {selectedMetric?.display_name}
              </span>
              {metric in EXPERIMENTAL_METRICS && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help">
                      <Status
                        status="Experimental"
                        className="bg-blue-100 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {EXPERIMENTAL_METRICS[metric]?.tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Big metric value */}
          <div className="flex flex-row items-baseline gap-x-3">
            <span className={twMerge(
              'font-semibold tracking-tight dark:text-white text-gray-900',
              compact ? 'text-2xl' : 'text-4xl',
            )}>
              {metricValue}
            </span>
            {hasTrend && (
              <span className={twMerge(
                'flex items-center gap-0.5 text-xs font-medium',
                isPositive
                  ? 'text-emerald-500'
                  : 'text-red-500',
              )}>
                {isPositive
                  ? <TrendingUpOutlined sx={{ fontSize: 14 }} />
                  : <TrendingDownOutlined sx={{ fontSize: 14 }} />
                }
                {isPositive ? '+' : ''}{trend.toFixed(1)}%
              </span>
            )}
          </div>

          {/* Date range */}
          {!compact && (
            <div className="flex flex-col gap-x-4 gap-y-1 mt-0.5 sm:flex-row sm:items-center">
              <div className="flex flex-row items-center gap-x-1.5 text-xs dark:text-white/30 text-gray-400">
                <span className="h-2 w-2 rounded-full bg-blue-500 opacity-80" />
                {hoveredPeriod ? (
                  <FormattedDateTime
                    datetime={hoveredPeriod.timestamp}
                    dateStyle="medium"
                  />
                ) : (
                  startDate && endDate && (
                    <FormattedInterval
                      startDatetime={startDate}
                      endDatetime={endDate}
                      hideCurrentYear={false}
                    />
                  )
                )}
              </div>
              {previousData && (
                <div className="flex flex-row items-center gap-x-1.5 text-xs dark:text-white/25 text-gray-400">
                  <span className="dark:border-polar-600 h-2 w-2 rounded-full border-2 border-gray-300" />
                  {hoveredPreviousPeriod ? (
                    <FormattedDateTime
                      datetime={hoveredPreviousPeriod.timestamp}
                      dateStyle="medium"
                    />
                  ) : (
                    previousStartDate && previousEndDate && (
                      <FormattedInterval
                        startDatetime={previousStartDate}
                        endDatetime={previousEndDate}
                        hideCurrentYear={false}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Share button */}
        {shareable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden shrink-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100 md:flex dark:text-white/40 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                onClick={showModal}
              >
                <ArrowOutwardOutlined fontSize="small" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share Chart</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Chart area — no inner container, flush with card edges */}
      <div className={twMerge('w-full', compact ? 'pb-2' : 'pb-1')}>
        {loading ? (
          <div
            style={{ height }}
            className="flex flex-col items-center justify-center"
          >
            <Spinner />
          </div>
        ) : data && selectedMetric ? (
          <MetricChart
            height={height}
            width={width}
            data={data.periods}
            previousData={previousData?.periods}
            interval={interval}
            metric={selectedMetric}
            onDataIndexHover={(period) => {
              setHoveredPeriodIndex(period)
            }}
            simple={simple}
            chartType={chartType}
          />
        ) : (
          <div
            className="flex w-full flex-col items-center justify-center dark:text-white/30 text-gray-400"
            style={{ height }}
          >
            <span className="text-sm">No data</span>
          </div>
        )}
      </div>

      {shareable && data && (
        <Modal
          title={`Share ${selectedMetric?.display_name} Metric`}
          className="lg:w-fit!"
          isShown={isModalOpen}
          hide={hideModal}
          modalContent={
            <ShareChartModal
              data={data}
              previousData={previousData}
              interval={interval}
              metric={selectedMetric?.slug as keyof schemas['Metrics']}
            />
          }
        />
      )}
    </div>
  )
}

MetricChartBox.displayName = 'MetricChartBox'

export default MetricChartBox
