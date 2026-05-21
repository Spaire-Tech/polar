'use client'

import {
  SpaireOnboardingStyles as SharedStyles,
  StepShell,
} from '../Courses/CourseWizard.steps'
import { Label } from '@spaire/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@spaire/ui/components/ui/radio-group'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// Re-export the shared CSS so NewsletterWizard.tsx only has to import
// one symbol. The styles are global (style jsx global) and scoped via
// `.spaire-onboarding` on the parent — re-using them keeps the two
// flows visually identical.
export const SpaireOnboardingStyles = SharedStyles

export type NewsletterInfoState = {
  name: string
  desc: string
}

export type PricingState = {
  mode: 'free' | 'paid' | 'both'
  paidAmount: number // cents
  paidInterval: 'month' | 'year' | null // null = one-time
  currency: string
}

// ─── Intro ───────────────────────────────────────────────────────────
//
// Same staggered letter-stagger animation the course wizard uses
// (CourseWizard.steps.Intro). Parallel cadence to "Sell your
// expertise" but pitched at the writing audience.

const INTRO_WORDS = ['Write', 'what', 'only', 'you', 'can']
const STAGGER_MS = 56

export function Intro({
  onNext,
  onClose,
}: {
  onNext: () => void
  onClose: () => void
}) {
  const [started, setStarted] = useState(false)

  const chars: { ch: string; delay: number }[] = []
  let idx = 0
  INTRO_WORDS.forEach((word) => {
    word.split('').forEach((ch) => {
      chars.push({ ch, delay: idx * STAGGER_MS })
      idx++
    })
  })
  const lastDelay = chars[chars.length - 1].delay

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Auto-advance after the last letter lands + a beat. Matches the
  // total course intro budget so onboarding doesn't drag.
  useEffect(() => {
    if (!started) return
    const total = lastDelay + 520 + 700
    const t = setTimeout(() => onNext(), total)
    return () => clearTimeout(t)
  }, [started, lastDelay, onNext])

  const wordGroups: (typeof chars)[] = []
  let ci = 0
  INTRO_WORDS.forEach((word) => {
    wordGroups.push(chars.slice(ci, ci + word.length))
    ci += word.length
  })

  return (
    <>
      <MiniTopBar onClose={onClose} />
      <div className="so-intro-stage">
        <h1 className="so-intro-headline">
          {wordGroups.map((group, wi) => (
            <span key={wi} className="so-intro-word">
              {group.map((c, li) => (
                <span
                  key={li}
                  className="so-intro-letter"
                  style={
                    started
                      ? {
                          animation: `soLetterUp 0.52s cubic-bezier(0.22,1,0.36,1) ${c.delay}ms forwards`,
                        }
                      : {}
                  }
                >
                  {c.ch}
                </span>
              ))}
            </span>
          ))}
        </h1>
      </div>
    </>
  )
}

// A trimmed top-bar shown on the intro screen only (no step counter
// since the user hasn't entered the wizard proper yet). StepShell
// handles the full top-bar for the editable steps.
function MiniTopBar({ onClose }: { onClose: () => void }) {
  return (
    <header className="so-topbar">
      <div className="so-logo">Spaire</div>
      <button
        type="button"
        className="so-close"
        onClick={onClose}
        aria-label="Close"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  )
}

// ─── Step 1: Newsletter info ─────────────────────────────────────────

export function StepInfo({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: NewsletterInfoState
  onChange: (next: NewsletterInfoState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepShell
      step={1}
      total={2}
      title="Name your newsletter"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={!data.name.trim()}
    >
      <div className="so-fields">
        <label className="so-field">
          <input
            className="so-input"
            type="text"
            placeholder=" "
            autoFocus
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && data.name.trim()) onNext()
            }}
            maxLength={200}
          />
          <span className="so-label">Newsletter name</span>
        </label>
        <label className="so-field so-field--multiline">
          <textarea
            className="so-textarea"
            rows={3}
            placeholder=" "
            value={data.desc}
            onChange={(e) => onChange({ ...data, desc: e.target.value })}
            maxLength={500}
          />
          <span className="so-label">Short description</span>
        </label>
      </div>
      <div className="so-hint">
        You can change all of this from the newsletter&apos;s settings page later.
      </div>
    </StepShell>
  )
}


