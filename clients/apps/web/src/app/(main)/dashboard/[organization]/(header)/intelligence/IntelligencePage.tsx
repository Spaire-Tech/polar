'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  InsightAction,
  InsightDriver,
  InsightResponse,
  useIntelligenceQuery,
} from '@/hooks/queries/intelligence'
import { schemas } from '@spaire/client'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// ---------------------------------------------------------------------------
// Suggested starter questions
// ---------------------------------------------------------------------------

const STARTER_QUESTIONS = [
  'Why did revenue drop last week?',
  'Where is churn coming from?',
  'Break down MRR by product.',
  'What are my top-performing products this month?',
  'Why did orders spike last Tuesday?',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCents = (cents: number): string => {
  const dollars = Math.abs(cents) / 100
  const formatted =
    dollars >= 1000
      ? `$${(dollars / 1000).toFixed(1)}k`
      : `$${dollars.toFixed(0)}`
  return cents < 0 ? `-${formatted}` : formatted
}

const effortColor: Record<InsightAction['effort'], string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
}

// ---------------------------------------------------------------------------
// Ask bar
// ---------------------------------------------------------------------------

interface AskBarProps {
  onSubmit: (question: string) => void
  isLoading: boolean
}

const AskBar = ({ onSubmit, isLoading }: AskBarProps) => {
  const [value, setValue] = useState('')

  const handleSubmit = (q: string) => {
    if (!q.trim() || isLoading) return
    setValue(q)
    onSubmit(q)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-3xl">
        <div className="dark:bg-polar-900 dark:border-polar-700 relative flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-shadow focus-within:shadow-md">
          <SearchOutlined className="dark:text-polar-400 shrink-0 text-gray-400" />
          <input
            type="text"
            className="dark:text-polar-50 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
            placeholder="Ask about your revenue…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit(value)
            }}
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={() => handleSubmit(value)}
            loading={isLoading}
            disabled={!value.trim() || isLoading}
          >
            Analyze
            <ArrowForwardOutlined className="ml-1.5" fontSize="small" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handleSubmit(q)}
            disabled={isLoading}
            className="dark:bg-polar-900 dark:border-polar-700 dark:text-polar-300 dark:hover:border-polar-500 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

const ConfidenceBadge = ({
  level,
}: {
  level: InsightResponse['confidence']
}) => {
  const styles = {
    high: 'bg-green-500/10 text-green-400 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return (
    <span
      className={twMerge(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles[level],
      )}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </span>
  )
}

// ---------------------------------------------------------------------------
// Driver card
// ---------------------------------------------------------------------------

