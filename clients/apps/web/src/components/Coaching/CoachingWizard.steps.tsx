'use client'

// Coaching-shaped wizard step components. Reuses the SpaireOnboardingStyles
// CSS layer + StepShell from the course wizard so visuals + transitions
// match. The fields, copy, and validation are coaching-specific.

import { StepShell } from '@/components/Courses/CourseWizard.steps'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'

// Same shape the course pricing step uses — keeps the form provider
// compatible across both wizards.
type WizardPricingForm = {
  recurring_interval: schemas['SubscriptionRecurringInterval'] | null
  recurring_interval_count: number | null
  prices: Array<{
    id?: string
    amount_type?: 'fixed' | 'free' | 'custom' | 'seat_based' | 'metered_unit'
    price_currency?: schemas['PresentmentCurrency']
    price_amount?: number | null
  }>
}

// ── Step 1: Coach ───────────────────────────────────────────────────────────

export type CoachState = {
  name: string
  bio: string
  focus: string
}

export function StepCoach({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: CoachState
  onChange: (next: CoachState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepShell
      step={1}
      total={5}
      title="About you, the coach"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={!data.name.trim() || !data.focus.trim()}
    >
      <div className="so-fields">
        <div className="so-field">
          <label className="so-label">Coach name</label>
          <input
            className="so-input"
            type="text"
            placeholder="e.g. Lena Park"
            autoFocus
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
          />
        </div>
        <div className="so-field">
          <label className="so-label">Coaching focus / niche</label>
          <input
            className="so-input"
            type="text"
            placeholder="e.g. 1:1 sales coaching for early-stage SaaS founders"
            value={data.focus}
            onChange={(e) => onChange({ ...data, focus: e.target.value })}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                data.name.trim() &&
                data.focus.trim()
              )
                onNext()
            }}
          />
          <span className="so-hint">
            One sentence. The AI uses this to pitch the program in the
            cohort&apos;s actual language.
          </span>
        </div>
        <div className="so-field">
          <label className="so-label">Short bio</label>
          <textarea
            className="so-textarea"
            rows={3}
            placeholder="What you've actually done. Years coaching, companies built, results shipped."
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value })}
          />
          <span className="so-hint">
            Optional but recommended — grounds the AI&apos;s landing copy.
          </span>
        </div>
      </div>
    </StepShell>
  )
}

// ── Step 2: Program ─────────────────────────────────────────────────────────

export type ProgramState = {
  title: string
  transformation: string
  audience: string
  weeks: number
}

export function StepProgram({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: ProgramState
  onChange: (next: ProgramState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepShell
      step={2}
      total={5}
      title="Shape the program"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={
        !data.title.trim() ||
        !data.transformation.trim() ||
        !data.audience.trim() ||
        data.weeks < 1 ||
        data.weeks > 26
      }
    >
      <div className="so-fields">
        <div className="so-field">
          <label className="so-label">Program title</label>
          <input
            className="so-input"
            type="text"
            placeholder="e.g. The Wedge — find your unfair advantage in 8 weeks"
            autoFocus
            value={data.title}
            onChange={(e) => onChange({ ...data, title: e.target.value })}
          />
        </div>
        <div className="so-field">
          <label className="so-label">The transformation</label>
          <textarea
            className="so-textarea"
            rows={2}
            placeholder="By the end, what will the cohort be able to do that they can't do today? Be concrete."
            value={data.transformation}
            onChange={(e) =>
              onChange({ ...data, transformation: e.target.value })
            }
          />
          <span className="so-hint">
            The headline promise. &quot;Walk into investor meetings with a
            deck that survives a 90-second flip&quot; beats &quot;Become a
            better fundraiser&quot;.
          </span>
        </div>
        <div className="so-field">
          <label className="so-label">Target client</label>
          <input
            className="so-input"
            type="text"
            placeholder="e.g. Pre-seed founders who've stalled at seed"
            value={data.audience}
            onChange={(e) => onChange({ ...data, audience: e.target.value })}
          />
          <span className="so-hint">
            Describe the situation, not the demographic. The more specific,
            the better the AI nails your landing page.
          </span>
        </div>
        <div className="so-field">
          <label className="so-label">Length (weeks)</label>
          <input
            className="so-input"
            type="number"
            min={1}
            max={26}
            value={data.weeks}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              onChange({
                ...data,
                weeks: Number.isFinite(v)
                  ? Math.max(1, Math.min(26, v))
                  : data.weeks,
              })
            }}
            style={{ maxWidth: 120 }}
          />
          <span className="so-hint">
            One live group call per week. 4–12 is the sweet spot for cohort
            programs.
          </span>
        </div>
      </div>
    </StepShell>
  )
}

