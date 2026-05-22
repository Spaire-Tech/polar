'use client'

import { Upload } from '@/components/FileUpload/Upload'
import CloseIcon from '@mui/icons-material/Close'
import { enums, schemas } from '@spaire/client'
import MoneyInput from '@spaire/ui/components/atoms/MoneyInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@spaire/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@spaire/ui/components/atoms/Tabs'
import { Label } from '@spaire/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@spaire/ui/components/ui/radio-group'
import { PlusIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

// Local form type — the wizard's shared react-hook-form holds a discriminated
// `ProductCreate | ProductUpdate`, but we only touch a flat subset of fields
// (pricing, recurring, trial). Using a permissive local view sidesteps the
// union-narrowing pain while still matching the runtime shape exactly.
type WizardPricingForm = {
  recurring_interval: schemas['SubscriptionRecurringInterval'] | null
  recurring_interval_count: number | null
  trial_interval: schemas['TrialInterval'] | null
  trial_interval_count: number | null
  prices: Array<{
    id?: string
    amount_type?: 'fixed' | 'free' | 'custom' | 'seat_based' | 'metered_unit'
    price_currency?: schemas['PresentmentCurrency']
    price_amount?: number | null
  }>
}

// ─── Shared style block ───────────────────────────────────────────────────────

export function SpaireOnboardingStyles() {
  return (
    <style jsx global>{`
      .spaire-onboarding {
        --so-orange: #ff5c00;
        --so-black: #0a0a0a;
        --so-white: #ffffff;
        --so-gray1: #f4f4f4;
        --so-gray2: #e8e8e8;
        --so-gray3: #a0a0a0;
        --so-gray4: #6a6a6a;
        --so-bg: var(--so-white);
        --so-ink: var(--so-black);
        --so-ink2: var(--so-gray4);
        --so-ink3: var(--so-gray3);
        --so-surface: var(--so-gray1);
        --so-border: var(--so-gray2);
        --so-border-focus: var(--so-black);
        background: var(--so-bg);
        color: var(--so-ink);
        font-family: var(--font-poppins), system-ui, sans-serif;
        position: fixed;
        inset: 0;
        overflow-y: auto;
        z-index: 50;
      }
      .spaire-onboarding *,
      .spaire-onboarding *::before,
      .spaire-onboarding *::after {
        box-sizing: border-box;
      }
      .spaire-shell {
        position: relative;
        height: 100vh;
        width: 100vw;
        display: flex;
        flex-direction: column;
      }

      /* Top bar */
      .so-topbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 32px;
        z-index: 200;
      }
      .so-logo {
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: var(--so-black);
      }
      .so-step-counter {
        font-size: 12px;
        font-weight: 400;
        color: var(--so-gray3);
        letter-spacing: 0.02em;
      }
      .so-close {
        background: none;
        border: none;
        color: var(--so-gray3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        transition:
          color 0.15s,
          background 0.15s;
      }
      .so-close:hover {
        color: var(--so-black);
        background: rgba(10, 10, 10, 0.06);
      }

      /* Progress bar */
      .so-progress-track {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--so-gray2);
        z-index: 201;
      }
      .so-progress-fill {
        height: 100%;
        background: var(--so-black);
        transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Step stage */
      .so-stage {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 24px 100px;
        background: var(--so-white);
      }
      .so-screen {
        width: 100%;
        max-width: 440px;
        animation: soScreenIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes soScreenIn {
        from {
          opacity: 0;
          transform: translateY(24px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Typography */
      .so-eyebrow {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--so-gray3);
        margin-bottom: 14px;
      }
      .so-title {
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-weight: 700;
        font-size: clamp(28px, 4vw, 40px);
        line-height: 1.1;
        letter-spacing: -0.025em;
        color: var(--so-black);
        margin-bottom: 36px;
      }

      /* Fields — Apple-style floating label boxes (no grey fill, indigo focus). */
      .so-fields {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-bottom: 32px;
      }
      .so-field {
        position: relative;
        display: block;
        background: #ffffff;
        border: 1.5px solid var(--so-gray2);
        border-radius: 12px;
        transition: border-color 0.15s;
      }
      .so-field:focus-within {
        border-color: oklch(0.62 0.21 265);
      }
      .so-input,
      .so-textarea {
        width: 100%;
        padding: 22px 16px 10px 16px;
        background: transparent;
        border: 0;
        outline: 0;
        box-shadow: none;
        border-radius: inherit;
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-size: 16px;
        font-weight: 400;
        color: var(--so-black);
        -webkit-appearance: none;
      }
      .so-textarea {
        resize: none;
        line-height: 1.5;
        display: block;
      }
      .so-input::placeholder,
      .so-textarea::placeholder {
        color: transparent;
      }
      .so-label {
        position: absolute;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 16px;
        font-weight: 400;
        color: var(--so-gray3);
        letter-spacing: normal;
        text-transform: none;
        pointer-events: none;
        background: transparent;
        transition:
          transform 0.15s ease,
          font-size 0.15s ease,
          color 0.15s ease,
          top 0.15s ease;
      }
      /* Multi-line fields anchor the label to the top so it doesn't sit
         awkwardly in the middle of an empty textarea. */
      .so-field.so-field--multiline .so-label {
        top: 18px;
        transform: none;
      }
      /* Float the label up when the field is focused or the input has a
         value. We rely on the input's placeholder being a single space so
         :placeholder-shown only matches when the field is empty. */
      .so-input:focus ~ .so-label,
      .so-input:not(:placeholder-shown) ~ .so-label,
      .so-textarea:focus ~ .so-label,
      .so-textarea:not(:placeholder-shown) ~ .so-label {
        top: 10px;
        transform: none;
        font-size: 11px;
        color: var(--so-gray4);
        /* Mask any textarea content that scrolls up behind the label.
           Without this, long bios overlap the floated label text. */
        background: #ffffff;
        padding: 0 4px;
        margin-left: -4px;
      }
      .so-hint {
        font-size: 12px;
        color: var(--so-gray3);
        line-height: 1.5;
      }

      /* Buttons */
      .so-btn-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .so-btn-cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 13px 26px;
        background: var(--so-black);
        color: var(--so-white);
        border: none;
        border-radius: 100px;
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        letter-spacing: -0.01em;
        transition:
          opacity 0.18s,
          transform 0.15s;
      }
      .so-btn-cta:hover {
        opacity: 0.82;
        transform: translateY(-1px);
      }
      .so-btn-cta:active {
        transform: translateY(0);
      }
      .so-btn-cta:disabled {
        opacity: 0.25;
        pointer-events: none;
      }
      .so-btn-back {
        background: none;
        border: none;
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-size: 13px;
        color: var(--so-gray3);
        cursor: pointer;
        padding: 8px 0;
        transition: color 0.15s;
      }
      .so-btn-back:hover {
        color: var(--so-black);
      }

      /* Intro — fill the viewport and ignore the top bar so the headline
         sits in the true visual center. */
      .so-intro-stage {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--so-white);
        padding: 40px;
      }
      .so-intro-headline {
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-weight: 700;
        font-size: clamp(48px, 7vw, 88px);
        line-height: 1.08;
        letter-spacing: -0.03em;
        color: var(--so-black);
        display: flex;
        flex-wrap: wrap;
        gap: 0 0.22em;
        max-width: 800px;
      }
      .so-intro-word {
        display: inline-flex;
      }
      .so-intro-letter {
        display: inline-block;
        opacity: 0;
        transform: translateY(22px);
      }
      @keyframes soLetterUp {
        from {
          opacity: 0;
          transform: translateY(22px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Media cards */
      .so-media-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 32px;
      }
      .so-media-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 18px;
        background: var(--so-gray1);
        border: 1.5px solid var(--so-gray2);
        border-radius: 12px;
        cursor: pointer;
        transition:
          border-color 0.2s,
          background 0.2s,
          box-shadow 0.2s;
        text-align: left;
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        position: relative;
        font-family: var(--font-poppins), system-ui, sans-serif;
        color: var(--so-black);
      }
      .so-media-card:hover {
        border-color: #c8c8c8;
        background: #f0f0f0;
      }
      .so-media-card.selected {
        border-color: var(--so-black);
        background: var(--so-white);
        box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.07);
      }
      .so-media-icon {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: var(--so-gray2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: var(--so-gray4);
      }
      .so-media-icon svg {
        width: 18px;
        height: 18px;
      }
      .so-media-text {
        flex: 1;
      }
      .so-media-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--so-black);
        margin-bottom: 2px;
      }
      .so-media-sub {
        font-size: 12px;
        color: var(--so-gray3);
      }
      .so-media-check {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1.5px solid var(--so-gray2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition:
          border-color 0.2s,
          background 0.2s;
      }
      .so-media-card.selected .so-media-check {
        border-color: var(--so-black);
        background: var(--so-black);
      }
      .so-media-check svg {
        display: none;
      }
      .so-media-card.selected .so-media-check svg {
        display: block;
      }
      .so-upload-zone {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 16px 20px;
        background: var(--so-white);
        border: 1.5px solid var(--so-gray2);
        border-radius: 12px;
        cursor: pointer;
        font-size: 13px;
        color: var(--so-gray4);
        font-family: var(--font-poppins), system-ui, sans-serif;
        transition:
          border-color 0.2s,
          background 0.2s;
      }
      .so-upload-zone:hover {
        border-color: #b0b0b0;
        background: var(--so-gray1);
      }
    `}</style>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  step,
  total,
  onClose,
}: {
  step?: number
  total?: number
  onClose: () => void
}) {
  return (
    <div className="so-topbar">
      <div />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {step !== undefined && total !== undefined && (
          <div className="so-step-counter">
            {step} / {total}
          </div>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="so-close"
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>
      </div>
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="so-progress-track">
      <div className="so-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Intro screen ─────────────────────────────────────────────────────────────

const INTRO_WORDS = ['Sell', 'your', 'expertise']
const STAGGER_MS = 68

export function Intro({
  onNext,
  onClose,
}: {
  onNext: () => void
  onClose: () => void
}) {
  const [started, setStarted] = useState(false)

  // Build letter list with delays (no period)
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

  // Auto-advance after all letters land + pause
  useEffect(() => {
    if (!started) return
    const total = lastDelay + 520 + 700
    const t = setTimeout(() => onNext(), total)
    return () => clearTimeout(t)
  }, [started, lastDelay, onNext])

  // Rebuild word groups from chars
  const wordGroups: (typeof chars)[] = []
  let ci = 0
  INTRO_WORDS.forEach((word) => {
    wordGroups.push(chars.slice(ci, ci + word.length))
    ci += word.length
  })

  return (
    <>
      <TopBar onClose={onClose} />
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

// ─── Format chooser ───────────────────────────────────────────────────────────
//
// Same wizard chrome as the rest of onboarding (top progress bar, TopBar with
// step counter + close, so-stage / so-btn-cta / so-btn-back). The only thing
// custom on this step is the two-card grid; everything else slots into the
// existing visual language.
//
// Cover images live at:
//   /clients/apps/web/public/assets/course.jpg
//   /clients/apps/web/public/assets/series.jpg
// The CSS gradient + subject silhouette under each <img> is a graceful
// fallback: the <img> is held at opacity 0 until onLoad fires.

export type WizardFormat = 'course' | 'series'

type FormatOption = {
  id: WizardFormat
  badge: string
  title: string
  oneliner: string
  description: string
  bestFor: string[]
  example: string
  imageSrc: string
  tone: 'warm' | 'cool'
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'course',
    badge: 'COURSE',
    title: 'Structured',
    oneliner: 'Step-by-step skill building.',
    description:
      'Modules and lessons that progress from foundation to fluency.',
    bestFor: ['Skills', 'Frameworks', 'Outcomes'],
    example: 'Persuasive writing in 22 lessons.',
    imageSrc: '/assets/course.jpg',
    tone: 'warm',
  },
  {
    id: 'series',
    badge: 'SERIES',
    title: 'Narrative',
    oneliner: 'Episodic, in your voice.',
    description:
      'Self-contained episodes that orbit a single theme. Watched like a documentary.',
    bestFor: ['Mindset', 'Story', 'Identity', 'Behind the scenes'],
    example: 'An Olympian on the seven days before a final.',
    imageSrc: '/assets/series.jpg',
    tone: 'cool',
  },
]

function FormatHero({
  option,
  selected,
}: {
  option: FormatOption
  selected: boolean
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  return (
    <div className="fmt-hero">
      <div className={`fmt-grad-${option.tone}`} aria-hidden />
      <div className={`fmt-glow-${option.tone}`} aria-hidden />
      <div className={`fmt-subject fmt-${option.tone}`} aria-hidden>
        <div className="fmt-head" />
        <div className="fmt-body-silhouette" />
      </div>
      <div className="fmt-vignette" aria-hidden />

      <img
        src={option.imageSrc}
        alt=""
        aria-hidden
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageLoaded(false)}
        className="fmt-cover"
        style={{ opacity: imageLoaded ? 1 : 0 }}
      />

      <div className={`fmt-eyebrow fmt-${option.tone}`}>
        <span className="fmt-pip" />
        <span>{option.badge}</span>
      </div>
      <div className="fmt-check" data-selected={selected}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    </div>
  )
}

export function StepFormat({
  value,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  value: WizardFormat
  onChange: (next: WizardFormat) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <>
      <ProgressBar pct={(1 / 4) * 100} />
      <TopBar step={1} total={4} onClose={onClose} />
      <div className="so-stage so-stage--format">
        <div
          className="so-screen"
          style={{ maxWidth: 960, width: '100%' }}
        >
          <div className="fmt-header">
            <h2 className="fmt-title">Pick your format</h2>
            <p className="fmt-lede">
              Not all knowledge is step-based. Choose a Course if you&apos;re
              teaching a skill, a Series if you&apos;re sharing a story or a
              way of seeing the world.
            </p>
          </div>

          <div className="fmt-grid" role="radiogroup" aria-label="Format">
            {FORMAT_OPTIONS.map((opt) => {
              const selected = value === opt.id
              return (
                <button
                  type="button"
                  key={opt.id}
                  className="fmt-card"
                  role="radio"
                  aria-checked={selected}
                  data-selected={selected}
                  onClick={() => onChange(opt.id)}
                >
                  <FormatHero option={opt} selected={selected} />
                  <div className="fmt-card-body">
                    <div className="fmt-card-title">{opt.title}</div>
                    <div className="fmt-card-oneliner">{opt.oneliner}</div>
                    <p className="fmt-card-desc">{opt.description}</p>
                    <div className="fmt-hair" />
                    <div className="fmt-card-foot">
                      <div className="fmt-best-label">Best for</div>
                      <div className="fmt-tags">
                        {opt.bestFor.map((tag) => (
                          <span key={tag} className="fmt-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="fmt-example">
                        <span className="fmt-eg">e.g.</span> {opt.example}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="so-btn-row" style={{ marginTop: 24, justifyContent: 'center' }}>
            <button
              type="button"
              className="so-btn-cta"
              onClick={onNext}
              disabled={!value}
            >
              Continue
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M2.5 6.5h8M7 3l3.5 3.5L7 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button type="button" className="so-btn-back" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .so-stage--format {
          /* Pull the stage tight so header + cards + CTA fit a single
             viewport without scroll. Top accounts for the fixed TopBar
             (56px), bottom is just breathing room. */
          padding: 70px 24px 28px;
          min-height: 100vh;
        }
        .fmt-header {
          text-align: center;
          max-width: 560px;
          margin: 0 auto 44px;
        }
        .fmt-title {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(26px, 3.4vw, 36px);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: var(--so-black);
          margin: 0 0 8px;
          text-wrap: balance;
        }
        .fmt-lede {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--so-gray4);
          max-width: 520px;
          margin: 0 auto;
        }

        .fmt-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          width: 100%;
        }
        @media (max-width: 760px) {
          .fmt-grid {
            grid-template-columns: 1fr;
          }
        }

        .fmt-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid var(--so-gray2);
          overflow: hidden;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          color: inherit;
          text-align: left;
          appearance: none;
          transition:
            transform 200ms cubic-bezier(0.34, 1.3, 0.64, 1),
            box-shadow 200ms ease,
            border-color 200ms ease;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.03),
            0 6px 18px rgba(0, 0, 0, 0.04);
        }
        .fmt-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.04),
            0 14px 32px rgba(0, 0, 0, 0.08);
          border-color: var(--so-gray3);
        }
        .fmt-card[data-selected='true'] {
          border-color: var(--so-black);
          box-shadow:
            0 0 0 1.5px var(--so-black),
            0 14px 36px rgba(0, 0, 0, 0.1);
        }

        /* Hero — shrinks with viewport height so the whole card stays in
           view on shorter screens. Aspect kept loosely 16/9 but capped via
           max-height so a short viewport doesn't blow the card past the
           CTA. */
        .fmt-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: clamp(150px, 28vh, 240px);
          overflow: hidden;
          background: #000;
        }
        .fmt-grad-warm {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at 50% 28%,
            oklch(0.46 0.12 35) 0%,
            oklch(0.18 0.05 55) 55%,
            oklch(0.05 0.01 280) 100%
          );
        }
        .fmt-grad-cool {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at 50% 28%,
            oklch(0.42 0.13 250) 0%,
            oklch(0.18 0.06 270) 55%,
            oklch(0.05 0.01 280) 100%
          );
        }
        .fmt-glow-warm {
          position: absolute;
          left: -8%;
          top: 0;
          width: 55%;
          height: 70%;
          background: radial-gradient(
            ellipse,
            oklch(0.88 0.08 75 / 0.28) 0%,
            transparent 65%
          );
          filter: blur(30px);
        }
        .fmt-glow-cool {
          position: absolute;
          left: -8%;
          top: 0;
          width: 55%;
          height: 70%;
          background: radial-gradient(
            ellipse,
            oklch(0.85 0.1 220 / 0.26) 0%,
            transparent 65%
          );
          filter: blur(30px);
        }
        .fmt-vignette {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.12) 0%,
            rgba(0, 0, 0, 0) 35%,
            rgba(0, 0, 0, 0) 65%,
            rgba(0, 0, 0, 0.55) 100%
          );
          pointer-events: none;
        }
        .fmt-cover {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transition: opacity 240ms ease;
          z-index: 1;
        }
        .fmt-subject {
          position: absolute;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
          width: 60%;
          height: 78%;
          pointer-events: none;
        }
        .fmt-subject .fmt-head {
          position: absolute;
          left: 50%;
          top: 4%;
          transform: translateX(-50%);
          width: 30%;
          aspect-ratio: 1;
          border-radius: 50%;
        }
        .fmt-subject.fmt-warm .fmt-head {
          background: linear-gradient(180deg, oklch(0.5 0.05 35), oklch(0.32 0.04 35));
        }
        .fmt-subject.fmt-cool .fmt-head {
          background: linear-gradient(180deg, oklch(0.5 0.05 250), oklch(0.32 0.04 250));
        }
        .fmt-subject .fmt-body-silhouette {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 72%;
          clip-path: polygon(22% 0, 78% 0, 100% 100%, 0% 100%);
          border-radius: 46% 46% 0 0;
        }
        .fmt-subject.fmt-warm .fmt-body-silhouette {
          background: linear-gradient(180deg, oklch(0.3 0.04 35), oklch(0.1 0.02 35));
        }
        .fmt-subject.fmt-cool .fmt-body-silhouette {
          background: linear-gradient(180deg, oklch(0.3 0.04 250), oklch(0.1 0.02 250));
        }
        .fmt-eyebrow {
          position: absolute;
          right: 12px;
          top: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.85);
          z-index: 2;
        }
        .fmt-eyebrow .fmt-pip {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
        .fmt-eyebrow.fmt-warm .fmt-pip {
          background: oklch(0.72 0.16 25);
          box-shadow: 0 0 8px oklch(0.72 0.16 25);
        }
        .fmt-eyebrow.fmt-cool .fmt-pip {
          background: oklch(0.72 0.14 220);
          box-shadow: 0 0 8px oklch(0.72 0.14 220);
        }
        .fmt-check {
          position: absolute;
          top: 11px;
          left: 12px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.32);
          display: flex;
          align-items: center;
          justify-content: center;
          color: transparent;
          z-index: 2;
          transition: background 200ms ease, border-color 200ms ease;
        }
        .fmt-check svg {
          opacity: 0;
          transition: opacity 160ms ease;
        }
        .fmt-check[data-selected='true'] {
          background: white;
          border-color: white;
        }
        .fmt-check[data-selected='true'] svg {
          opacity: 1;
          color: var(--so-black);
        }

        /* Card body — tight padding so a short screen still fits the
           heading + lede + cards + CTA without scroll. */
        .fmt-card-body {
          padding: 16px 20px 18px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .fmt-card-title {
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1;
          color: var(--so-black);
          margin-bottom: 6px;
        }
        .fmt-card-oneliner {
          font-size: 13px;
          font-weight: 500;
          color: var(--so-gray4);
          letter-spacing: -0.005em;
          margin-bottom: 10px;
        }
        .fmt-card-desc {
          font-size: 12.5px;
          color: var(--so-ink);
          line-height: 1.5;
          margin: 0 0 14px;
          text-wrap: pretty;
        }
        .fmt-hair {
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--so-gray2) 18%,
            var(--so-gray2) 82%,
            transparent 100%
          );
          margin-bottom: 12px;
        }
        .fmt-card-foot {
          text-align: center;
          margin-top: auto;
        }
        .fmt-best-label {
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--so-gray3);
          margin-bottom: 8px;
        }
        .fmt-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          justify-content: center;
          margin-bottom: 10px;
        }
        .fmt-tag {
          font-size: 11px;
          color: var(--so-ink);
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 999px;
          background: oklch(0.97 0.002 280);
          border: 1px solid var(--so-gray2);
        }
        .fmt-example {
          font-size: 11.5px;
          color: var(--so-gray4);
          font-style: italic;
          line-height: 1.45;
          margin: 0;
        }
        .fmt-eg {
          font-style: normal;
          font-weight: 600;
          color: var(--so-gray3);
          margin-right: 4px;
          letter-spacing: 0.02em;
        }
      `}</style>
    </>
  )
}

// ─── Step shell ───────────────────────────────────────────────────────────────

export function StepShell({
  step,
  total,
  title,
  eyebrow,
  children,
  onNext,
  onBack,
  onClose,
  nextLabel = 'Continue',
  nextDisabled = false,
  wide = false,
}: {
  step: number
  total: number
  title?: string
  eyebrow?: string
  children: React.ReactNode
  onNext: () => void
  onBack: () => void
  onClose: () => void
  nextLabel?: string
  nextDisabled?: boolean
  // When true, drops the wizard eyebrow + so-title (the embedded section
  // renders its own heading) and widens the content container so canonical
  // product form sections fit naturally.
  wide?: boolean
}) {
  return (
    <>
      <ProgressBar pct={(step / total) * 100} />
      <TopBar step={step} total={total} onClose={onClose} />
      <div className="so-stage">
        <div
          className="so-screen"
          style={wide ? { maxWidth: 1200 } : undefined}
        >
          {!wide && (
            <>
              <div className="so-eyebrow">
                {eyebrow ?? `Step ${step} of ${total}`}
              </div>
              {title && <h2 className="so-title">{title}</h2>}
            </>
          )}
          {children}
          <div
            className="so-btn-row"
            style={wide ? { marginTop: 32 } : undefined}
          >
            <button
              type="button"
              className="so-btn-cta"
              disabled={nextDisabled}
              onClick={onNext}
            >
              {nextLabel}
              {nextLabel === 'Continue' && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M2.5 6.5h8M7 3l3.5 3.5L7 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <button type="button" className="so-btn-back" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Step 1: Instructor ───────────────────────────────────────────────────────

export function StepInstructor({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
  format = 'course',
}: {
  data: { name: string; bio: string }
  onChange: (next: { name: string; bio: string }) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
  format?: WizardFormat
}) {
  const isSeries = format === 'series'
  return (
    <StepShell
      step={2}
      total={4}
      title={isSeries ? 'Creator details' : 'Instructor details'}
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
          />
          <span className="so-label">
            {isSeries ? 'Creator name' : 'Instructor name'}
          </span>
        </label>
        <label className="so-field so-field--multiline">
          <textarea
            className="so-textarea"
            rows={5}
            placeholder=" "
            style={{ resize: 'vertical' }}
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value })}
          />
          <span className="so-label">
            {isSeries ? 'About you' : 'About you'}
          </span>
        </label>
        <span className="so-hint">
          Your background, experience, and what makes you the right person to
          teach this. The more you share, the more personalized your experience
          will be.
        </span>
      </div>
    </StepShell>
  )
}

// ─── Step 3: Course / Series details ─────────────────────────────────────────

export function StepCourse({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
  format = 'course',
}: {
  data: {
    title: string
    desc: string
    targetAudience: string
    differentiator: string
  }
  onChange: (next: {
    title: string
    desc: string
    targetAudience: string
    differentiator: string
  }) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
  format?: WizardFormat
}) {
  const isSeries = format === 'series'
  return (
    <StepShell
      step={3}
      total={4}
      title={isSeries ? 'Series details' : 'Course details'}
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={!data.title.trim()}
    >
      <div className="so-fields">
        <label className="so-field">
          <input
            className="so-input"
            type="text"
            placeholder=" "
            autoFocus
            value={data.title}
            onChange={(e) => onChange({ ...data, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && data.title.trim()) onNext()
            }}
          />
          <span className="so-label">
            {isSeries ? 'Series title' : 'Course title'}
          </span>
        </label>
        <label className="so-field so-field--multiline">
          <textarea
            className="so-textarea"
            rows={5}
            placeholder=" "
            style={{ resize: 'vertical' }}
            value={data.desc}
            onChange={(e) => onChange({ ...data, desc: e.target.value })}
          />
          <span className="so-label">
            {isSeries ? 'What is this series about?' : 'What is this course about?'}
          </span>
        </label>
        <label className="so-field so-field--multiline">
          <textarea
            className="so-textarea"
            rows={3}
            placeholder=" "
            style={{ resize: 'vertical' }}
            value={data.targetAudience}
            onChange={(e) =>
              onChange({ ...data, targetAudience: e.target.value })
            }
          />
          <span className="so-label">Who is this for?</span>
        </label>
        <label className="so-field so-field--multiline">
          <textarea
            className="so-textarea"
            rows={3}
            placeholder=" "
            style={{ resize: 'vertical' }}
            value={data.differentiator}
            onChange={(e) =>
              onChange({ ...data, differentiator: e.target.value })
            }
          />
          <span className="so-label">What makes your approach unique?</span>
        </label>
        <p className="so-hint">
          The last two fields are optional — but the more you share, the more
          personalized your landing page and curriculum will be.
        </p>
      </div>
    </StepShell>
  )
}

// ─── Step 3: Hero media ───────────────────────────────────────────────────────

type MediaState = {
  format: 'thumbnail' | 'trailer' | null
  thumbFile: File | null
  thumbName: string
  videoFile: File | null
  videoName: string
}

export function StepMedia({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: MediaState
  onChange: (next: MediaState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (data.format === 'thumbnail') {
      onChange({ ...data, thumbFile: f, thumbName: f.name })
    } else if (data.format === 'trailer') {
      onChange({ ...data, videoFile: f, videoName: f.name })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const options: {
    id: 'thumbnail' | 'trailer'
    label: string
    sub: string
    icon: React.ReactNode
  }[] = [
    {
      id: 'thumbnail',
      label: 'Thumbnail image',
      sub: 'JPG or PNG · 16:9 recommended',
      icon: (
        <svg viewBox="0 0 18 18" fill="none">
          <rect
            x="1.5"
            y="3"
            width="15"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle
            cx="6.5"
            cy="7.5"
            r="1.5"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M1.5 12l4-3.5 3 2.5 2.5-2 5 4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      id: 'trailer',
      label: 'Trailer video',
      sub: 'MP4 or MOV · 60s max',
      icon: (
        <svg viewBox="0 0 18 18" fill="none">
          <rect
            x="1.5"
            y="3"
            width="15"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M7 6.5l5 2.5-5 2.5V6.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ]

  return (
    <StepShell
      step={3}
      total={4}
      title="Hero media"
      eyebrow="Step 3 of 4 · Recommended"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextLabel="Continue"
    >
      <p
        style={{
          fontSize: 14,
          color: '#6a6a6a',
          margin: '-20px 0 24px',
          lineHeight: 1.6,
          fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        }}
      >
        A hero image or short trailer makes the landing page sell harder. You
        can skip this and add either later — Spaire will use a stylized
        placeholder for now.
      </p>
      <div className="so-media-options">
        {options.map((opt) => {
          const isSelected = data.format === opt.id
          const filename =
            opt.id === 'thumbnail' ? data.thumbName : data.videoName
          return (
            <button
              key={opt.id}
              type="button"
              className={`so-media-card${isSelected ? ' selected' : ''}`}
              onClick={() =>
                onChange({
                  ...data,
                  format: isSelected ? null : opt.id,
                })
              }
            >
              <div className="so-media-icon">{opt.icon}</div>
              <div className="so-media-text">
                <div className="so-media-title">{opt.label}</div>
                <div className="so-media-sub">{opt.sub}</div>
                {isSelected && filename && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6a6a6a',
                      marginTop: 3,
                    }}
                  >
                    {filename}
                  </div>
                )}
              </div>
              <div className="so-media-check">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path
                    d="M1 4l3 3 5-6"
                    stroke="#fff"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>
          )
        })}

        {data.format && (
          <label className="so-upload-zone">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 11V3M5 6l3-3 3 3"
                stroke="#a0a0a0"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"
                stroke="#c8c8c8"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span>
              {data.format === 'thumbnail'
                ? data.thumbName
                  ? `Replace · ${data.thumbName}`
                  : 'Upload thumbnail'
                : data.videoName
                  ? `Replace · ${data.videoName}`
                  : 'Upload trailer video'}
            </span>
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              accept={data.format === 'thumbnail' ? 'image/*' : 'video/*'}
              onChange={handleFile}
            />
          </label>
        )}
      </div>
    </StepShell>
  )
}

// ─── Step 3: Pricing & access — design ported from spaire/Product Flow.html ──
// Implementation matches the design exactly (indigo accent, live CheckoutPreview
// pane, MediaDrop, PriceRow with currency picker, Section primitives, Toggle).
// The only thing dropped from the source design is the top nav bar — wizard
// chrome (StepShell) provides its own progress bar and footer CTAs.

type CurrencyMeta = { code: string; symbol: string; name: string }

const SYMBOL_FALLBACKS: Record<string, string> = {
  xof: 'CFA',
  xaf: 'FCFA',
  xpf: 'CFP',
  xcd: 'EC$',
  xcg: 'Cg',
  ngn: '₦',
  ghs: 'GH₵',
  kes: 'KSh',
  zar: 'R',
  vuv: 'VT',
  cve: '$',
}

const buildCurrencyMeta = (code: string): CurrencyMeta => {
  const upper = code.toUpperCase()
  let symbol = SYMBOL_FALLBACKS[code] ?? upper
  let name = upper
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: upper,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1)
    const sym = parts.find((p) => p.type === 'currency')?.value
    if (sym && sym !== upper) symbol = sym
  } catch {}
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'currency' }).of(upper)
    if (dn) name = dn
  } catch {}
  return { code, symbol, name }
}

const CURRENCIES: CurrencyMeta[] = (
  enums.presentmentCurrencyValues as readonly string[]
)
  .map(buildCurrencyMeta)
  .sort((a, b) => {
    const featured = ['usd', 'eur', 'gbp', 'cad', 'aud', 'xof', 'ngn']
    const ai = featured.indexOf(a.code)
    const bi = featured.indexOf(b.code)
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    }
    return a.code.localeCompare(b.code)
  })

const ZERO_DECIMAL_FACTOR = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])
const decFactor = (code: string) => (ZERO_DECIMAL_FACTOR.has(code) ? 1 : 100)
const toMinor = (input: string, currency: string): number => {
  const n = Number.parseFloat(input)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * decFactor(currency))
}
const fromMinor = (
  amount: number | null | undefined,
  currency: string,
): string => {
  if (amount == null) return ''
  const f = decFactor(currency)
  if (f === 1) return String(amount)
  return (amount / f).toFixed(2)
}

// ── Section primitive (from components.jsx) ────────────────────────────────
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

// ── Segmented (from components.jsx) ────────────────────────────────────────
function PFSegmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="pf-seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`pf-seg-btn${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── ChoiceCard (from components.jsx) ───────────────────────────────────────
function PFChoiceCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      className={`pf-choice${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="pf-choice-row">
        <span className="pf-choice-radio">
          <span className="pf-choice-radio-dot" />
        </span>
        <span className="pf-choice-title">{title}</span>
      </span>
      <span className="pf-choice-desc">{description}</span>
    </button>
  )
}

// ── Currency tabs — clone of CurrencyTabs in ProductPricingSection ──────────
function CourseCurrencyTabs({
  activeCurrencies,
  selectedCurrency,
  onSelectCurrency,
  onAddCurrency,
  onRemoveCurrency,
  defaultCurrency,
}: {
  activeCurrencies: string[]
  selectedCurrency: string
  onSelectCurrency: (currency: string) => void
  onAddCurrency: (currency: string) => void
  onRemoveCurrency: (currency: string) => void
  defaultCurrency: string
}) {
  const availableCurrencies = enums.presentmentCurrencyValues.filter(
    (c: string) => !activeCurrencies.includes(c),
  )
  return (
    <div className="flex flex-row items-center gap-2">
      <Tabs value={selectedCurrency} onValueChange={onSelectCurrency}>
        <TabsList>
          {activeCurrencies.map((currency) => (
            <TabsTrigger
              key={currency}
              value={currency}
              className="flex h-8 items-center gap-1"
            >
              <span>{currency.toUpperCase()}</span>
              {currency !== defaultCurrency &&
                selectedCurrency === currency && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveCurrency(currency)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        onRemoveCurrency(currency)
                      }
                    }}
                    className="cursor-pointer text-gray-400 hover:text-gray-600"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </span>
                )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {availableCurrencies.length > 0 && (
        <Select onValueChange={onAddCurrency}>
          <SelectTrigger className="h-8 w-auto gap-1 border-none bg-transparent px-2 shadow-none">
            <PlusIcon className="h-3.5 w-3.5" />
            <span className="text-sm">Add Currency</span>
          </SelectTrigger>
          <SelectContent>
            {availableCurrencies.map((currency: string) => (
              <SelectItem key={currency} value={currency}>
                {currency.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

// ── Toggle (from components.jsx) ───────────────────────────────────────────
function PFToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="pf-toggle-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`pf-toggle${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="pf-toggle-knob" />
      </button>
      <div className="pf-toggle-text">
        <div className="pf-toggle-label">{label}</div>
        <div className="pf-toggle-desc">{description}</div>
      </div>
    </div>
  )
}

// ── Select (from components.jsx, used in Recurring row) ────────────────────
function PFSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="pf-select-wrap">
      <select
        className="pf-select"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pf-select-chev">▾</span>
    </div>
  )
}