const DriverCard = ({
  driver,
  rank,
}: {
  driver: InsightDriver
  rank: number
}) => {
  const isDown = driver.delta < 0
  const pctAbs = Math.abs(driver.pct_change)
  const sharePercent = Math.round(driver.share_of_total_change * 100)

  return (
    <div className="dark:bg-polar-900 dark:border-polar-700 flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-xs">
      <div className="dark:bg-polar-800 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500 dark:text-gray-400">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="dark:text-polar-200 text-sm font-medium text-gray-900">
              {driver.key}
            </span>
            <span className="dark:text-polar-500 ml-2 text-xs text-gray-400">
              {driver.dimension}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={twMerge(
                'text-sm font-semibold tabular-nums',
                isDown ? 'text-red-400' : 'text-green-400',
              )}
            >
              {isDown ? '–' : '+'}
              {formatCents(Math.abs(driver.delta))}
            </span>
            <span
              className={twMerge(
                'text-xs tabular-nums',
                isDown ? 'text-red-400/70' : 'text-green-400/70',
              )}
            >
              ({isDown ? '–' : '+'}
              {pctAbs.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="dark:bg-polar-800 h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={twMerge(
                'h-full rounded-full',
                isDown ? 'bg-red-400' : 'bg-green-400',
              )}
              style={{ width: `${Math.min(Math.abs(sharePercent), 100)}%` }}
            />
          </div>
          <span className="dark:text-polar-400 shrink-0 text-xs text-gray-400">
            {sharePercent}% of change
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action card
// ---------------------------------------------------------------------------

const ActionCard = ({ action }: { action: InsightAction }) => (
  <div className="dark:bg-polar-900 dark:border-polar-700 rounded-xl border border-gray-100 bg-white p-4 shadow-xs">
    <div className="flex items-start justify-between gap-3">
      <p className="dark:text-polar-100 text-sm font-medium text-gray-900">
        {action.action}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={twMerge(
            'text-xs font-medium',
            effortColor[action.effort],
          )}
        >
          {action.effort} effort
        </span>
        {action.requires_human_approval && (
          <span className="dark:bg-polar-800 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
            approval needed
          </span>
        )}
      </div>
    </div>
    <p className="dark:text-polar-400 mt-1.5 text-xs text-gray-500">
      {action.why}
    </p>
    {action.estimated_impact && (
      <p className="mt-2 text-xs text-blue-400">
        Est. impact: {action.estimated_impact}
      </p>
    )}
  </div>
)

// ---------------------------------------------------------------------------
// Debug accordion
// ---------------------------------------------------------------------------

const DebugAccordion = ({ insight }: { insight: InsightResponse }) => {
  const [open, setOpen] = useState(false)
  const { debug } = insight

  return (
    <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="dark:bg-polar-900 dark:hover:bg-polar-800 flex w-full items-center justify-between bg-white px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <span className="dark:text-polar-400 text-xs font-medium text-gray-500">
          Data Provenance
        </span>
        <ExpandMoreOutlined
          className={twMerge(
            'dark:text-polar-400 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
          fontSize="small"
        />
      </button>
      {open && (
        <div className="dark:bg-polar-950 dark:border-polar-700 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="dark:text-polar-500 text-gray-400">
                Interpretation
              </dt>
              <dd className="dark:text-polar-200 mt-0.5 text-gray-700">
                {debug.interpretation_note}
              </dd>
            </div>
            <div>
              <dt className="dark:text-polar-500 text-gray-400">
                Time range
              </dt>
              <dd className="dark:text-polar-200 mt-0.5 text-gray-700">
                {debug.time_range}
                {debug.baseline_range && ` vs ${debug.baseline_range}`}
              </dd>
            </div>
            <div>
              <dt className="dark:text-polar-500 text-gray-400">
                Queries run
              </dt>
              <dd className="dark:text-polar-200 mt-0.5 font-mono text-gray-700">
                {debug.queries_executed.join(', ')}
              </dd>
            </div>
            <div>
              <dt className="dark:text-polar-500 text-gray-400">Model</dt>
              <dd className="dark:text-polar-200 mt-0.5 text-gray-700">
                {debug.model_used}
              </dd>
            </div>
            {debug.warnings.length > 0 && (
              <div>
                <dt className="text-yellow-500">Warnings</dt>
                <dd className="mt-0.5 text-yellow-400">
                  {debug.warnings.join('; ')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Insight view
// ---------------------------------------------------------------------------

const InsightView = ({
  insight,
  onFollowup,
}: {
  insight: InsightResponse
  onFollowup: (q: string) => void
}) => {
  const isPositive =
    insight.answer.toLowerCase().includes('increas') ||
    insight.answer.toLowerCase().includes('grew') ||
    insight.answer.toLowerCase().includes('up ')

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="dark:bg-polar-900 dark:border-polar-700 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {isPositive ? (
              <TrendingUpOutlined className="shrink-0 text-green-400" />
            ) : (
              <TrendingDownOutlined className="shrink-0 text-red-400" />
            )}
            <h2 className="dark:text-polar-50 text-xl font-semibold text-gray-900">
              {insight.answer}
            </h2>
          </div>
          <ConfidenceBadge level={insight.confidence} />
        </div>

        {insight.summary_bullets.length > 0 && (
          <ul className="dark:border-polar-700 mt-4 space-y-1.5 border-t border-gray-100 pt-4">
            {insight.summary_bullets.map((bullet, i) => (
              <li
                key={i}
                className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="dark:text-polar-500 mt-1 shrink-0 text-xs text-gray-400">
                  •
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        )}

        {insight.confidence_reasons.length > 0 && (
          <div className="dark:border-polar-700 mt-3 border-t border-gray-100 pt-3">
            <p className="dark:text-polar-500 text-xs text-gray-400">
              {insight.confidence_reasons.join(' · ')}
            </p>
          </div>
        )}
      </div>

      {/* Drivers */}
      {insight.drivers.length > 0 && (
        <section>
          <h3 className="dark:text-polar-200 mb-3 text-sm font-medium text-gray-700">
            Top Drivers
          </h3>
          <div className="flex flex-col gap-2">
            {insight.drivers.map((driver, i) => (
              <DriverCard key={driver.key} driver={driver} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      {insight.recommended_actions.length > 0 && (
        <section>
          <h3 className="dark:text-polar-200 mb-3 text-sm font-medium text-gray-700">
            Recommended Actions
          </h3>
          <div className="flex flex-col gap-2">
            {insight.recommended_actions.map((action, i) => (
              <ActionCard key={i} action={action} />
            ))}
          </div>
        </section>
      )}

      {/* Follow-ups */}
      {insight.followup_questions.length > 0 && (
        <section>
          <h3 className="dark:text-polar-200 mb-3 text-sm font-medium text-gray-700">
            Follow-up Questions
          </h3>
          <div className="flex flex-wrap gap-2">
            {insight.followup_questions.map((q) => (
              <button
                key={q}
                onClick={() => onFollowup(q)}
                className="dark:bg-polar-900 dark:border-polar-700 dark:text-polar-300 dark:hover:border-polar-500 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400"
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Debug */}
      <DebugAccordion insight={insight} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty / loading state
// ---------------------------------------------------------------------------

const EmptyState = () => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <p className="dark:text-polar-300 text-lg font-medium text-gray-700">
      Revenue Intelligence
    </p>
    <p className="dark:text-polar-500 max-w-sm text-sm text-gray-400">
      Ask anything about your revenue. Get structured insights with numbers,
      drivers, and recommended actions — all auditable.
    </p>
  </div>
)

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface IntelligencePageProps {
  organization: schemas['Organization']
}

export default function IntelligencePage({
  organization,
}: IntelligencePageProps) {
  const [insight, setInsight] = useState<InsightResponse | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const { mutate, isPending } = useIntelligenceQuery()

  const handleQuestion = (question: string) => {
    setCurrentQuestion(question)
    mutate(
      {
        question,
        organization_id: organization.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onSuccess: (data) => setInsight(data),
        onError: () => {
          setInsight({
            answer: 'Something went wrong. Please try again.',
            confidence: 'low',
            confidence_reasons: ['Request failed'],
            summary_bullets: [],
            drivers: [],
            recommended_actions: [],
            followup_questions: [],
            debug: {
              queries_executed: [],
              time_range: 'unknown',
              baseline_range: null,
              warnings: ['Request error'],
              model_used: '',
              plan_intent: 'unknown',
              interpretation_note: question,
            },
          })
        },
      },
    )
  }

  return (
    <DashboardBody className="gap-y-8 pb-16">
      <div className="flex flex-col gap-8">
        {/* Ask bar */}
        <AskBar onSubmit={handleQuestion} isLoading={isPending} />

        {/* Loading skeleton */}
        {isPending && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="dark:bg-polar-900 h-24 animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        )}

        {/* Result */}
        {!isPending && insight && (
          <InsightView
            insight={insight}
            onFollowup={handleQuestion}
          />
        )}

        {/* Empty */}
        {!isPending && !insight && <EmptyState />}
      </div>
    </DashboardBody>
  )
}