// ── Step 3: Schedule ────────────────────────────────────────────────────────

const DAYS = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
] as const

export type ScheduleState = {
  // YYYY-MM-DD — first session date in the coach's local timezone.
  startDate: string
  // 0 (Sunday) .. 6 (Saturday). Pre-fills from startDate but user can change
  // (the start date will then advance to the next matching day).
  dayOfWeek: number
  // 24h "HH:MM"
  time: string
  // Per-session length in minutes
  durationMinutes: number
  // IANA timezone string from the browser
  timezone: string
}

const DEFAULT_TIME = '18:00'
const DEFAULT_DURATION = 60

const todayPlus = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function defaultScheduleState(): ScheduleState {
  // Default: next Wednesday at 18:00 local
  const d = new Date()
  const todayDow = d.getDay()
  const offsetToWed = (3 - todayDow + 7) % 7 || 7
  d.setDate(d.getDate() + offsetToWed)
  return {
    startDate: d.toISOString().slice(0, 10),
    dayOfWeek: 3,
    time: DEFAULT_TIME,
    durationMinutes: DEFAULT_DURATION,
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

// Compute the N session datetimes (ISO strings, UTC) from the schedule
// state and a week count.
export function computeSessionDatetimes(
  schedule: ScheduleState,
  weeks: number,
): string[] {
  const out: string[] = []
  const [hh, mm] = schedule.time.split(':').map((n) => parseInt(n, 10) || 0)
  // Seed the first session date. Interpret the date string as local-time
  // and apply the time-of-day; toISOString() then converts to UTC.
  const [y, m, day] = schedule.startDate
    .split('-')
    .map((n) => parseInt(n, 10))
  let cursor = new Date(y, (m ?? 1) - 1, day ?? 1, hh, mm, 0, 0)
  // If the first date isn't on the chosen day-of-week, advance to the next
  // matching day (otherwise the first session would shift the whole cadence).
  while (cursor.getDay() !== schedule.dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1)
  }
  for (let i = 0; i < weeks; i++) {
    const at = new Date(cursor)
    at.setDate(at.getDate() + i * 7)
    out.push(at.toISOString())
  }
  return out
}

export function StepSchedule({
  data,
  onChange,
  weeks,
  onNext,
  onBack,
  onClose,
}: {
  data: ScheduleState
  onChange: (next: ScheduleState) => void
  weeks: number
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  const sessions = computeSessionDatetimes(data, weeks)
  const previewFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return (
    <StepShell
      step={3}
      total={5}
      title="Set the cadence"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={!data.startDate || !data.time}
    >
      <div className="so-fields">
        <div className="so-field">
          <label className="so-label">First session date</label>
          <input
            className="so-input"
            type="date"
            min={todayPlus(0)}
            value={data.startDate}
            onChange={(e) =>
              onChange({ ...data, startDate: e.target.value })
            }
            style={{ maxWidth: 200 }}
          />
          <span className="so-hint">
            Cohort meets weekly on this day from this date forward.
          </span>
        </div>
        <div className="so-field">
          <label className="so-label">Day of week</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DAYS.map((d) => {
              const active = data.dayOfWeek === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onChange({ ...data, dayOfWeek: d.id })}
                  className="so-pill"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--so-border)',
                    background: active ? 'var(--so-ink)' : 'var(--so-white)',
                    color: active ? 'var(--so-white)' : 'var(--so-ink)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
        <div
          className="so-field"
          style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="so-label">Time</label>
            <input
              className="so-input"
              type="time"
              value={data.time}
              onChange={(e) => onChange({ ...data, time: e.target.value })}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="so-label">Duration (minutes)</label>
            <input
              className="so-input"
              type="number"
              min={15}
              max={240}
              step={15}
              value={data.durationMinutes}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                onChange({
                  ...data,
                  durationMinutes: Number.isFinite(v)
                    ? Math.max(15, Math.min(240, v))
                    : data.durationMinutes,
                })
              }}
            />
          </div>
        </div>
        <div className="so-field">
          <span
            className="so-hint"
            style={{ fontSize: 12, color: 'var(--so-gray4)' }}
          >
            Timezone: {data.timezone}
          </span>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            background: 'var(--so-surface)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--so-gray4)',
              marginBottom: 8,
            }}
          >
            Schedule preview ({weeks} {weeks === 1 ? 'session' : 'sessions'})
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {sessions.slice(0, 8).map((iso, i) => (
              <li
                key={iso}
                style={{
                  fontSize: 13,
                  color: 'var(--so-ink)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: 'var(--so-gray4)',
                    minWidth: 56,
                  }}
                >
                  Week {i + 1}
                </span>
                <span>{previewFmt.format(new Date(iso))}</span>
              </li>
            ))}
            {sessions.length > 8 && (
              <li
                style={{
                  fontSize: 12,
                  color: 'var(--so-gray4)',
                  marginTop: 4,
                }}
              >
                + {sessions.length - 8} more
              </li>
            )}
          </ul>
        </div>
      </div>
    </StepShell>
  )
}