// ─── Step 2: Pricing ─────────────────────────────────────────────────
//
// Mirrors the course wizard's pricing step (StepPricingWizard in
// CourseWizard.steps.tsx) — same `wide` StepShell, same PFSection
// eyebrow/title/description pattern, same RadioGroup with Label
// cards, same colour tokens. We deliberately DROP the live checkout
// preview pane the course step has (per the brief "minus the
// preview"), so the form column gets the full width.

export function StepPricing({
  pricing,
  onChange,
  onNext,
  onBack,
  onClose,
  error,
}: {
  pricing: PricingState
  onChange: (next: PricingState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
  error?: string | null
}) {
  return (
    <StepShell
      step={2}
      total={2}
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextLabel="Create newsletter"
      wide
    >
      <div className="spaire-wizard-pricing-nl">
        <main className="pf-main-nl">
          <div className="pf-form-col-nl">
            {/* PRICING TIER */}
            <PFSection
              eyebrow="Pricing"
              title="Free or paid?"
              description="Spaire newsletters can be free for everyone, paid behind a subscription, or a mix of both. You can change this any time from settings."
            >
              <RadioGroup
                value={pricing.mode}
                onValueChange={(v) =>
                  onChange({ ...pricing, mode: v as PricingState['mode'] })
                }
                className="grid grid-cols-1 gap-4 md:grid-cols-3"
              >
                {(
                  [
                    {
                      value: 'free',
                      title: 'Free',
                      desc: 'Anyone with an email can subscribe. No paywall, no checkout.',
                    },
                    {
                      value: 'both',
                      title: 'Free + Paid',
                      desc: "Free issues for everyone; paid issues + paywalled posts for subscribers. Substack's model.",
                      recommended: true,
                    },
                    {
                      value: 'paid',
                      title: 'Paid only',
                      desc: 'Every issue requires a paid subscription to read.',
                    },
                  ] as const
                ).map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`pf-mode-${opt.value}`}
                    className={twMerge(
                      'flex cursor-pointer flex-col gap-3 rounded-2xl border border-[1.5px] p-5 font-normal transition-colors',
                      pricing.mode === opt.value
                        ? 'border-[oklch(0.62_0.21_265)] bg-gray-50'
                        : 'border-gray-100 text-gray-500 hover:border-gray-200',
                    )}
                  >
                    <div className="flex items-center gap-2.5 font-medium">
                      <RadioGroupItem
                        value={opt.value}
                        id={`pf-mode-${opt.value}`}
                      />
                      {opt.title}
                      {'recommended' in opt && opt.recommended && (
                        <span className="ml-auto rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-gray-500">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{opt.desc}</p>
                  </Label>
                ))}
              </RadioGroup>
            </PFSection>

            {/* PAID DETAILS — only revealed for paid / both. Same
                billing-cycle radio cards as the course wizard, then a
                price input + currency display. */}
            {pricing.mode !== 'free' && (
              <PFSection
                eyebrow="Paid tier"
                title="How much, how often"
                description="Subscribers pay this through Polar checkout. Recurring is the norm for newsletters; one-time is for limited-run series or lifetime access."
              >
                <div className="flex w-full flex-col gap-10">
                  <RadioGroup
                    value={pricing.paidInterval === null ? 'onetime' : 'recurring'}
                    onValueChange={(v) => {
                      if (v === 'onetime') {
                        onChange({ ...pricing, paidInterval: null })
                      } else if (pricing.paidInterval === null) {
                        onChange({ ...pricing, paidInterval: 'month' })
                      }
                    }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {(
                      [
                        {
                          value: 'recurring',
                          title: 'Recurring',
                          desc: 'Charge subscribers on a regular schedule.',
                        },
                        {
                          value: 'onetime',
                          title: 'Pay once',
                          desc: 'One-time fee for ongoing access.',
                        },
                      ] as const
                    ).map((opt) => {
                      const active =
                        opt.value === 'onetime'
                          ? pricing.paidInterval === null
                          : pricing.paidInterval !== null
                      return (
                        <Label
                          key={opt.value}
                          htmlFor={`pf-cycle-${opt.value}`}
                          className={twMerge(
                            'flex cursor-pointer flex-col gap-3 rounded-2xl border border-[1.5px] p-5 font-normal transition-colors',
                            active
                              ? 'border-[oklch(0.62_0.21_265)] bg-gray-50'
                              : 'border-gray-100 text-gray-500 hover:border-gray-200',
                          )}
                        >
                          <div className="flex items-center gap-2.5 font-medium">
                            <RadioGroupItem
                              value={opt.value}
                              id={`pf-cycle-${opt.value}`}
                            />
                            {opt.title}
                          </div>
                          <p className="text-sm text-gray-500">{opt.desc}</p>
                        </Label>
                      )
                    })}
                  </RadioGroup>

                  <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-white px-3">
                        <span className="font-mono text-xs font-semibold uppercase text-gray-500">
                          {pricing.currency.toUpperCase()}
                        </span>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={(pricing.paidAmount / 100).toString()}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!Number.isNaN(v)) {
                              onChange({
                                ...pricing,
                                paidAmount: Math.round(v * 100),
                              })
                            }
                          }}
                          className="ml-3 h-11 flex-1 border-0 bg-transparent text-base text-gray-900 outline-none"
                        />
                      </div>
                      {pricing.paidInterval !== null && (
                        <select
                          value={pricing.paidInterval}
                          onChange={(e) =>
                            onChange({
                              ...pricing,
                              paidInterval: e.target.value as 'month' | 'year',
                            })
                          }
                          className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none"
                        >
                          <option value="month">per month</option>
                          <option value="year">per year</option>
                        </select>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      You can adjust the price or add other currencies from
                      the newsletter&apos;s settings later.
                    </p>
                  </div>
                </div>
              </PFSection>
            )}

            {error && (
              <div className="mx-0 mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </main>
      </div>

      <PricingStyles />
    </StepShell>
  )
}

// Local copy of the PFSection primitive from CourseWizard.steps. The
// course wizard doesn't export it; mirroring rather than refactoring
// keeps the courses module untouched and the two flows visually
// identical.
function PFSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="pf-section">
      <div className="pf-section-head">
        {eyebrow && <div className="pf-eyebrow">{eyebrow}</div>}
        <h2 className="pf-title">{title}</h2>
        {description && <p className="pf-desc">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  )
}

// CSS block ported from CourseWizard.steps's StepPricingWizard. Same
// design tokens, same .pf-main / .pf-section / .pf-eyebrow / .pf-title
// / .pf-desc / .pf-form-col scaffolding so the step proportions match
// the course flow byte-for-byte. We namespace under
// `.spaire-wizard-pricing-nl` to avoid clashing with the course
// version's classes when both screens happen to mount in the same
// session.
function PricingStyles() {
  return (
    <style jsx global>{`
      .spaire-wizard-pricing-nl {
        --bg: oklch(0.995 0.002 80);
        --surface: #ffffff;
        --surface-2: oklch(0.975 0.004 270);
        --ink: oklch(0.18 0.012 270);
        --ink-2: oklch(0.36 0.012 270);
        --muted: oklch(0.56 0.014 270);
        --muted-2: oklch(0.72 0.012 270);
        --hair: oklch(0.92 0.006 270);
        --accent: oklch(0.62 0.21 265);
        font-family: 'Poppins', system-ui, sans-serif;
        color: var(--ink);
      }
      .spaire-wizard-pricing-nl,
      .spaire-wizard-pricing-nl * {
        font-family: 'Poppins', system-ui, sans-serif;
      }
      .pf-main-nl {
        max-width: 760px;
        margin: 0 auto;
        padding: 12px 0 32px;
      }
      .pf-form-col-nl {
        min-width: 0;
      }
      .pf-main-nl .pf-section {
        padding-block: 36px;
        border-top: 1px solid var(--hair);
      }
      .pf-main-nl .pf-section:first-of-type {
        border-top: none;
        padding-top: 0;
      }
      .pf-main-nl .pf-section-head {
        margin-bottom: 24px;
      }
      .pf-main-nl .pf-eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: var(--muted-2);
        margin-bottom: 6px;
      }
      .pf-main-nl .pf-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0;
        letter-spacing: -0.3px;
        color: var(--ink);
      }
      .pf-main-nl .pf-desc {
        font-size: 13.5px;
        color: var(--muted);
        margin: 6px 0 0;
        max-width: 560px;
        line-height: 1.5;
      }
    `}</style>
  )
}
