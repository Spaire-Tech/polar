'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  InsightAction,
  InsightDriver,
  InsightResponse,
  useIntelligenceQuery,
} from '@/hooks/queries/intelligence'
import { schemas } from '@spaire/client'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import AutoGraphOutlined from '@mui/icons-material/AutoGraphOutlined'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// ---------------------------------------------------------------------------
// Starter prompts shown on the empty state
// ---------------------------------------------------------------------------

const STARTER_PROMPTS = [
  { label: 'Revenue drop', question: 'Why did revenue drop last week?' },
  { label: 'Churn drivers', question: 'Where is churn coming from?' },
  { label: 'Top products', question: 'What are my top-performing products this month?' },
  { label: 'MRR breakdown', question: 'Break down MRR by product.' },
]

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const formatCents = (cents: number): string => {
  const abs = Math.abs(cents) / 100
  const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`
  return cents < 0 ? `–${str}` : str
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

type UserMessage = { role: 'user'; text: string }
type AssistantMessage = { role: 'assistant'; insight: InsightResponse }
type ErrorMessage = { role: 'error'; text: string }
type Message = UserMessage | AssistantMessage | ErrorMessage

// ---------------------------------------------------------------------------
// Sub-components for the structured insight inside the chat bubble
// ---------------------------------------------------------------------------

const ConfidencePill = ({ level }: { level: InsightResponse['confidence'] }) => {
  const map = {
    high: 'bg-green-500/10 text-green-400',
    medium: 'bg-yellow-500/10 text-yellow-400',
    low: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={twMerge('rounded-full px-2 py-0.5 text-[11px] font-medium', map[level])}>
      {level} confidence
    </span>
  )
}

const DriverRow = ({ driver, rank }: { driver: InsightDriver; rank: number }) => {
  const isDown = driver.delta < 0
  const share = Math.round(Math.abs(driver.share_of_total_change) * 100)

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="dark:text-spaire-600 w-4 shrink-0 text-right text-xs tabular-nums text-gray-400">
        {rank}
      </span>
      <span className="dark:text-spaire-200 min-w-0 flex-1 truncate text-sm text-gray-800">
        {driver.key}
      </span>
      <span
        className={twMerge(
          'shrink-0 text-sm font-medium tabular-nums',
          isDown ? 'text-red-400' : 'text-green-400',
        )}
      >
        {formatCents(driver.delta)}
      </span>
      <div className="dark:bg-spaire-800 h-1 w-16 shrink-0 overflow-hidden rounded-full bg-gray-200">
        <div
          className={twMerge('h-full rounded-full', isDown ? 'bg-red-400' : 'bg-green-400')}
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
      <span className="dark:text-spaire-600 w-8 shrink-0 text-right text-[11px] tabular-nums text-gray-400">
        {share}%
      </span>
    </div>
  )
}

const ActionRow = ({ action }: { action: InsightAction }) => {
  const effortDot: Record<InsightAction['effort'], string> = {
    low: 'bg-green-400',
    medium: 'bg-yellow-400',
    high: 'bg-red-400',
  }
  return (
    <div className="dark:border-spaire-700 flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className={twMerge('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', effortDot[action.effort])} />
      <div className="min-w-0">
        <p className="dark:text-spaire-100 text-sm text-gray-900">{action.action}</p>
        <p className="dark:text-spaire-500 mt-0.5 text-xs text-gray-500">{action.why}</p>
        {action.estimated_impact && (
          <p className="mt-0.5 text-xs text-blue-400">{action.estimated_impact}</p>
        )}
      </div>
    </div>
  )
}

const ProvenanceAccordion = ({ insight }: { insight: InsightResponse }) => {
  const [open, setOpen] = useState(false)
  const { debug } = insight

  return (
    <div className="dark:border-spaire-700 mt-3 overflow-hidden rounded-lg border border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="dark:hover:bg-spaire-800 flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="dark:text-spaire-500 text-xs text-gray-400">
          Data provenance · {debug.time_range}
          {debug.baseline_range ? ` vs ${debug.baseline_range}` : ''}
        </span>
        <ExpandMoreOutlined
          className={twMerge(
            'dark:text-spaire-500 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
          sx={{ fontSize: 14 }}
        />
      </button>
      {open && (
        <div className="dark:bg-spaire-900 dark:border-spaire-700 border-t border-gray-100 bg-gray-50 px-3 py-2.5">
          <dl className="space-y-1.5 text-xs">
            <div className="flex gap-2">
              <dt className="dark:text-spaire-500 w-24 shrink-0 text-gray-400">Interpreted as</dt>
              <dd className="dark:text-spaire-300 text-gray-700">{debug.interpretation_note}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="dark:text-spaire-500 w-24 shrink-0 text-gray-400">Intent</dt>
              <dd className="dark:text-spaire-300 font-mono text-gray-700">{debug.plan_intent}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="dark:text-spaire-500 w-24 shrink-0 text-gray-400">Queries</dt>
              <dd className="dark:text-spaire-300 font-mono text-gray-700">
                {debug.queries_executed.join(', ')}
              </dd>
            </div>
            {debug.warnings.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-yellow-500">Warnings</dt>
                <dd className="text-yellow-400">{debug.warnings.join('; ')}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Insight bubble — structured insight inside the assistant message
// ---------------------------------------------------------------------------

const InsightBubble = ({
  insight,
  onFollowup,
}: {
  insight: InsightResponse
  onFollowup: (q: string) => void
}) => (
  <div className="flex flex-col gap-4">
    {/* Answer + confidence */}
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="dark:text-spaire-50 text-base font-medium text-gray-900">{insight.answer}</p>
      <ConfidencePill level={insight.confidence} />
    </div>

    {/* Bullets */}
    {insight.summary_bullets.length > 0 && (
      <ul className="space-y-1">
        {insight.summary_bullets.map((b, i) => (
          <li key={i} className="dark:text-spaire-400 flex items-start gap-1.5 text-sm text-gray-600">
            <span className="dark:text-spaire-600 mt-0.5 text-[10px] text-gray-400">•</span>
            {b}
          </li>
        ))}
      </ul>
    )}

    {/* Drivers */}
    {insight.drivers.length > 0 && (
      <div>
        <p className="dark:text-spaire-400 mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          Top Drivers
        </p>
        <div className="dark:border-spaire-700 dark:divide-spaire-700 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100">
          {insight.drivers.map((d, i) => (
            <div key={d.key} className="dark:bg-spaire-900 bg-white px-3">
              <DriverRow driver={d} rank={i + 1} />
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Actions */}
    {insight.recommended_actions.length > 0 && (
      <div>
        <p className="dark:text-spaire-400 mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          Recommended Actions
        </p>
        <div className="dark:bg-spaire-900 dark:border-spaire-700 rounded-lg border border-gray-100 bg-white px-3">
          {insight.recommended_actions.map((a, i) => (
            <ActionRow key={i} action={a} />
          ))}
        </div>
      </div>
    )}

    {/* Follow-ups */}
    {insight.followup_questions.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {insight.followup_questions.map((q) => (
          <button
            key={q}
            onClick={() => onFollowup(q)}
            className="dark:bg-spaire-800 dark:border-spaire-700 dark:text-spaire-300 dark:hover:bg-spaire-700 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50"
          >
            {q}
          </button>
        ))}
      </div>
    )}

    {/* Provenance */}
    <ProvenanceAccordion insight={insight} />
  </div>
)

// ---------------------------------------------------------------------------
// Single message row
// ---------------------------------------------------------------------------

const MessageRow = ({
  message,
  onFollowup,
}: {
  message: Message
  onFollowup: (q: string) => void
}) => {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5">
          <p className="text-sm text-white">{message.text}</p>
        </div>
      </div>
    )
  }

  if (message.role === 'error') {
    return (
      <div className="flex justify-start">
        <div className="dark:bg-spaire-900 dark:border-spaire-700 max-w-[85%] rounded-2xl rounded-tl-sm border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-500">{message.text}</p>
        </div>
      </div>
    )
  }

  // assistant
  return (
    <div className="flex items-start gap-3">
      <div className="dark:bg-spaire-800 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
        <AutoGraphOutlined className="dark:text-spaire-300 text-gray-500" sx={{ fontSize: 14 }} />
      </div>
      <div className="dark:bg-spaire-900 dark:border-spaire-700 min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-4">
        <InsightBubble insight={message.insight} onFollowup={onFollowup} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thinking indicator
// ---------------------------------------------------------------------------

const ThinkingRow = () => (
  <div className="flex items-start gap-3">
    <div className="dark:bg-spaire-800 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
      <AutoGraphOutlined className="dark:text-spaire-300 text-gray-500" sx={{ fontSize: 14 }} />
    </div>
    <div className="dark:bg-spaire-900 dark:border-spaire-700 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-4">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="dark:bg-spaire-500 h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = ({ onSelect }: { onSelect: (q: string) => void }) => (
  <div className="flex h-full flex-col items-center justify-center gap-8 py-16">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="dark:bg-spaire-800 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <AutoGraphOutlined className="dark:text-spaire-300 text-gray-500" />
      </div>
      <p className="dark:text-spaire-100 text-lg font-medium text-gray-900">
        Revenue Intelligence
      </p>
      <p className="dark:text-spaire-500 max-w-sm text-sm text-gray-500">
        Ask anything about your revenue. Get structured insights with numbers,
        drivers, and recommended actions.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STARTER_PROMPTS.map(({ label, question }) => (
        <button
          key={label}
          onClick={() => onSelect(question)}
          className="dark:bg-spaire-900 dark:border-spaire-700 dark:text-spaire-300 dark:hover:bg-spaire-800 flex flex-col items-start gap-1 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:bg-gray-50"
        >
          <span className="dark:text-spaire-500 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {label}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400">{question}</span>
        </button>
      ))}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Composer (input bar)
// ---------------------------------------------------------------------------

const Composer = ({
  onSubmit,
  isLoading,
}: {
  onSubmit: (q: string) => void
  isLoading: boolean
}) => {
  const [value, setValue] = useState('')

  const submit = () => {
    const q = value.trim()
    if (!q || isLoading) return
    setValue('')
    onSubmit(q)
  }

  return (
    <div className="dark:border-spaire-700 dark:bg-spaire-950 border-t border-gray-200 bg-white px-4 py-3">
      <div className="dark:bg-spaire-900 dark:border-spaire-700 flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Ask about your revenue…"
          disabled={isLoading}
          className="dark:text-spaire-50 flex-1 resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 disabled:opacity-50"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={submit}
          disabled={!value.trim() || isLoading}
          className="dark:bg-spaire-700 dark:hover:bg-spaire-600 mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors hover:bg-gray-700 disabled:opacity-30"
        >
          <ArrowUpwardOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>
      <p className="dark:text-spaire-600 mt-1.5 text-center text-[11px] text-gray-400">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IntelligencePage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const { mutate, isPending } = useIntelligenceQuery()

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    scrollToBottom()
  }, [messages, isPending])

  const handleQuestion = (question: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: question }])

    mutate(
      {
        question,
        organization_id: organization.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onSuccess: (insight) => {
          setMessages((prev) => [...prev, { role: 'assistant', insight }])
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: 'error', text: 'Something went wrong. Please try again.' },
          ])
        },
      },
    )
  }

  const isEmpty = messages.length === 0 && !isPending

  return (
    <DashboardBody
      className="!p-0"
      wrapperClassName="flex flex-col overflow-hidden"
    >
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-2xl">
          {isEmpty ? (
            <EmptyState onSelect={handleQuestion} />
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((msg, i) => (
                <MessageRow key={i} message={msg} onFollowup={handleQuestion} />
              ))}
              {isPending && <ThinkingRow />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer pinned to bottom */}
      <div className="mx-auto w-full max-w-2xl">
        <Composer onSubmit={handleQuestion} isLoading={isPending} />
      </div>
    </DashboardBody>
  )
}