// ── Step 4: Pricing (slim coaching variant) ─────────────────────────────────
//
// Coaching pricing is simpler than course pricing: no paywall toggle, no
// free-preview-lessons knob (program is bought as a whole). Customer
// decides one-time vs subscription and a price.

export function StepPricingCoaching({
  organization,
  onNext,
  onBack,
  onClose,
}: {
  organization: schemas['Organization']
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  const { watch, setValue, getValues } = useFormContext<WizardPricingForm>()
  const recurringInterval = watch('recurring_interval')
  const prices = watch('prices') ?? []
  const cycle: 'onetime' | 'recurring' =
    recurringInterval == null ? 'onetime' : 'recurring'
  const defaultCurrency = organization.default_presentment_currency ?? 'usd'

  const setCycle = (next: 'onetime' | 'recurring') => {
    if (next === 'onetime') {
      setValue('recurring_interval', null)
      setValue('recurring_interval_count', null)
    } else {
      setValue('recurring_interval', recurringInterval ?? 'month')
      setValue('recurring_interval_count', 1)
    }
  }

  const priceCents = prices[0]?.price_amount ?? 0
  const setPriceCents = (cents: number) => {
    const current = getValues('prices') ?? []
    const c = current[0]?.price_currency ?? defaultCurrency
    setValue('prices', [
      {
        amount_type: 'fixed',
        price_currency: c as schemas['PresentmentCurrency'],
        price_amount: Math.max(0, Math.round(cents)),
      },
    ])
  }

  const dollars = (priceCents / 100).toFixed(2)

  return (
    <StepShell
      step={4}
      total={5}
      title="Pricing"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={priceCents <= 0}
    >
      <div className="so-fields">
        <div className="so-field">
          <label className="so-label">Billing</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCycle('onetime')}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid var(--so-border)',
                background:
                  cycle === 'onetime' ? 'var(--so-ink)' : 'var(--so-white)',
                color:
                  cycle === 'onetime' ? 'var(--so-white)' : 'var(--so-ink)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => setCycle('recurring')}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid var(--so-border)',
                background:
                  cycle === 'recurring' ? 'var(--so-ink)' : 'var(--so-white)',
                color:
                  cycle === 'recurring' ? 'var(--so-white)' : 'var(--so-ink)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Subscription
            </button>
          </div>
          <span className="so-hint">
            Pick one-time for a single cohort program; subscription if
            customers keep paying for ongoing access.
          </span>
        </div>
        <div className="so-field">
          <label className="so-label">
            Price ({(prices[0]?.price_currency ?? defaultCurrency).toUpperCase()})
          </label>
          <input
            className="so-input"
            type="number"
            min={0}
            step="0.01"
            value={dollars}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setPriceCents(Number.isFinite(v) ? v * 100 : 0)
            }}
            style={{ maxWidth: 200 }}
          />
          <span className="so-hint">
            Cohort programs typically sit between $499 and $4,999.
          </span>
        </div>
      </div>
    </StepShell>
  )
}

