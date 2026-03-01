'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  InsightAction,
  InsightDriver,
  InsightResponse,
  useIntelligenceQuery,
} from '@/hooks/queries/intelligence'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import KeyboardReturnOutlined from '@mui/icons-material/KeyboardReturnOutlined'
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (cents: number): string => {
  const abs = Math.abs(cents) / 100
  const s = abs >= 10000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`
  return cents < 0 ? `–${s}` : `+${s}`
}

const pct = (n: number) =>
  `${n >= 0 ? '+' : '–'}${Math.abs(n).toFixed(1)}%`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Msg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; insight: InsightResponse }
  | { role: 'error'; text: string }

// ---------------------------------------------------------------------------
// Confidence label — understated, inline
// ---------------------------------------------------------------------------

const Confidence = ({ level }: { level: InsightResponse['confidence'] }) => {
  const styles = {
    high: 'text-emerald-600 dark:text-emerald-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-red-500 dark:text-red-400',
  }[level]

  return (
    <span className={twMerge('text-xs font-medium', styles)}>
      {level} confidence
    </span>
  )
}

// ---------------------------------------------------------------------------
// Driver table — financial-style, no cards
// ---------------------------------------------------------------------------

const DriverTable = ({ drivers }: { drivers: InsightDriver[] }) => (
  <div className="flex flex-col">
    {drivers.map((d, i) => {
      const isDown = d.delta < 0
      const share = Math.min(Math.abs(d.share_of_total_change) * 100, 100)

      return (
        <div
          key={d.key}
          className="dark:border-spaire-800 grid grid-cols-[1.25rem_1fr_4rem_5rem_2.5rem] items-center gap-3 border-b border-gray-100 py-2.5 text-sm last:border-0"
        >
          <span className="dark:text-spaire-600 text-xs tabular-nums text-gray-400">
            {i + 1}
          </span>
          <span className="dark:text-spaire-100 truncate text-gray-900">{d.key}</span>
          <span
            className={twMerge(
              'text-right text-xs tabular-nums font-medium',
              isDown
                ? 'text-red-500 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {fmt(d.delta)}
          </span>
          <div className="dark:bg-spaire-700 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={twMerge(
                'h-full rounded-full',
                isDown ? 'bg-red-400/70' : 'bg-emerald-400/70',
              )}
              style={{ width: `${share}%` }}
            />
          </div>
          <span className="dark:text-spaire-500 text-right text-[11px] tabular-nums text-gray-400">
            {Math.round(share)}%
          </span>
        </div>
      )
    })}
  </div>
)

// ---------------------------------------------------------------------------
// Action list — simple, no decoration
// ---------------------------------------------------------------------------

const ActionList = ({ actions }: { actions: InsightAction[] }) => {
  const effortColor = {
    low: 'text-emerald-600 dark:text-emerald-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-red-500 dark:text-red-400',
  }

  return (
    <div className="flex flex-col">
      {actions.map((a, i) => (
        <div
          key={i}
          className="dark:border-spaire-800 flex flex-col gap-0.5 border-b border-gray-100 py-2.5 last:border-0"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p className="dark:text-spaire-100 text-sm text-gray-900">{a.action}</p>
            <span
              className={twMerge(
                'shrink-0 text-xs',
                effortColor[a.effort],
              )}
            >
              {a.effort}
            </span>
          </div>
          <p className="dark:text-spaire-500 text-xs text-gray-500">{a.why}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section — minimal label + content
// ---------------------------------------------------------------------------

const Section = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-1">
    <p className="dark:text-spaire-500 text-[11px] font-medium uppercase tracking-widest text-gray-400">
      {label}
    </p>
    {children}
  </div>
)

// ---------------------------------------------------------------------------
// Provenance — collapsed by default, very subtle
// ---------------------------------------------------------------------------

const Provenance = ({ insight }: { insight: InsightResponse }) => {
  const [open, setOpen] = useState(false)
  const { debug } = insight

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="dark:text-spaire-600 dark:hover:text-spaire-400 flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
      >
        <UnfoldMoreOutlined sx={{ fontSize: 12 }} />
        {debug.time_range}
        {debug.baseline_range ? ` vs ${debug.baseline_range}` : ''}
        {open ? ' · hide' : ' · show queries'}
      </button>

      {open && (
        <div className="dark:border-spaire-800 mt-2 border-l border-gray-200 pl-3">
          <dl className="flex flex-col gap-1 text-[11px]">
            <div className="flex gap-2">
              <dt className="dark:text-spaire-600 w-20 shrink-0 text-gray-400">
                Interpreted
              </dt>
              <dd className="dark:text-spaire-400 text-gray-600">
                {debug.interpretation_note}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="dark:text-spaire-600 w-20 shrink-0 text-gray-400">
                Intent
              </dt>
              <dd className="dark:text-spaire-400 font-mono text-gray-600">
                {debug.plan_intent}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="dark:text-spaire-600 w-20 shrink-0 text-gray-400">
                Queries
              </dt>
              <dd className="dark:text-spaire-400 font-mono text-gray-600">
                {debug.queries_executed.join(', ')}
              </dd>
            </div>
            {debug.warnings.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-yellow-500">Warnings</dt>
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
// Full insight content
// ---------------------------------------------------------------------------

const InsightContent = ({
  insight,
  onFollowup,
}: {
  insight: InsightResponse
  onFollowup: (q: string) => void
}) => (
  <div className="flex flex-col gap-5">
    {/* Answer headline */}
    <div className="flex flex-col gap-1.5">
      <p className="dark:text-spaire-50 text-[15px] font-medium leading-snug text-gray-900">
        {insight.answer}
      </p>
      <Confidence level={insight.confidence} />
    </div>

    {/* Summary bullets */}
    {insight.summary_bullets.length > 0 && (
      <ul className="flex flex-col gap-1">
        {insight.summary_bullets.map((b, i) => (
          <li
            key={i}
            className="dark:text-spaire-400 flex items-start gap-2 text-sm leading-relaxed text-gray-600"
          >
            <span className="dark:text-spaire-700 mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
            {b}
          </li>
        ))}
      </ul>
    )}

    {/* Drivers */}
    {insight.drivers.length > 0 && (
      <Section label="Top drivers">
        <DriverTable drivers={insight.drivers} />
      </Section>
    )}

    {/* Actions */}
    {insight.recommended_actions.length > 0 && (
      <Section label="Recommended actions">
        <ActionList actions={insight.recommended_actions} />
      </Section>
    )}

    {/* Follow-ups */}
    {insight.followup_questions.length > 0 && (
      <div className="dark:border-spaire-800 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {insight.followup_questions.map((q) => (
          <button
            key={q}
            onClick={() => onFollowup(q)}
            className="dark:text-spaire-400 dark:hover:text-spaire-100 text-xs text-gray-500 underline-offset-2 transition-colors hover:text-gray-900 hover:underline"
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
// Message rows
// ---------------------------------------------------------------------------

const UserMsg = ({ text }: { text: string }) => (
  <div className="flex justify-end">
    <div className="max-w-[68%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5">
      <p className="text-sm leading-relaxed text-white">{text}</p>
    </div>
  </div>
)

const AssistantMsg = ({
  insight,
  onFollowup,
}: {
  insight: InsightResponse
  onFollowup: (q: string) => void
}) => (
  // Uses the exact same bg as the Card atom: dark:bg-spaire-800 bg-gray-100 rounded-4xl
  <div className="dark:bg-spaire-800 rounded-4xl bg-gray-100 px-6 py-5">
    <InsightContent insight={insight} onFollowup={onFollowup} />
  </div>
)

const ErrorMsg = ({ text }: { text: string }) => (
  <div className="dark:bg-spaire-800 rounded-4xl bg-gray-100 px-6 py-4">
    <p className="text-sm text-red-500">{text}</p>
  </div>
)

const Thinking = () => (
  <div className="dark:bg-spaire-800 flex items-center gap-1.5 rounded-4xl bg-gray-100 px-6 py-5">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="dark:bg-spaire-500 h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
        style={{ animationDelay: `${i * 120}ms` }}
      />
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// Welcome / empty state — text only, no cards, no emojis
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'Why did revenue drop last week?',
  'Where is churn coming from?',
  'Break down MRR by product.',
  'What are my top-performing products this month?',
]

const Welcome = ({ onSelect }: { onSelect: (q: string) => void }) => (
  <div className="flex h-full flex-col items-start justify-end gap-8 pb-8 md:items-center md:justify-center md:pb-0">
    <div className="flex max-w-sm flex-col gap-2">
      <p className="text-2xl font-medium dark:text-white">
        Revenue Intelligence
      </p>
      <p className="dark:text-spaire-500 text-sm leading-relaxed text-gray-500">
        Ask a question about your revenue. Get answers backed by your data —
        with drivers, actions, and full provenance.
      </p>
    </div>

    <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-spaire-800">
      {SUGGESTIONS.map((q, i) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className={twMerge(
            'dark:text-spaire-300 dark:hover:bg-spaire-800 flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50',
            i > 0 && 'dark:border-spaire-800 border-t border-gray-100',
          )}
        >
          <span>{q}</span>
          <KeyboardReturnOutlined
            className="dark:text-spaire-600 shrink-0 text-gray-300"
            sx={{ fontSize: 14 }}
          />
        </button>
      ))}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const Composer = ({
  onSubmit,
  disabled,
}: {
  onSubmit: (q: string) => void
  disabled: boolean
}) => {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const q = value.trim()
    if (!q || disabled) return
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSubmit(q)
  }

  return (
    <div className="dark:border-spaire-800 border-t border-gray-100 px-4 py-4 md:px-8">
      {/* Input area — same bg as Card: dark:bg-spaire-800 bg-gray-100 */}
      <div className="dark:bg-spaire-800 flex items-end gap-2 rounded-2xl bg-gray-100 px-4 py-3">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Ask about your revenue…"
          disabled={disabled}
          className="dark:text-spaire-50 flex-1 resize-none bg-transparent text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 disabled:opacity-50"
          onChange={(e) => {
            setValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <Button
          size="icon"
          disabled={!value.trim() || disabled}
          onClick={submit}
          className="mb-0.5 shrink-0"
        >
          <ArrowUpwardOutlined sx={{ fontSize: 16 }} />
        </Button>
      </div>
      <p className="dark:text-spaire-700 mt-2 text-center text-[11px] text-gray-400">
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

  return (
    <DashboardBody
      title={null}
      className="!p-0"
      wrapperClassName="!gap-0 !pt-0 flex flex-col overflow-hidden"
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {messages.length === 0 && !isPending && (
            <Welcome onSelect={ask} />
          )}
          {messages.map((msg, i) => {
            if (msg.role === 'user') return <UserMsg key={i} text={msg.text} />
            if (msg.role === 'error') return <ErrorMsg key={i} text={msg.text} />
            return (
              <AssistantMsg key={i} insight={msg.insight} onFollowup={ask} />
            )
          })}
          {isPending && <Thinking />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="mx-auto w-full max-w-2xl">
        <Composer onSubmit={ask} disabled={isPending} />
      </div>
    </DashboardBody>
  )
}
