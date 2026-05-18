'use client'

import {
  SpaireOnboardingStyles as SharedStyles,
  StepShell,
} from '../Courses/CourseWizard.steps'
import { useEffect, useState } from 'react'

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
// Three modes. UI ports the course wizard's pricing language but
// drops the checkout preview + comparison features per the design
// brief. The choice persists on the wizard state — Phase 9 wires it
// to a Product + newsletter_access benefit.

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
  const showPriceRow = pricing.mode !== 'free'
  return (
    <StepShell
      step={2}
      total={2}
      title="How should subscribers pay?"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextLabel="Create newsletter"
    >
      <div className="so-pricing-modes">
        <ModeCard
          active={pricing.mode === 'free'}
          onPick={() => onChange({ ...pricing, mode: 'free' })}
          title="Free"
          desc="Anyone with an email can subscribe. No paywall."
        />
        <ModeCard
          active={pricing.mode === 'both'}
          onPick={() => onChange({ ...pricing, mode: 'both' })}
          title="Free + Paid"
          desc="Free issues for everyone; paid issues + paywall blocks for subscribers."
          recommended
        />
        <ModeCard
          active={pricing.mode === 'paid'}
          onPick={() => onChange({ ...pricing, mode: 'paid' })}
          title="Paid only"
          desc="Every issue requires a paid subscription to read."
        />
      </div>

      {showPriceRow && (
        <div className="so-price-row">
          <div className="so-price-label">Paid tier</div>
          <div className="so-price-controls">
            <div className="so-price-input">
              <span className="so-price-currency">
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
              />
            </div>
            <select
              className="so-price-interval"
              value={pricing.paidInterval ?? 'one-time'}
              onChange={(e) => {
                const v = e.target.value
                onChange({
                  ...pricing,
                  paidInterval:
                    v === 'one-time' ? null : (v as 'month' | 'year'),
                })
              }}
            >
              <option value="month">per month</option>
              <option value="year">per year</option>
              <option value="one-time">one-time</option>
            </select>
          </div>
          <div className="so-price-hint">
            Subscribers pay this through Polar checkout. You can change
            it or add other currencies later.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 18,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'oklch(0.96 0.04 25)',
            color: 'oklch(0.4 0.16 25)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <PricingStyles />
    </StepShell>
  )
}

function ModeCard({
  active,
  onPick,
  title,
  desc,
  recommended,
}: {
  active: boolean
  onPick: () => void
  title: string
  desc: string
  recommended?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`so-mode ${active ? 'so-mode--active' : ''}`}
    >
      <div className="so-mode-head">
        <span className="so-mode-title">{title}</span>
        {recommended && (
          <span className="so-mode-rec">Recommended</span>
        )}
      </div>
      <div className="so-mode-desc">{desc}</div>
    </button>
  )
}

function PricingStyles() {
  return (
    <style jsx global>{`
      .so-pricing-modes {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 24px;
      }
      .so-mode {
        text-align: left;
        padding: 16px 18px;
        background: var(--so-white, #fff);
        border: 1.5px solid var(--so-gray2, #e8e8e8);
        border-radius: 12px;
        cursor: pointer;
        font-family: inherit;
        color: var(--so-black, #0a0a0a);
        transition:
          border-color 0.15s,
          background 0.15s,
          box-shadow 0.15s;
      }
      .so-mode:hover {
        border-color: #c8c8c8;
      }
      .so-mode--active {
        border-color: var(--so-black, #0a0a0a);
        box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.07);
      }
      .so-mode-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .so-mode-title {
        font-size: 15px;
        font-weight: 600;
      }
      .so-mode-rec {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--so-gray4, #6a6a6a);
        background: var(--so-gray1, #f4f4f4);
        padding: 2px 7px;
        border-radius: 4px;
      }
      .so-mode-desc {
        font-size: 13px;
        line-height: 1.45;
        color: var(--so-gray4, #6a6a6a);
      }

      .so-price-row {
        padding: 16px 18px;
        background: var(--so-gray1, #f4f4f4);
        border-radius: 12px;
        margin-bottom: 8px;
      }
      .so-price-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--so-gray4, #6a6a6a);
        margin-bottom: 10px;
      }
      .so-price-controls {
        display: flex;
        gap: 8px;
        align-items: stretch;
      }
      .so-price-input {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--so-white, #fff);
        border: 1.5px solid var(--so-gray2, #e8e8e8);
        border-radius: 10px;
        padding: 0 12px;
      }
      .so-price-input:focus-within {
        border-color: oklch(0.62 0.21 265);
      }
      .so-price-currency {
        font-size: 12px;
        font-weight: 600;
        color: var(--so-gray4, #6a6a6a);
        letter-spacing: 0.04em;
      }
      .so-price-input input {
        flex: 1;
        height: 44px;
        border: none;
        outline: none;
        background: transparent;
        font-family: inherit;
        font-size: 15px;
        color: var(--so-black, #0a0a0a);
        -webkit-appearance: none;
        appearance: none;
      }
      .so-price-input input::-webkit-outer-spin-button,
      .so-price-input input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .so-price-interval {
        height: 44px;
        padding: 0 14px;
        background: var(--so-white, #fff);
        border: 1.5px solid var(--so-gray2, #e8e8e8);
        border-radius: 10px;
        font-family: inherit;
        font-size: 14px;
        color: var(--so-black, #0a0a0a);
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        padding-right: 28px;
        background-image:
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath fill='%236a6a6a' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        background-size: 8px;
      }
      .so-price-hint {
        margin-top: 10px;
        font-size: 12px;
        color: var(--so-gray4, #6a6a6a);
        line-height: 1.45;
      }
    `}</style>
  )
}

// Re-export StepShell for callers that want it. Currently unused
// outside this file but kept for parity with the courses module's
// export surface.
export { StepShell }