// ── PriceRow (from app.jsx) ────────────────────────────────────────────────
function PFPriceRow({
  index,
  primary,
  disabledCurrencies,
  onRemove,
  cycle,
  every,
  period,
}: {
  index: number
  primary?: boolean
  disabledCurrencies: string[]
  onRemove?: () => void
  cycle?: 'onetime' | 'recurring'
  every?: number
  period?: string
}) {
  const { watch, setValue } = useFormContext<WizardPricingForm>()
  const price = watch(`prices.${index}`)
  const currency = price?.price_currency ?? 'usd'
  const amount = price?.price_amount ?? null
  const cur = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Local draft string is the source of truth for what the user is typing —
  // we only resync from the form when the *currency* changes (decimal factor
  // shifts), not when the amount changes (since that comes from our own
  // setValue and would clobber the keystroke mid-type with "1.00").
  const [draft, setDraft] = useState<string>(fromMinor(amount, currency))
  const lastCurrencyRef = useRef(currency)
  useEffect(() => {
    if (lastCurrencyRef.current !== currency) {
      setDraft(fromMinor(amount, currency))
      lastCurrencyRef.current = currency
    }
  }, [currency, amount])

  const cadenceLabel =
    cycle === 'recurring' && period
      ? `/ ${every && every > 1 ? `${every} ${period}s` : period}`
      : null

  return (
    <div className="pf-price-row" ref={ref}>
      <span className="pf-price-sym">{cur.symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        className="pf-price-amount"
        value={draft}
        placeholder="0.00"
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.]/g, '')
          setDraft(cleaned)
          setValue(`prices.${index}.price_amount`, toMinor(cleaned, currency))
          setValue(`prices.${index}.id`, '')
        }}
      />
      {cadenceLabel && <span className="pf-price-cadence">{cadenceLabel}</span>}
      <button
        type="button"
        className="pf-price-cur-right"
        onClick={() => setOpen((o) => !o)}
      >
        {cur.code.toUpperCase()}
        <span className="pf-price-chev">▾</span>
      </button>
      {primary && <span className="pf-price-tag">Primary</span>}
      {onRemove && (
        <button
          type="button"
          className="pf-price-remove"
          onClick={onRemove}
          aria-label="Remove currency"
        >
          ×
        </button>
      )}
      {open && (
        <div className="pf-cur-menu">
          {CURRENCIES.map((c) => {
            const isDisabled =
              disabledCurrencies.includes(c.code) && c.code !== currency
            return (
              <button
                type="button"
                key={c.code}
                disabled={isDisabled}
                className={`pf-cur-item${
                  c.code === currency ? 'active' : ''
                }${isDisabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (isDisabled) return
                  setValue(
                    `prices.${index}.price_currency`,
                    c.code as schemas['PresentmentCurrency'],
                  )
                  setValue(`prices.${index}.id`, '')
                  setOpen(false)
                }}
              >
                <span className="pf-cur-code">{c.code.toUpperCase()}</span>
                <span className="pf-cur-name">{c.name}</span>
                <span className="pf-cur-sym-right">{c.symbol}</span>
                {c.code === currency && <span className="pf-cur-check">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MediaDrop (from app.jsx) — visually identical, routes upload through the
// canonical Upload service so the file lands as a real product_media. ──────
function PFMediaDrop({
  organization,
  value,
  onChange,
}: {
  organization: schemas['Organization']
  value: schemas['ProductMediaFileRead'] | null
  onChange: (v: schemas['ProductMediaFileRead'] | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    const upload = new Upload({
      organization,
      service: 'product_media',
      file,
      onFileProcessing: () => {},
      onFileCreate: () => {},
      onFileUploadProgress: () => {},
      onFileUploaded: (response) => {
        setUploading(false)
        onChange(response as schemas['ProductMediaFileRead'])
      },
      onFileError: () => {
        setUploading(false)
      },
    })
    upload.run()
  }

  if (value) {
    return (
      <div className="pf-media-preview">
        <img src={value.public_url} alt={value.name} />
        <button
          type="button"
          className="pf-media-remove"
          onClick={() => onChange(null)}
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div
      className={`pf-media-drop${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onFile(e.dataTransfer.files?.[0])
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="pf-media-title">
        {uploading ? (
          'Uploading…'
        ) : (
          <>
            Drop image or video, or{' '}
            <span className="pf-media-browse">browse</span>
          </>
        )}
      </div>
      <div className="pf-media-hint">
        PNG, JPG, MP4 · up to 10 MB · 16:9 recommended
      </div>
    </div>
  )
}

// ── CheckoutPreview (from app.jsx) ─────────────────────────────────────────
function PFCheckoutPreview({
  courseTitle,
  courseDesc,
  courseLessons,
  primaryPrice,
  additionalPrices,
  cycle,
  every,
  period,
  freeTrial,
  trialDays,
  isFree,
  accessMode,
  previewLessons,
  media,
}: {
  courseTitle: string
  courseDesc?: string
  courseLessons: number
  primaryPrice: { currency: string; amount: string }
  additionalPrices: { currency: string; amount: string }[]
  cycle: 'onetime' | 'recurring'
  every: number
  period: string
  freeTrial: boolean
  trialDays: number
  isFree: boolean
  accessMode: 'open' | 'preview'
  previewLessons: number
  media: schemas['ProductMediaFileRead'] | null
}) {
  const cur =
    CURRENCIES.find((c) => c.code === primaryPrice.currency) ?? CURRENCIES[0]
  const amount = isFree ? 'Free' : `${cur.symbol}${primaryPrice.amount || '0'}`
  const cycleLabel =
    cycle === 'recurring' && !isFree
      ? ` / ${every > 1 ? `${every} ${period}s` : period}`
      : ''
  const cta = isFree
    ? 'Enrol for free'
    : cycle === 'recurring'
      ? freeTrial
        ? `Start ${trialDays}-day free trial`
        : 'Subscribe & start learning'
      : 'Buy course'

  return (
    <aside className="pf-preview-aside">
      <div className="pf-preview-eyebrow">Live preview</div>
      <div className="pf-preview-card">
        <div
          className="pf-preview-hero"
          style={
            media?.public_url
              ? {
                  background: `center / cover no-repeat url(${media.public_url})`,
                }
              : undefined
          }
        >
          {accessMode === 'preview' && previewLessons > 0 && (
            <span className="pf-preview-badge">
              {previewLessons} free preview{' '}
              {previewLessons === 1 ? 'lesson' : 'lessons'}
            </span>
          )}
          {!media?.public_url && (
            <div className="pf-preview-placeholder">course cover · 16:9</div>
          )}
        </div>
        <div className="pf-preview-body">
          <div className="pf-preview-meta">
            Online course · {courseLessons} lessons
          </div>
          <h3 className="pf-preview-title">{courseTitle}</h3>
          {courseDesc && <p className="pf-preview-desc">{courseDesc}</p>}
          <div className="pf-preview-price">
            <span className="pf-preview-amount">{amount}</span>
            {cycleLabel && (
              <span className="pf-preview-cycle">{cycleLabel}</span>
            )}
          </div>
          {additionalPrices.length > 0 && !isFree && (
            <div className="pf-preview-extras">
              {additionalPrices.map((p, i) => {
                const c =
                  CURRENCIES.find((x) => x.code === p.currency) ?? CURRENCIES[0]
                return (
                  <span key={i} className="pf-preview-extra">
                    {c.symbol}
                    {p.amount || '0'} {c.code.toUpperCase()}
                  </span>
                )
              })}
            </div>
          )}
          <button type="button" className="pf-preview-cta">
            {cta}
          </button>
          <div className="pf-preview-footer">
            <span>Secure checkout</span>
            <span>Powered by spaire</span>
          </div>
        </div>
      </div>
      <div className="pf-preview-note">
        Updates as you change the form. Final layout may vary in email & social
        shares.
      </div>
    </aside>
  )
}

export type WizardPaywallState = {
  paywallEnabled: boolean
  freePreviewLessons: number
}

export function StepPricingWizard({
  organization,
  paywall,
  onPaywallChange,
  onNext,
  onBack,
  onClose,
  courseTitle,
  courseDesc,
  courseLessons,
  format = 'course',
}: {
  organization: schemas['Organization']
  paywall: WizardPaywallState
  onPaywallChange: (next: WizardPaywallState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
  courseTitle?: string
  courseDesc?: string
  courseLessons?: number
  format?: WizardFormat
}) {
  const isSeries = format === 'series'
  const { control, watch, setValue, getValues } =
    useFormContext<WizardPricingForm>()

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'prices',
  })

  const recurringInterval = watch('recurring_interval')
  const recurringIntervalCount = watch('recurring_interval_count') ?? 1
  const trialInterval = watch('trial_interval')
  const trialIntervalCount = watch('trial_interval_count')
  const fullMedias =
    (watch('full_medias' as never) as schemas['ProductMediaFileRead'][]) ?? []
  const heroMedia: schemas['ProductMediaFileRead'] | null =
    fullMedias[0] ?? null

  const cycle: 'onetime' | 'recurring' =
    recurringInterval == null ? 'onetime' : 'recurring'

  const prices = watch('prices') ?? []
  const priceModel: 'fixed' | 'free' =
    prices[0]?.amount_type === 'free' ? 'free' : 'fixed'

  const defaultCurrency = organization.default_presentment_currency ?? 'usd'

  const usedCurrencies: string[] = useMemo(
    () =>
      prices
        .map((p) => p?.price_currency)
        .filter((c): c is NonNullable<typeof c> => typeof c === 'string'),
    [prices],
  )
  const additionalIndices = useMemo(
    () => prices.map((_, i) => i).slice(1),
    [prices],
  )

  // Which currency the price input is editing right now. Mirrors the
  // product-create form: a Tabs row at the top of the price box switches
  // between configured currencies, and "+ Add Currency" appends a new one.
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    () => prices[0]?.price_currency ?? defaultCurrency,
  )
  useEffect(() => {
    if (!usedCurrencies.includes(selectedCurrency) && usedCurrencies.length) {
      setSelectedCurrency(usedCurrencies[0])
    }
  }, [usedCurrencies, selectedCurrency])
  const selectedIndex = useMemo(() => {
    const i = prices.findIndex((p) => p?.price_currency === selectedCurrency)
    return i >= 0 ? i : 0
  }, [prices, selectedCurrency])
  const removeCurrency = (code: string) => {
    if (code === defaultCurrency) return
    const i = prices.findIndex((p) => p?.price_currency === code)
    if (i > 0) remove(i)
    if (selectedCurrency === code) setSelectedCurrency(defaultCurrency)
  }

  const setCycle = (next: 'onetime' | 'recurring') => {
    if (next === 'onetime') {
      setValue('recurring_interval', null)
      setValue('recurring_interval_count', null)
      setValue('trial_interval', null)
      setValue('trial_interval_count', null)
    } else {
      setValue('recurring_interval', recurringInterval ?? 'month')
      setValue('recurring_interval_count', recurringIntervalCount || 1)
    }
  }

  const setPriceModel = (next: 'fixed' | 'free') => {
    const current = getValues('prices') ?? []
    const updated: WizardPricingForm['prices'] = current.map((p) => {
      const c = p?.price_currency ?? defaultCurrency
      const base = { price_currency: c as schemas['PresentmentCurrency'] }
      if (next === 'free') return { ...base, amount_type: 'free' }
      return {
        ...base,
        amount_type: 'fixed',
        price_amount: p?.price_amount ?? null,
      }
    })
    replace(updated)
    // The paywall only makes sense on paid courses. Keep the flag in sync
    // with the price model so the user doesn't have to drag the slider just
    // to flip it on.
    onPaywallChange({ ...paywall, paywallEnabled: next === 'fixed' })
  }

  const addCurrency = (code?: string) => {
    const used = new Set(usedCurrencies)
    const next =
      code && !used.has(code)
        ? code
        : (CURRENCIES.find((c) => !used.has(c.code))?.code ?? 'usd')
    if (priceModel === 'free') {
      append({
        amount_type: 'free',
        price_currency: next as schemas['PresentmentCurrency'],
      })
    } else {
      append({
        amount_type: 'fixed',
        price_amount: null,
        price_currency: next as schemas['PresentmentCurrency'],
      })
    }
    setSelectedCurrency(next)
  }

  const trialEnabled = trialInterval != null && trialIntervalCount != null
  const setTrialEnabled = (enabled: boolean) => {
    if (enabled) {
      setValue('trial_interval', 'day')
      setValue('trial_interval_count', trialIntervalCount ?? 7)
    } else {
      setValue('trial_interval', null)
      setValue('trial_interval_count', null)
    }
  }

  const previewPrimary = {
    currency: prices[0]?.price_currency ?? defaultCurrency,
    amount: fromMinor(
      prices[0]?.price_amount,
      prices[0]?.price_currency ?? defaultCurrency,
    ),
  }
  const previewAdditional = additionalIndices.map((i) => ({
    currency: prices[i]?.price_currency ?? 'usd',
    amount: fromMinor(
      prices[i]?.price_amount,
      prices[i]?.price_currency ?? 'usd',
    ),
  }))

  const accessMode: 'open' | 'preview' = paywall.paywallEnabled
    ? 'preview'
    : 'open'

  const setMedia = (m: schemas['ProductMediaFileRead'] | null) => {
    setValue('full_medias' as never, (m ? [m] : []) as never)
  }

  return (
    <StepShell
      step={4}
      total={4}
      nextLabel={isSeries ? 'Generate series' : 'Generate outline'}
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      wide
    >
      <div className="spaire-wizard-pricing">
        <main className="pf-main">
          <div className="pf-form-col">
            {/* MEDIA */}
            <PFSection
              eyebrow="Media"
              title="Course cover"
              description="The first thing students see — in checkout, on your spaire space, in shares. Use a frame from a lesson, or a custom thumbnail. 16:9 works best."
            >
              <PFMediaDrop
                organization={organization}
                value={heroMedia}
                onChange={setMedia}
              />
            </PFSection>

            {/* PRICING */}
            <PFSection
              eyebrow="Pricing"
              title="How students pay"
              description="Sell your course once, or charge a recurring fee for ongoing access. Add other currencies for international students."
            >
              <div className="flex w-full flex-col gap-10">
                {/* Cycle — same Label/RadioGroup pattern as the product
                    create form's "One-time / Recurring" cards. */}
                <RadioGroup
                  value={cycle}
                  onValueChange={(v) => setCycle(v as 'onetime' | 'recurring')}
                  className="grid grid-cols-2 gap-4"
                >
                  {(
                    [
                      {
                        value: 'onetime',
                        title: 'Pay once',
                        desc: 'Charge a one-time fee at enrolment.',
                      },
                      {
                        value: 'recurring',
                        title: 'Recurring',
                        desc: 'Charge students on a regular schedule.',
                      },
                    ] as const
                  ).map((opt) => (
                    <Label
                      key={opt.value}
                      htmlFor={`pf-cycle-${opt.value}`}
                      className={twMerge(
                        'flex cursor-pointer flex-col gap-3 rounded-2xl border border-[1.5px] p-5 font-normal transition-colors',
                        cycle === opt.value
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
                  ))}
                </RadioGroup>

                <hr className="border-gray-200" />

                {/* Pricing model — Fixed price / Free, same Label markup. */}
                <RadioGroup
                  value={priceModel}
                  onValueChange={(v) => setPriceModel(v as 'fixed' | 'free')}
                  className="grid grid-cols-2 gap-4"
                >
                  {(
                    [
                      {
                        value: 'fixed',
                        title: 'Fixed price',
                        desc: 'Charge a set amount per enrolment.',
                      },
                      {
                        value: 'free',
                        title: 'Free',
                        desc: 'No charge — open to anyone who enrols.',
                      },
                    ] as const
                  ).map((opt) => (
                    <Label
                      key={opt.value}
                      htmlFor={`pf-model-${opt.value}`}
                      className={twMerge(
                        'flex cursor-pointer flex-col gap-3 rounded-2xl border border-[1.5px] p-5 font-normal transition-colors',
                        priceModel === opt.value
                          ? 'border-[oklch(0.62_0.21_265)] bg-gray-50'
                          : 'border-gray-100 text-gray-500 hover:border-gray-200',
                      )}
                    >
                      <div className="flex items-center gap-2.5 font-medium">
                        <RadioGroupItem
                          value={opt.value}
                          id={`pf-model-${opt.value}`}
                        />
                        {opt.title}
                      </div>
                      <p className="text-sm text-gray-500">{opt.desc}</p>
                    </Label>
                  ))}
                </RadioGroup>

                {/* Price input + currency tabs — same wrapper / MoneyInput
                    + CurrencyTabs combo as the product create form. Only
                    shown for the "Fixed price" model. */}
                {priceModel === 'fixed' && prices[selectedIndex] && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <MoneyInput
                          name={`prices.${selectedIndex}.price_amount`}
                          currency={selectedCurrency}
                          value={
                            prices[selectedIndex]?.price_amount ?? undefined
                          }
                          onChange={(v) =>
                            setValue(
                              `prices.${selectedIndex}.price_amount`,
                              v,
                            )
                          }
                          placeholder={0}
                        />
                      </div>
                      <div className="shrink-0">
                        <CourseCurrencyTabs
                          activeCurrencies={usedCurrencies}
                          selectedCurrency={selectedCurrency}
                          defaultCurrency={defaultCurrency}
                          onSelectCurrency={setSelectedCurrency}
                          onAddCurrency={(c) => addCurrency(c)}
                          onRemoveCurrency={removeCurrency}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Recurring details */}
                {priceModel === 'fixed' && cycle === 'recurring' && (
                  <div className="pf-recurring">
                    <span>Renew every</span>
                    <input
                      type="number"
                      min={1}
                      className="pf-num"
                      value={recurringIntervalCount}
                      onChange={(e) =>
                        setValue(
                          'recurring_interval_count',
                          Math.max(1, parseInt(e.target.value || '1', 10)),
                        )
                      }
                    />
                    <PFSelect
                      value={recurringInterval ?? 'month'}
                      onChange={(v) =>
                        setValue(
                          'recurring_interval',
                          v as schemas['SubscriptionRecurringInterval'],
                        )
                      }
                      options={[
                        {
                          value: 'day',
                          label: recurringIntervalCount > 1 ? 'days' : 'day',
                        },
                        {
                          value: 'week',
                          label: recurringIntervalCount > 1 ? 'weeks' : 'week',
                        },
                        {
                          value: 'month',
                          label:
                            recurringIntervalCount > 1 ? 'months' : 'month',
                        },
                        {
                          value: 'year',
                          label: recurringIntervalCount > 1 ? 'years' : 'year',
                        },
                      ]}
                    />
                  </div>
                )}

                {/* Trial — only when recurring */}
                {priceModel === 'fixed' && cycle === 'recurring' && (
                  <div className="pf-trial">
                    <PFToggle
                      checked={trialEnabled}
                      onChange={setTrialEnabled}
                      label="Free trial period"
                      description="Let students explore the course before being charged."
                    />
                    {trialEnabled && (
                      <div className="pf-trial-row">
                        <span>Trial length</span>
                        <input
                          type="number"
                          min={1}
                          className="pf-num"
                          value={trialIntervalCount ?? 7}
                          onChange={(e) =>
                            setValue(
                              'trial_interval_count',
                              Math.max(1, parseInt(e.target.value || '1', 10)),
                            )
                          }
                        />
                        <span>days</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </PFSection>

            {/* ACCESS — only relevant for paid courses */}
            {priceModel === 'fixed' && (
              <PFSection
                eyebrow="Access"
                title="What students see before paying"
                description="Give a taste of the course, or keep everything behind the paywall."
              >
                <div className="pf-preview-slider">
                  <div className="pf-preview-slider-row">
                    <div>
                      <div className="pf-preview-slider-title">
                        Free preview lessons
                      </div>
                      <div className="pf-preview-slider-desc">
                        Visible before the paywall. The rest unlock after
                        purchase.
                      </div>
                    </div>
                    <div className="pf-preview-slider-count">
                      <span className="pf-preview-slider-num">
                        {paywall.freePreviewLessons}
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={courseLessons ?? 12}
                    value={paywall.freePreviewLessons}
                    className="pf-slider"
                    onChange={(e) =>
                      onPaywallChange({
                        ...paywall,
                        paywallEnabled: true,
                        freePreviewLessons: parseInt(e.target.value, 10),
                      })
                    }
                  />
                  <div className="pf-slider-legend">
                    <span>0 — no preview</span>
                    <span>{courseLessons ?? 12} lessons</span>
                  </div>
                </div>
              </PFSection>
            )}
          </div>

          {/* LIVE PREVIEW */}
          <PFCheckoutPreview
            courseTitle={courseTitle ?? 'Mastering Modern UI Design'}
            courseDesc={courseDesc}
            courseLessons={courseLessons ?? 12}
            primaryPrice={previewPrimary}
            additionalPrices={previewAdditional}
            cycle={cycle}
            every={recurringIntervalCount}
            period={recurringInterval ?? 'month'}
            freeTrial={trialEnabled}
            trialDays={trialIntervalCount ?? 7}
            isFree={priceModel === 'free'}
            accessMode={accessMode}
            previewLessons={paywall.freePreviewLessons}
            media={heroMedia}
          />
        </main>
      </div>

      <style jsx global>{`
        .spaire-wizard-pricing {
          /* Design tokens — exactly as in spaire/Product Flow.html */
          --bg: oklch(0.995 0.002 80);
          --surface: #ffffff;
          --surface-2: oklch(0.975 0.004 270);
          --surface-3: oklch(0.955 0.006 270);
          --ink: oklch(0.18 0.012 270);
          --ink-2: oklch(0.36 0.012 270);
          --muted: oklch(0.56 0.014 270);
          --muted-2: oklch(0.72 0.012 270);
          --hair: oklch(0.92 0.006 270);
          --hair-strong: oklch(0.86 0.008 270);
          --accent: oklch(0.52 0.18 270);
          --accent-soft: oklch(0.96 0.04 270);
          --accent-ring: oklch(0.52 0.18 270 / 0.18);
          --shadow-md:
            0 1px 2px oklch(0.2 0.02 270 / 0.04),
            0 8px 24px oklch(0.2 0.02 270 / 0.06);
          font-family: 'Poppins', system-ui, sans-serif;
          color: var(--ink);
          background: var(--bg);
        }
        .spaire-wizard-pricing,
        .spaire-wizard-pricing * {
          font-family: 'Poppins', system-ui, sans-serif;
        }
        .pf-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px 32px 60px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 56px;
        }
        @media (max-width: 960px) {
          .pf-main {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }
        .pf-form-col {
          min-width: 0;
        }

        /* Section */
        .pf-section {
          padding-block: 36px;
          border-top: 1px solid var(--hair);
        }
        .pf-section:first-of-type {
          border-top: none;
        }
        .pf-section-head {
          margin-bottom: 24px;
        }
        .pf-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--muted-2);
          margin-bottom: 6px;
        }
        .pf-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.2px;
          color: var(--ink);
        }
        .pf-desc {
          font-size: 13.5px;
          color: var(--muted);
          margin: 6px 0 0;
          max-width: 520px;
          line-height: 1.5;
        }
        .pf-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .pf-field {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pf-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }

        /* Segmented */
        .pf-seg {
          display: inline-flex;
          padding: 4px;
          gap: 2px;
          background: var(--surface-3);
          border-radius: 12px;
          border: 1px solid var(--hair);
          align-self: flex-start;
        }
        .pf-seg-btn {
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 9px;
          border: none;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .pf-seg-btn.active {
          background: #fff;
          color: var(--ink);
          box-shadow:
            0 1px 2px oklch(0.2 0.02 270 / 0.06),
            0 1px 0 oklch(0.92 0.006 270);
        }

        /* Recurring config row */
        .pf-recurring {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 4px;
          padding: 12px 14px;
          background: var(--surface-2);
          border-radius: 10px;
          border: 1px solid var(--hair);
          font-size: 13px;
          color: var(--ink-2);
        }
        .pf-recurring-hint {
          margin-left: auto;
          font-size: 12px;
          color: var(--muted);
        }
        .pf-num {
          width: 64px;
          padding: 7px 10px;
          text-align: center;
          border: 1px solid var(--hair);
          border-radius: 7px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          outline: none;
        }
        .pf-num:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-ring);
        }
        .pf-select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-ring);
        }
        .pf-select-wrap {
          position: relative;
          display: inline-flex;
        }
        .pf-select {
          appearance: none;
          padding: 9px 36px 9px 14px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid var(--hair);
          border-radius: 8px;
          background: #fff;
          color: var(--ink);
          cursor: pointer;
          outline: none;
        }
        .pf-select-chev {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--muted);
          font-size: 10px;
        }

        /* Choice cards */
        .pf-choice-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        /* Radio card — same visual as the product-create pricing form:
           rounded-2xl card with the radio + title on row 1 and a small
           gray description on row 2. White by default, gray-50 wash with a
           1.5px indigo border when active. No halo, no double edge. */
        .pf-choice {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          padding: 20px;
          text-align: left;
          width: 100%;
          background: #fff;
          border: 1.5px solid oklch(0.94 0.004 280);
          border-radius: 16px;
          cursor: pointer;
          transition:
            border-color 0.15s,
            background 0.15s;
          color: var(--ink);
        }
        .pf-choice:hover {
          border-color: oklch(0.88 0.005 280);
        }
        .pf-choice.active {
          background: oklch(0.975 0.002 280);
          border-color: oklch(0.62 0.21 265);
        }
        .pf-choice-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 10px;
        }
        .pf-choice-radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1.5px solid oklch(0.62 0.21 265);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: #fff;
        }
        .pf-choice-radio-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: transparent;
          transition: background 0.15s;
        }
        .pf-choice.active .pf-choice-radio-dot {
          background: oklch(0.62 0.21 265);
        }
        .pf-choice-title {
          font-size: 15px;
          font-weight: 500;
          color: var(--ink);
        }
        .pf-choice.active .pf-choice-title {
          color: oklch(0.18 0.012 270);
        }
        .pf-choice-desc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.45;
        }

        /* Price label row (label + hint) */
        .pf-price-label-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .pf-price-hint {
          font-size: 12px;
          color: var(--muted);
        }

        /* Paid block — wraps prices + billing + trial */
        .pf-paid-block {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Price row */
        .pf-prices {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pf-price-row {
          display: flex;
          align-items: center;
          border: 1.5px solid var(--hair);
          border-radius: 12px;
          background: #fff;
          position: relative;
          overflow: visible;
          transition: border-color 0.15s;
        }
        .pf-price-row:focus-within {
          border-color: oklch(0.62 0.21 265);
        }
        .pf-price-sym {
          padding: 12px 0 12px 16px;
          font-size: 16px;
          font-weight: 500;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
          user-select: none;
        }
        .pf-price-chev {
          margin-left: 2px;
          color: var(--muted);
          font-size: 10px;
        }
        .pf-price-cadence {
          font-size: 13px;
          color: var(--muted);
          padding-right: 10px;
          white-space: nowrap;
        }
        .pf-price-cur-right {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 12px 14px;
          background: transparent;
          border: none;
          border-left: 1px solid var(--hair);
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .pf-price-amount {
          flex: 1;
          padding: 12px 8px;
          font-size: 16px;
          font-weight: 500;
          border: none;
          outline: none;
          background: transparent;
          color: var(--ink);
          min-width: 0;
          font-variant-numeric: tabular-nums;
        }
        .pf-price-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-2);
          letter-spacing: 0.5px;
          padding-right: 14px;
          text-transform: uppercase;
        }
        .pf-price-remove {
          width: 36px;
          height: 36px;
          margin-right: 6px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--muted);
          cursor: pointer;
          font-size: 16px;
        }
        .pf-cur-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          width: 320px;
          padding: 6px;
          z-index: 30;
          background: #fff;
          border: 1px solid var(--hair);
          border-radius: 12px;
          box-shadow: var(--shadow-md);
          max-height: 360px;
          overflow-y: auto;
        }
        .pf-cur-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 10px;
          font-size: 13px;
          text-align: left;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--ink);
          cursor: pointer;
        }
        .pf-cur-item:hover:not(.disabled) {
          background: var(--surface-3);
        }
        .pf-cur-item.active {
          background: var(--surface-3);
        }
        .pf-cur-item.disabled {
          color: var(--muted-2);
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pf-cur-code {
          font-weight: 600;
          min-width: 38px;
        }
        .pf-cur-name {
          color: var(--muted);
          font-size: 12px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pf-cur-sym-right {
          color: var(--muted-2);
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          margin-left: 4px;
        }
        .pf-cur-check {
          margin-left: auto;
          color: var(--accent);
          font-size: 14px;
        }
        .pf-add-currency {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          border: 1.5px solid oklch(0.94 0.004 280);
          color: var(--ink);
          border-radius: 10px;
          cursor: pointer;
          transition:
            border-color 0.15s,
            background 0.15s;
        }
        .pf-add-currency:hover:not(:disabled) {
          border-color: oklch(0.62 0.21 265);
          background: oklch(0.975 0.002 280);
        }
        .pf-add-currency:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Trial */
        .pf-trial {
          border-top: 1px solid var(--hair);
          padding-top: 16px;
        }
        .pf-toggle-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 0;
        }
        .pf-toggle {
          flex-shrink: 0;
          margin-top: 2px;
          width: 38px;
          height: 22px;
          border-radius: 999px;
          background: var(--hair-strong);
          border: none;
          padding: 0;
          position: relative;
          transition: background 0.2s;
          cursor: pointer;
        }
        .pf-toggle.on {
          background: var(--accent);
        }
        .pf-toggle-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: left 0.2s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .pf-toggle.on .pf-toggle-knob {
          left: 18px;
        }
        .pf-toggle-text {
          flex: 1;
          min-width: 0;
        }
        .pf-toggle-label {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ink);
        }
        .pf-toggle-desc {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 2px;
        }
        .pf-trial-row {
          margin-left: 50px;
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--ink-2);
        }

        /* Media drop */
        .pf-media-drop {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 44px 24px;
          border: 1.5px solid oklch(0.94 0.004 280);
          border-radius: 14px;
          background: #fff;
          cursor: pointer;
          transition:
            border-color 0.15s,
            background 0.15s;
          aspect-ratio: 16 / 9;
          text-align: center;
        }
        .pf-media-drop:hover,
        .pf-media-drop.drag-over {
          border-color: oklch(0.62 0.21 265);
          background: oklch(0.975 0.002 280);
        }
        .pf-media-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
        }
        .pf-media-browse {
          color: var(--accent);
          text-decoration: underline;
        }
        .pf-media-hint {
          font-size: 12px;
          color: var(--muted);
        }
        .pf-media-preview {
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          aspect-ratio: 16 / 9;
          background: var(--surface-3);
          border: 1px solid var(--hair);
        }
        .pf-media-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .pf-media-remove {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.95);
          color: var(--ink);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        /* Free preview slider card */
        .pf-preview-slider {
          margin-top: 14px;
          padding: 16px;
          background: var(--surface-2);
          border-radius: 12px;
          border: 1px solid var(--hair);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pf-preview-slider-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }
        .pf-preview-slider-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }
        .pf-preview-slider-desc {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
        .pf-preview-slider-count {
          display: flex;
          align-items: baseline;
          gap: 4px;
          color: var(--ink);
        }
        .pf-preview-slider-num {
          font-size: 28px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.5px;
        }
        .pf-slider {
          width: 100%;
          accent-color: var(--accent);
        }
        .pf-slider-legend {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--muted-2);
        }

        /* Live checkout preview */
        .pf-preview-aside {
          position: sticky;
          top: 100px;
          align-self: start;
        }
        .pf-preview-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--muted-2);
          margin-bottom: 12px;
        }
        .pf-preview-card {
          background: #fff;
          border: 1px solid var(--hair);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }
        .pf-preview-hero {
          aspect-ratio: 16 / 9;
          background: repeating-linear-gradient(
            45deg,
            oklch(0.94 0.01 270) 0 12px,
            oklch(0.96 0.01 270) 12px 24px
          );
          position: relative;
        }
        .pf-preview-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.96);
          color: var(--ink);
          border-radius: 999px;
          letter-spacing: 0.2px;
        }
        .pf-preview-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: oklch(0.55 0.02 270);
          font-size: 11px;
          font-family: ui-monospace, monospace;
          letter-spacing: 0.5px;
        }
        .pf-preview-body {
          padding: 18px;
        }
        .pf-preview-meta {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-2);
          letter-spacing: 0.6px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .pf-preview-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          line-height: 1.3;
          letter-spacing: -0.2px;
        }
        .pf-preview-desc {
          font-size: 12.5px;
          color: var(--muted);
          margin: 6px 0 0;
          line-height: 1.5;
        }
        .pf-preview-price {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 18px;
          margin-bottom: 16px;
        }
        .pf-preview-amount {
          font-size: 26px;
          font-weight: 600;
          color: var(--ink);
          letter-spacing: -0.6px;
          font-variant-numeric: tabular-nums;
        }
        .pf-preview-cycle {
          font-size: 13px;
          color: var(--muted);
        }
        .pf-preview-extras {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }
        .pf-preview-extra {
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 500;
          background: var(--surface-3);
          color: var(--muted);
          border-radius: 6px;
          font-variant-numeric: tabular-nums;
        }
        .pf-preview-cta {
          width: 100%;
          padding: 13px 16px;
          font-size: 14px;
          font-weight: 600;
          background: var(--ink);
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }
        .pf-preview-footer {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--hair);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: var(--muted);
        }
        .pf-preview-note {
          margin-top: 12px;
          font-size: 11px;
          color: var(--muted);
          line-height: 1.5;
        }
      `}</style>
    </StepShell>
  )
}