// ── Step 5: Review (last screen before publish) ─────────────────────────────
//
// Read-only summary of every choice the coach made. The publish button is
// always enabled — there's no AI gate, no async validation. Clicking
// publish moves to the creating screen which kicks off product/course/
// events creation (and best-effort AI landing generation in parallel).

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

const formatPrice = (cents: number, currency: string): string => {
  const dollars = cents / 100
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(dollars)
}

export function StepReview({
  program,
  coach,
  schedule,
  sessions,
  priceCents,
  priceCurrency,
  billingCycle,
  onPublish,
  onBack,
  onClose,
}: {
  program: ProgramState
  coach: CoachState
  schedule: ScheduleState
  sessions: string[]
  priceCents: number
  priceCurrency: string
  billingCycle: 'onetime' | 'recurring'
  onPublish: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepShell
      step={5}
      total={5}
      title="Review and publish"
      onNext={onPublish}
      onBack={onBack}
      onClose={onClose}
      nextLabel="Publish program"
    >
      <div className="so-fields">
        <ReviewBlock label="Program">
          <ReviewRow label="Title" value={program.title || '—'} />
          <ReviewRow
            label="Transformation"
            value={program.transformation || '—'}
          />
          <ReviewRow label="Audience" value={program.audience || '—'} />
          <ReviewRow
            label="Length"
            value={`${program.weeks} ${program.weeks === 1 ? 'week' : 'weeks'}`}
          />
        </ReviewBlock>

        <ReviewBlock label="Coach">
          <ReviewRow label="Name" value={coach.name || '—'} />
          <ReviewRow label="Niche" value={coach.focus || '—'} />
        </ReviewBlock>

        <ReviewBlock label="Schedule">
          <ReviewRow
            label="First session"
            value={
              sessions[0]
                ? `${formatDate(sessions[0])} at ${schedule.time}`
                : '—'
            }
          />
          <ReviewRow
            label="Cadence"
            value={`Weekly · ${schedule.durationMinutes} min`}
          />
          <ReviewRow label="Timezone" value={schedule.timezone} />
          <ReviewRow
            label="Sessions"
            value={`${sessions.length} live calls`}
          />
        </ReviewBlock>

        <ReviewBlock label="Pricing">
          <ReviewRow
            label="Price"
            value={
              priceCents > 0
                ? `${formatPrice(priceCents, priceCurrency)}${
                    billingCycle === 'recurring' ? ' / month' : ''
                  }`
                : '—'
            }
          />
          <ReviewRow
            label="Billing"
            value={
              billingCycle === 'recurring' ? 'Subscription' : 'One-time'
            }
          />
        </ReviewBlock>

        <p
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: 'var(--so-surface)',
            color: 'var(--so-gray4)',
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          Once you publish, we&apos;ll write a landing page draft for you
          (you can rewrite or replace it from the Customize tab) and create
          all {sessions.length} sessions on the dates above with placeholder
          titles. Edit each session&apos;s title, agenda, and join link from
          the Events tab.
        </p>
      </div>
    </StepShell>
  )
}

function ReviewBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--so-border)',
        background: 'var(--so-white)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--so-gray4)',
        }}
      >
        {label}
      </span>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        {children}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 12,
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--so-gray4)' }}>{label}</span>
      <span style={{ color: 'var(--so-ink)' }}>{value}</span>
    </div>
  )
}
