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
import AutoGraphOutlined from '@mui/icons-material/AutoGraphOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined'
import TrendingFlatOutlined from '@mui/icons-material/TrendingFlatOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// ---------------------------------------------------------------------------
// Starter prompts
// ---------------------------------------------------------------------------

const STARTER_PROMPTS = [
  {
    label: 'Revenue drop',
    question: 'Why did revenue drop last week?',
    icon: '📉',
  },
  {
    label: 'Churn drivers',
    question: 'Where is churn coming from?',
    icon: '🔄',
  },
  {
    label: 'Top products',
    question: 'What are my top-performing products this month?',
    icon: '🏆',
  },
  {
    label: 'MRR breakdown',
    question: 'Break down MRR by product.',
    icon: '📊',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (cents: number): string => {
  const abs = Math.abs(cents) / 100
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`
  return cents < 0 ? `–${s}` : s
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

type Msg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; insight: InsightResponse }
  | { role: 'error'; text: string }

// ---------------------------------------------------------------------------
// Confidence badge — uses existing app semantic colors
// ---------------------------------------------------------------------------

const ConfidenceBadge = ({ level }: { level: InsightResponse['confidence'] }) => {
  const styles = {
    high: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-400',
    medium: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
    low: 'bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400',
  }
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[level],
      )}
    >
      {level} confidence
    </span>
  )
}

// ---------------------------------------------------------------------------
// Driver table row
// ---------------------------------------------------------------------------

const DriverRow = ({ driver, rank }: { driver: InsightDriver; rank: number }) => {
  const isDown = driver.delta < 0
  const isFlat = driver.delta === 0
  const share = Math.round(Math.abs(driver.share_of_total_change) * 100)

  return (
    <div className="dark:border-spaire-800 flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className="dark:text-spaire-600 w-4 shrink-0 text-right text-xs tabular-nums text-gray-400">
        {rank}
      </span>
      {isFlat ? (
        <TrendingFlatOutlined className="dark:text-spaire-500 shrink-0 text-gray-400" sx={{ fontSize: 14 }} />
      ) : isDown ? (
        <TrendingDownOutlined className="shrink-0 text-red-500" sx={{ fontSize: 14 }} />
      ) : (
        <TrendingUpOutlined className="shrink-0 text-emerald-500" sx={{ fontSize: 14 }} />
      )}
      <span className="dark:text-spaire-100 min-w-0 flex-1 truncate text-sm text-gray-900">
        {driver.key}
      </span>
      <span
        className={twMerge(
          'shrink-0 text-sm font-medium tabular-nums',
          isDown ? 'text-red-500 dark:text-red-400' : isFlat ? 'dark:text-spaire-400 text-gray-500' : 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {fmt(driver.delta)}
      </span>
      <div className="dark:bg-spaire-800 h-1 w-14 shrink-0 overflow-hidden rounded-full bg-gray-200">
        <div
          className={twMerge(
            'h-full rounded-full',
            isDown ? 'bg-red-400' : 'bg-emerald-400',
          )}
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
      <span className="dark:text-spaire-600 w-7 shrink-0 text-right text-[11px] tabular-nums text-gray-400">
        {share}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action row
// ---------------------------------------------------------------------------

const ActionRow = ({ action }: { action: InsightAction }) => {
  const dotColor = {
    low: 'bg-emerald-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
  }[action.effort]

  return (
    <div className="dark:border-spaire-800 flex items-start gap-3 border-b border-gray-100 py-3 last:border-0">
      <span className={twMerge('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dotColor)} />
      <div className="min-w-0 flex-1">
        <p className="dark:text-spaire-100 text-sm text-gray-900">{action.action}</p>
        <p className="dark:text-spaire-500 mt-0.5 text-xs text-gray-500">{action.why}</p>
        {action.estimated_impact && (
          <p className="mt-0.5 text-xs text-blue-500 dark:text-blue-400">
            {action.estimated_impact}
          </p>
        )}
      </div>
      {action.requires_human_approval && (
        <span className="dark:bg-spaire-800 dark:text-spaire-400 mt-0.5 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
          needs approval
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data provenance accordion
// ---------------------------------------------------------------------------

const Provenance = ({ insight }: { insight: InsightResponse }) => {
  const [open, setOpen] = useState(false)
  const { debug } = insight

  return (
    <div className="dark:border-spaire-800 overflow-hidden rounded-xl border border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="dark:hover:bg-spaire-800 flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
      >
        <span className="dark:text-spaire-500 text-xs text-gray-400">
          Data provenance · {debug.time_range}
          {debug.baseline_range ? ` vs ${debug.baseline_range}` : ''}
        </span>
        <ExpandMoreOutlined
          className={twMerge(
            'dark:text-spaire-500 text-gray-400 transition-transform',
            open ? 'rotate-180' : '',
          )}
          sx={{ fontSize: 14 }}
        />
      </button>

      {open && (
        <div className="dark:border-spaire-800 border-t border-gray-100 px-4 py-3">
          <dl className="space-y-1.5 text-xs">
            <div className="flex gap-3">
              <dt className="dark:text-spaire-500 w-24 shrink-0 text-gray-400">Interpreted as</dt>
              <dd className="dark:text-spaire-300 text-gray-700">{debug.interpretation_note}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="dark:text-spaire-500 w-24 shrink-0 text-gray-400">Intent</dt>
              <dd className="dark:text-spaire-300 font-mono text-gray-700">{debug.plan_intent}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="dark:text-spaire-500 w-24 shrink-0 text-gray-400">Queries</dt>
              <dd className="dark:text-spaire-300 font-mono text-gray-700">
                {debug.queries_executed.join(', ')}
              </dd>
            </div>
            {debug.warnings.length > 0 && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-yellow-500">Warnings</dt>
                <dd className="text-yellow-500">{debug.warnings.join('; ')}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Structured insight inside the assistant bubble
// ---------------------------------------------------------------------------

const InsightContent = ({
  insight,
  onFollowup,
}: {
  insight: InsightResponse
  onFollowup: (q: string) => void
}) => (
  <div className="flex flex-col gap-5">
    {/* Answer + confidence */}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="dark:text-spaire-50 text-base font-medium leading-snug text-gray-900">
        {insight.answer}
      </p>
      <ConfidenceBadge level={insight.confidence} />
    </div>

    {/* Summary bullets */}
    {insight.summary_bullets.length > 0 && (
      <ul className="flex flex-col gap-1.5">
        {insight.summary_bullets.map((b, i) => (
          <li
            key={i}
            className="dark:text-spaire-400 flex items-start gap-2 text-sm text-gray-600"
          >
            <span className="dark:text-spaire-600 mt-px shrink-0 text-[10px] text-gray-400">
              ▸
            </span>
            {b}
          </li>
        ))}
      </ul>
    )}

    {/* Drivers */}
    {insight.drivers.length > 0 && (
      <div>
        <p className="dark:text-spaire-500 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Top Drivers
        </p>
        <div className="dark:border-spaire-800 overflow-hidden rounded-xl border border-gray-100">
          {insight.drivers.map((d, i) => (
            <div key={d.key} className="dark:bg-spaire-900 bg-white px-4">
              <DriverRow driver={d} rank={i + 1} />
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Actions */}
    {insight.recommended_actions.length > 0 && (
      <div>
        <p className="dark:text-spaire-500 mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Recommended Actions
        </p>
        <div className="dark:border-spaire-800 overflow-hidden rounded-xl border border-gray-100">
          {insight.recommended_actions.map((a, i) => (
            <div key={i} className="dark:bg-spaire-900 bg-white px-4">
              <ActionRow action={a} />
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Follow-up questions */}
    {insight.followup_questions.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {insight.followup_questions.map((q) => (
          <button
            key={q}
            onClick={() => onFollowup(q)}
            className="dark:bg-spaire-900 dark:border-spaire-700 dark:text-spaire-300 dark:hover:border-spaire-500 dark:hover:text-spaire-100 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            {q}
          </button>
        ))}
      </div>
    )}

    {/* Provenance */}
    <Provenance insight={insight} />
  </div>
)

// ---------------------------------------------------------------------------
// Single message
// ---------------------------------------------------------------------------

const MessageRow = ({
  msg,
  onFollowup,
}: {
  msg: Msg
  onFollowup: (q: string) => void
}) => {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 shadow-xs">
          <p className="text-sm leading-relaxed text-white">{msg.text}</p>
        </div>
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className="flex justify-start">
        <div className="dark:border-spaire-800 max-w-[85%] rounded-2xl rounded-tl-sm border border-red-100 bg-red-50/60 px-4 py-3 dark:bg-red-950/30">
          <p className="text-sm text-red-500">{msg.text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div className="dark:bg-spaire-800 dark:border-spaire-700 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-xs">
        <AutoGraphOutlined
          className="dark:text-spaire-300 text-gray-500"
          sx={{ fontSize: 15 }}
        />
      </div>

      {/* Content card */}
      <div className="dark:bg-spaire-900 dark:border-spaire-700 min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-5 py-4 shadow-xs">
        <InsightContent insight={msg.insight} onFollowup={onFollowup} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thinking dots
// ---------------------------------------------------------------------------

const Thinking = () => (
  <div className="flex items-start gap-3">
    <div className="dark:bg-spaire-800 dark:border-spaire-700 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-xs">
      <AutoGraphOutlined
        className="dark:text-spaire-300 text-gray-500"
        sx={{ fontSize: 15 }}
      />
    </div>
    <div className="dark:bg-spaire-900 dark:border-spaire-700 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-5 py-4 shadow-xs">
      <div className="flex items-center gap-1">
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
// Empty / welcome state
// ---------------------------------------------------------------------------

const WelcomeState = ({ onSelect }: { onSelect: (q: string) => void }) => (
  <div className="flex h-full flex-col items-center justify-center gap-10 py-12 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="dark:bg-spaire-900 dark:border-spaire-700 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-xs">
        <AutoGraphOutlined className="dark:text-spaire-300 text-gray-500" />
      </div>
      <h2 className="text-xl font-medium dark:text-white">Revenue Intelligence</h2>
      <p className="dark:text-spaire-500 max-w-sm text-sm text-gray-500">
        Ask anything about your revenue in plain English. Get structured
        answers with drivers, recommended actions, and full data provenance.
      </p>
    </div>

    <div className="grid w-full max-w-lg grid-cols-2 gap-3">
      {STARTER_PROMPTS.map(({ icon, label, question }) => (
        <button
          key={label}
          onClick={() => onSelect(question)}
          className="dark:bg-spaire-900 dark:border-spaire-700 dark:text-spaire-200 dark:hover:border-spaire-500 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-xs transition-all hover:border-gray-300 hover:shadow-md"
        >
          <span className="text-lg">{icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
            <p className="dark:text-spaire-500 mt-0.5 text-xs text-gray-500">{question}</p>
          </div>
        </button>
      ))}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Composer — pinned to bottom, transparent background to match page
// ---------------------------------------------------------------------------

const Composer = ({
  onSubmit,
  disabled,
}: {
  onSubmit: (q: string) => void
  disabled: boolean
}) => {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const q = value.trim()
    if (!q || disabled) return
    setValue('')
    onSubmit(q)
    // Reset height after clear
    if (ref.current) ref.current.style.height = 'auto'
  }

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    /* Transparent outer — inherits the DashboardBody dark:bg-spaire-900 */
    <div className="dark:border-spaire-800 border-t border-gray-100 px-4 py-3 md:px-8">
      <div className="dark:bg-spaire-800 dark:border-spaire-700 flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 transition-shadow focus-within:shadow-sm">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            autoGrow(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Ask about your revenue…"
          disabled={disabled}
          className="dark:text-spaire-50 flex-1 resize-none bg-transparent text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!value.trim() || disabled}
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUpwardOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>
      <p className="dark:text-spaire-600 mt-2 text-center text-[11px] text-gray-400">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntelligencePage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const { mutate, isPending } = useIntelligenceQuery()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isPending])

  const ask = (question: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: question }])
    mutate(
      {
        question,
        organization_id: organization.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onSuccess: (insight) =>
          setMessages((prev) => [...prev, { role: 'assistant', insight }]),
        onError: () =>
          setMessages((prev) => [
            ...prev,
            {
              role: 'error',
              text: 'Something went wrong. Please try again.',
            },
          ]),
      },
    )
  }

  const isEmpty = messages.length === 0 && !isPending

  return (
    <DashboardBody
      title={null}
      className="!p-0"
      wrapperClassName="!gap-0 !pt-0 flex flex-col overflow-hidden"
    >
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-2xl">
          {isEmpty ? (
            <WelcomeState onSelect={ask} />
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((msg, i) => (
                <MessageRow key={i} msg={msg} onFollowup={ask} />
              ))}
              {isPending && <Thinking />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer — pinned */}
      <div className="mx-auto w-full max-w-2xl">
        <Composer onSubmit={ask} disabled={isPending} />
      </div>
    </DashboardBody>
  )
}
