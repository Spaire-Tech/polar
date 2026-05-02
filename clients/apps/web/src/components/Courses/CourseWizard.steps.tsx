'use client'

import { ProductMediaSection } from '@/components/Products/ProductForm/ProductMediaSection'
import CloseIcon from '@mui/icons-material/Close'
import { enums, schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'

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

      /* Fields */
      .so-fields {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-bottom: 32px;
      }
      .so-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .so-label {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.07em;
        color: var(--so-gray4);
        text-transform: uppercase;
      }
      .so-input,
      .so-textarea {
        width: 100%;
        padding: 13px 16px;
        background: var(--so-gray1);
        border: 1.5px solid var(--so-gray2);
        border-radius: 10px;
        font-family: var(--font-poppins), system-ui, sans-serif;
        font-size: 15px;
        font-weight: 400;
        color: var(--so-black);
        outline: none;
        transition:
          border-color 0.2s,
          background 0.2s,
          box-shadow 0.2s;
        -webkit-appearance: none;
      }
      .so-textarea {
        resize: none;
        line-height: 1.6;
      }
      .so-input::placeholder,
      .so-textarea::placeholder {
        color: var(--so-gray3);
      }
      .so-input:focus,
      .so-textarea:focus {
        border-color: var(--so-black);
        background: var(--so-white);
        box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.07);
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

      /* Intro */
      .so-intro-stage {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--so-white);
        padding: 80px 40px;
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
        border: 1.5px dashed var(--so-gray2);
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
      <div className="so-logo">Spaire</div>
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
        <div className="so-screen" style={wide ? { maxWidth: 720 } : undefined}>
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
}: {
  data: { name: string; bio: string }
  onChange: (next: { name: string; bio: string }) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepShell
      step={1}
      total={3}
      title="Instructor details"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={!data.name.trim()}
    >
      <div className="so-fields">
        <div className="so-field">
          <label className="so-label">Instructor name</label>
          <input
            className="so-input"
            type="text"
            placeholder="e.g. Alex Rivera"
            autoFocus
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && data.name.trim()) onNext()
            }}
          />
        </div>
        <div className="so-field">
          <label className="so-label">Short bio</label>
          <textarea
            className="so-textarea"
            rows={2}
            placeholder="e.g. Designer & educator helping 50K+ creators build their brand."
            value={data.bio}
            onChange={(e) => onChange({ ...data, bio: e.target.value })}
          />
          <span className="so-hint">One sentence max.</span>
        </div>
      </div>
    </StepShell>
  )
}

// ─── Step 2: Course ───────────────────────────────────────────────────────────

export function StepCourse({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: { title: string; desc: string }
  onChange: (next: { title: string; desc: string }) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <StepShell
      step={2}
      total={3}
      title="Course details"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextDisabled={!data.title.trim()}
    >
      <div className="so-fields">
        <div className="so-field">
          <label className="so-label">Course title</label>
          <input
            className="so-input"
            type="text"
            placeholder="e.g. The YouTube Growth Blueprint"
            autoFocus
            value={data.title}
            onChange={(e) => onChange({ ...data, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && data.title.trim()) onNext()
            }}
          />
        </div>
        <div className="so-field">
          <label className="so-label">Short description</label>
          <textarea
            className="so-textarea"
            rows={3}
            placeholder="Summarize what students will learn in one sentence."
            value={data.desc}
            onChange={(e) => onChange({ ...data, desc: e.target.value })}
          />
        </div>
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
              className={`so-media-card${isSelected ? 'selected' : ''}`}
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

// ─── Step 3: Pricing & access ────────────────────────────────────────────────
//
// Bespoke pricing/access UI matching the spaire Product Flow design. Mounts
// ProductMediaSection (canonical product media uploads) so files still land on
// real product_media records, then renders a custom pricing block that writes
// directly to the shared react-hook-form: recurring_interval / interval_count,
// prices[].{price_currency,price_amount,amount_type}, trial_interval and
// trial_interval_count. The course-specific paywall toggle + free preview
// slider stay below pricing.

export type WizardPaywallState = {
  paywallEnabled: boolean
  freePreviewLessons: number
}

// Currency catalog — derived from the backend PresentmentCurrency enum so we
// support every currency the API accepts. Symbols/names come from the
// browser's CLDR data via Intl, with a small fallback table for obscure codes.
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
  } catch {
    // browser doesn't know this code — keep fallback/upper
  }
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'currency' }).of(upper)
    if (dn) name = dn
  } catch {
    // older browser — keep upper
  }
  return { code, symbol, name }
}

const CURRENCIES: CurrencyMeta[] = (
  enums.presentmentCurrencyValues as readonly string[]
)
  .map(buildCurrencyMeta)
  .sort((a, b) => {
    // Surface the headline currencies first, then alphabetical.
    const featured = ['usd', 'eur', 'gbp', 'cad', 'aud']
    const ai = featured.indexOf(a.code)
    const bi = featured.indexOf(b.code)
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    }
    return a.code.localeCompare(b.code)
  })

const ZERO_DECIMAL = new Set([
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
const decimalFactor = (code: string) => (ZERO_DECIMAL.has(code) ? 1 : 100)

// Convert "12.50" / "12" into the integer minor-unit amount the backend wants
// (cents for usd, whole units for jpy/xof/etc).
const toMinorUnits = (input: string, currency: string): number => {
  const n = Number.parseFloat(input)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * decimalFactor(currency))
}

const fromMinorUnits = (
  amount: number | null | undefined,
  currency: string,
): string => {
  if (amount == null) return ''
  const factor = decimalFactor(currency)
  if (factor === 1) return String(amount)
  return (amount / factor).toFixed(2)
}

// Inline currency dropdown — matches design's PriceRow currency picker with
// symbol pill + code + name.
function CurrencyMenu({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (code: string) => void
  disabled: string[]
}) {
  const cur = CURRENCIES.find((c) => c.code === value) ?? CURRENCIES[0]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="pa-cur" ref={ref}>
      <button
        type="button"
        className="pa-cur-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pa-cur-pill">{cur.symbol}</span>
        <span className="pa-cur-code">{cur.code.toUpperCase()}</span>
        <span className="pa-cur-chevron">▾</span>
      </button>
      {open && (
        <div className="pa-cur-menu" role="listbox">
          {CURRENCIES.map((c) => {
            const isDisabled = disabled.includes(c.code) && c.code !== value
            const active = c.code === value
            return (
              <button
                type="button"
                key={c.code}
                disabled={isDisabled}
                className={`pa-cur-item${active ? 'active' : ''}${isDisabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (isDisabled) return
                  onChange(c.code)
                  setOpen(false)
                }}
              >
                <span className="pa-cur-pill small">{c.symbol}</span>
                <span className="pa-cur-code">{c.code.toUpperCase()}</span>
                <span className="pa-cur-name">{c.name}</span>
                {active && <span className="pa-cur-check">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Single price row — currency pill + amount + (Primary | remove ×). Writes to
// `prices.${index}` in the shared product form.
function PriceRow({
  index,
  primary,
  disabledCurrencies,
  onRemove,
}: {
  index: number
  primary?: boolean
  disabledCurrencies: string[]
  onRemove?: () => void
}) {
  const { watch, setValue } = useFormContext<WizardPricingForm>()
  const price = watch(`prices.${index}`)

  const currency = price?.price_currency ?? 'usd'
  const amount = price?.price_amount ?? null

  const [draft, setDraft] = useState<string>(fromMinorUnits(amount, currency))

  // Keep local draft in sync if the upstream value changes (e.g. currency
  // change re-renders the amount in different decimal precision).
  useEffect(() => {
    setDraft(fromMinorUnits(amount, currency))
  }, [amount, currency])

  return (
    <div className="pa-price-row">
      <CurrencyMenu
        value={currency}
        disabled={disabledCurrencies}
        onChange={(code) => {
          setValue(
            `prices.${index}.price_currency`,
            code as schemas['PresentmentCurrency'],
          )
          setValue(`prices.${index}.id`, '')
        }}
      />
      <input
        className="pa-price-input"
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder="0.00"
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.]/g, '')
          setDraft(cleaned)
          setValue(
            `prices.${index}.price_amount`,
            toMinorUnits(cleaned, currency),
          )
          setValue(`prices.${index}.id`, '')
        }}
      />
      {primary && <span className="pa-price-tag">Primary</span>}
      {onRemove && (
        <button type="button" className="pa-price-remove" onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  )
}

export function StepPricingWizard({
  organization,
  paywall,
  onPaywallChange,
  onNext,
  onBack,
  onClose,
}: {
  organization: schemas['Organization']
  paywall: WizardPaywallState
  onPaywallChange: (next: WizardPaywallState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
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

  const cycle: 'onetime' | 'recurring' =
    recurringInterval === null || recurringInterval === undefined
      ? 'onetime'
      : 'recurring'

  const prices = watch('prices') ?? []

  // Derive the active price model (fixed/free) from the first price entry.
  // We mirror it across all currency rows when the user toggles.
  const priceModel: 'fixed' | 'free' =
    prices[0]?.amount_type === 'free' ? 'free' : 'fixed'

  const defaultCurrency = organization.default_presentment_currency ?? 'usd'

  // First price = primary; subsequent = additional currencies.
  const additionalIndices = useMemo(
    () => prices.map((_, i) => i).slice(1),
    [prices],
  )
  const usedCurrencies: string[] = useMemo(
    () =>
      prices
        .map((p) => p?.price_currency)
        .filter((c): c is NonNullable<typeof c> => typeof c === 'string'),
    [prices],
  )

  // ── Cycle (one-time / recurring) ──────────────────────────────────────────
  const setCycle = (next: 'onetime' | 'recurring') => {
    if (next === 'onetime') {
      setValue('recurring_interval', null)
      setValue('recurring_interval_count', null)
      // Trial only makes sense with recurring.
      setValue('trial_interval', null)
      setValue('trial_interval_count', null)
    } else {
      setValue('recurring_interval', recurringInterval ?? 'month')
      setValue('recurring_interval_count', recurringIntervalCount || 1)
    }
  }

  // ── Price model (fixed / free) ────────────────────────────────────────────
  const setPriceModel = (next: 'fixed' | 'free') => {
    const current = getValues('prices') ?? []
    const updated: WizardPricingForm['prices'] = current.map((p) => {
      const c = p?.price_currency ?? defaultCurrency
      const base = { price_currency: c as schemas['PresentmentCurrency'] }
      if (next === 'free') {
        return { ...base, amount_type: 'free' }
      }
      return {
        ...base,
        amount_type: 'fixed',
        price_amount: p?.price_amount ?? 0,
      }
    })
    replace(updated)
  }

  // ── Currency rows ─────────────────────────────────────────────────────────
  const addCurrency = () => {
    const used = new Set(usedCurrencies)
    const next = CURRENCIES.find((c) => !used.has(c.code))?.code ?? 'usd'
    if (priceModel === 'free') {
      append({
        amount_type: 'free',
        price_currency: next as schemas['PresentmentCurrency'],
      })
    } else {
      append({
        amount_type: 'fixed',
        price_amount: 0,
        price_currency: next as schemas['PresentmentCurrency'],
      })
    }
  }
  const removeCurrency = (i: number) => remove(i)

  // ── Trial ─────────────────────────────────────────────────────────────────
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

  // Use organization course module count (if known) for the slider max.
  // Falls back to 20 — same cap the previous numeric input enforced.
  const maxPreviewLessons = 20

  return (
    <StepShell
      step={3}
      total={3}
      nextLabel="Generate outline"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      wide
    >
      <div className="pa-root">
        {/* MEDIA — keep the canonical uploader so files persist correctly. */}
        <section className="pa-section first">
          <div className="pa-section-header">
            <div className="pa-eyebrow">Media</div>
            <h2 className="pa-title">Course cover</h2>
            <p className="pa-desc">
              The first thing students see — in checkout, on your spaire space,
              in shares. 16:9 works best.
            </p>
          </div>
          <ProductMediaSection organization={organization} />
        </section>

        {/* PRICING */}
        <section className="pa-section">
          <div className="pa-section-header">
            <div className="pa-eyebrow">Pricing</div>
            <h2 className="pa-title">How students pay</h2>
            <p className="pa-desc">
              Sell your course once, or charge a recurring fee for ongoing
              access. Add other currencies for international students.
            </p>
          </div>

          <div className="pa-stack">
            {/* Billing cycle — segmented */}
            <div className="pa-field">
              <span className="pa-label">Billing</span>
              <div className="pa-segmented">
                {(
                  [
                    { v: 'onetime', l: 'One-time purchase' },
                    { v: 'recurring', l: 'Recurring subscription' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    className={`pa-seg${cycle === o.v ? 'active' : ''}`}
                    onClick={() => setCycle(o.v)}
                  >
                    {o.l}
                  </button>
                ))}
              </div>

              {cycle === 'recurring' && (
                <div className="pa-recurring">
                  <span>Renew every</span>
                  <input
                    type="number"
                    min={1}
                    className="pa-num"
                    value={recurringIntervalCount}
                    onChange={(e) =>
                      setValue(
                        'recurring_interval_count',
                        Math.max(1, parseInt(e.target.value || '1', 10)),
                      )
                    }
                  />
                  <select
                    className="pa-select"
                    value={recurringInterval ?? 'month'}
                    onChange={(e) =>
                      setValue(
                        'recurring_interval',
                        e.target
                          .value as schemas['SubscriptionRecurringInterval'],
                      )
                    }
                  >
                    {(['day', 'week', 'month', 'year'] as const).map((p) => (
                      <option key={p} value={p}>
                        {recurringIntervalCount > 1 ? `${p}s` : p}
                      </option>
                    ))}
                  </select>
                  <span className="pa-recurring-hint">
                    Charged on enrolment, then every {recurringIntervalCount}{' '}
                    {recurringInterval ?? 'month'}
                    {recurringIntervalCount > 1 ? 's' : ''}.
                  </span>
                </div>
              )}
            </div>

            {/* Price model — choice cards */}
            <div className="pa-field">
              <span className="pa-label">Price</span>
              <div className="pa-choice-row">
                <button
                  type="button"
                  className={`pa-choice${priceModel === 'fixed' ? 'active' : ''}`}
                  onClick={() => setPriceModel('fixed')}
                >
                  <div className="pa-choice-title">Set a price</div>
                  <div className="pa-choice-sub">
                    Charge a fixed amount per enrolment.
                  </div>
                </button>
                <button
                  type="button"
                  className={`pa-choice${priceModel === 'free' ? 'active' : ''}`}
                  onClick={() => setPriceModel('free')}
                >
                  <div className="pa-choice-title">Free course</div>
                  <div className="pa-choice-sub">
                    No charge — open to anyone who enrols.
                  </div>
                </button>
              </div>
            </div>

            {/* Currency price rows */}
            {priceModel === 'fixed' && fields.length > 0 && (
              <div className="pa-prices">
                <PriceRow
                  index={0}
                  primary
                  disabledCurrencies={usedCurrencies}
                />
                {additionalIndices.map((i) => (
                  <PriceRow
                    key={i}
                    index={i}
                    disabledCurrencies={usedCurrencies}
                    onRemove={() => removeCurrency(i)}
                  />
                ))}
                <button
                  type="button"
                  className="pa-add-currency"
                  onClick={addCurrency}
                  disabled={usedCurrencies.length >= CURRENCIES.length}
                >
                  Add another currency
                </button>
              </div>
            )}

            {/* Trial — recurring only */}
            {cycle === 'recurring' && (
              <div className="pa-trial">
                <button
                  type="button"
                  role="switch"
                  aria-checked={trialEnabled}
                  className={`pa-toggle${trialEnabled ? 'on' : ''}`}
                  onClick={() => setTrialEnabled(!trialEnabled)}
                >
                  <span className="pa-toggle-knob" />
                </button>
                <div className="pa-trial-text">
                  <div className="pa-trial-label">Free trial period</div>
                  <div className="pa-trial-desc">
                    Let students explore the course before being charged.
                  </div>
                  {trialEnabled && (
                    <div className="pa-trial-input-row">
                      <span>Trial length</span>
                      <input
                        type="number"
                        min={1}
                        className="pa-num"
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
              </div>
            )}
          </div>
        </section>

        {/* ACCESS */}
        <section className="pa-section">
          <div className="pa-section-header">
            <div className="pa-eyebrow">Access</div>
            <h2 className="pa-title">What students see before paying</h2>
            <p className="pa-desc">
              Give a taste of the course, or keep everything behind the paywall.
            </p>
          </div>

          <div className="pa-choice-row">
            <button
              type="button"
              className={`pa-choice${!paywall.paywallEnabled ? 'active' : ''}`}
              onClick={() =>
                onPaywallChange({ ...paywall, paywallEnabled: false })
              }
            >
              <div className="pa-choice-title">Open access</div>
              <div className="pa-choice-sub">
                Anyone enrolled can watch every lesson.
              </div>
            </button>
            <button
              type="button"
              className={`pa-choice${paywall.paywallEnabled ? 'active' : ''}`}
              onClick={() =>
                onPaywallChange({ ...paywall, paywallEnabled: true })
              }
            >
              <div className="pa-choice-title">Free preview</div>
              <div className="pa-choice-sub">
                First few lessons free, the rest unlocks on purchase.
              </div>
            </button>
          </div>

          {paywall.paywallEnabled && (
            <div className="pa-preview-card">
              <div className="pa-preview-row">
                <div>
                  <div className="pa-preview-title">Free preview lessons</div>
                  <div className="pa-preview-sub">
                    Visible before the paywall. The rest unlock after purchase.
                  </div>
                </div>
                <div className="pa-preview-count">
                  <span className="pa-preview-num">
                    {paywall.freePreviewLessons}
                  </span>
                  <span className="pa-preview-total">
                    / {maxPreviewLessons}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={maxPreviewLessons}
                value={paywall.freePreviewLessons}
                className="pa-slider"
                onChange={(e) =>
                  onPaywallChange({
                    ...paywall,
                    freePreviewLessons: Math.max(
                      0,
                      Math.min(
                        maxPreviewLessons,
                        parseInt(e.target.value || '0', 10),
                      ),
                    ),
                  })
                }
              />
              <div className="pa-slider-legend">
                <span>0 — no preview</span>
                <span>All {maxPreviewLessons} lessons</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        .pa-root {
          --pa-ink: var(--so-black);
          --pa-ink-2: var(--so-gray4);
          --pa-muted: var(--so-gray3);
          --pa-hair: var(--so-gray2);
          --pa-surface: var(--so-white);
          --pa-surface-2: var(--so-gray1);
          --pa-accent: var(--so-black);
          --pa-accent-soft: rgba(10, 10, 10, 0.06);
          font-family: var(--font-poppins), system-ui, sans-serif;
          color: var(--pa-ink);
          display: flex;
          flex-direction: column;
        }
        .pa-section {
          padding-block: 36px;
          border-top: 1px solid var(--pa-hair);
        }
        .pa-section.first {
          border-top: none;
          padding-top: 8px;
        }
        .pa-section-header {
          margin-bottom: 24px;
        }
        .pa-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--pa-muted);
          margin-bottom: 6px;
        }
        .pa-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
          letter-spacing: -0.2px;
          color: var(--pa-ink);
        }
        .pa-desc {
          font-size: 13.5px;
          color: var(--pa-muted);
          margin: 6px 0 0;
          max-width: 520px;
          line-height: 1.5;
        }
        .pa-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .pa-field {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pa-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--pa-ink);
        }

        /* Segmented */
        .pa-segmented {
          display: inline-flex;
          padding: 4px;
          gap: 2px;
          background: var(--pa-surface-2);
          border-radius: 12px;
          border: 1px solid var(--pa-hair);
          align-self: flex-start;
        }
        .pa-seg {
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 9px;
          border: none;
          background: transparent;
          color: var(--pa-muted);
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .pa-seg.active {
          background: #fff;
          color: var(--pa-ink);
          box-shadow:
            0 1px 2px rgba(20, 20, 20, 0.06),
            0 1px 0 var(--pa-hair);
        }

        /* Recurring config row */
        .pa-recurring {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 4px;
          padding: 12px 14px;
          background: var(--pa-surface-2);
          border-radius: 10px;
          border: 1px solid var(--pa-hair);
          font-size: 13px;
          color: var(--pa-ink-2);
        }
        .pa-num {
          width: 64px;
          padding: 7px 10px;
          text-align: center;
          border: 1px solid var(--pa-hair);
          border-radius: 7px;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: var(--pa-ink);
          outline: none;
          font-family: inherit;
        }
        .pa-num:focus {
          border-color: var(--pa-accent);
        }
        .pa-select {
          appearance: none;
          padding: 7px 28px 7px 12px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid var(--pa-hair);
          border-radius: 7px;
          background: #fff
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")
            no-repeat right 8px center;
          color: var(--pa-ink);
          cursor: pointer;
          outline: none;
          font-family: inherit;
        }
        .pa-recurring-hint {
          margin-left: auto;
          font-size: 12px;
          color: var(--pa-muted);
        }

        /* Choice cards */
        .pa-choice-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .pa-choice {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 14px 16px;
          text-align: left;
          width: 100%;
          background: #fff;
          border: 1px solid var(--pa-hair);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--pa-ink);
          font-family: inherit;
        }
        .pa-choice.active {
          background: var(--pa-accent-soft);
          border-color: var(--pa-accent);
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.07);
        }
        .pa-choice-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--pa-ink);
        }
        .pa-choice-sub {
          font-size: 12.5px;
          color: var(--pa-muted);
          line-height: 1.45;
        }

        /* Price rows */
        .pa-prices {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pa-price-row {
          display: flex;
          align-items: center;
          border: 1px solid var(--pa-hair);
          border-radius: 12px;
          background: #fff;
          position: relative;
        }
        .pa-cur {
          position: relative;
        }
        .pa-cur-trigger {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 12px 12px 14px;
          background: transparent;
          border: none;
          border-right: 1px solid var(--pa-hair);
          color: var(--pa-ink);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          min-width: 110px;
          font-family: inherit;
        }
        .pa-cur-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 22px;
          padding: 0 6px;
          border-radius: 6px;
          background: var(--pa-accent-soft);
          color: var(--pa-ink);
          font-size: 11px;
          font-weight: 700;
        }
        .pa-cur-pill.small {
          min-width: 30px;
          height: 26px;
        }
        .pa-cur-code {
          font-weight: 600;
        }
        .pa-cur-chevron {
          margin-left: 2px;
          color: var(--pa-muted);
          font-size: 10px;
        }
        .pa-cur-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          width: 320px;
          padding: 6px;
          z-index: 30;
          background: #fff;
          border: 1px solid var(--pa-hair);
          border-radius: 12px;
          box-shadow:
            0 1px 2px rgba(20, 20, 20, 0.05),
            0 12px 28px rgba(20, 20, 20, 0.1);
          max-height: 360px;
          overflow-y: auto;
        }
        .pa-cur-item {
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
          color: var(--pa-ink);
          cursor: pointer;
          font-family: inherit;
        }
        .pa-cur-item:hover:not(.disabled) {
          background: var(--pa-surface-2);
        }
        .pa-cur-item.active {
          background: var(--pa-surface-2);
        }
        .pa-cur-item.disabled {
          color: var(--pa-muted);
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pa-cur-name {
          color: var(--pa-muted);
          font-size: 12px;
          margin-left: 2px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pa-cur-check {
          margin-left: auto;
          color: var(--pa-accent);
          font-size: 14px;
        }
        .pa-price-input {
          flex: 1;
          padding: 12px 14px;
          font-size: 16px;
          font-weight: 500;
          border: none;
          outline: none;
          background: transparent;
          color: var(--pa-ink);
          min-width: 0;
          font-variant-numeric: tabular-nums;
          font-family: inherit;
        }
        .pa-price-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--pa-muted);
          letter-spacing: 0.5px;
          padding-right: 14px;
          text-transform: uppercase;
        }
        .pa-price-remove {
          width: 36px;
          height: 36px;
          margin-right: 6px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--pa-muted);
          cursor: pointer;
          font-size: 18px;
          font-family: inherit;
        }
        .pa-price-remove:hover {
          background: var(--pa-surface-2);
          color: var(--pa-ink);
        }
        .pa-add-currency {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          border: 1px dashed #c8c8c8;
          color: var(--pa-ink-2);
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
        }
        .pa-add-currency:hover:not(:disabled) {
          background: var(--pa-surface-2);
        }
        .pa-add-currency:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Trial */
        .pa-trial {
          display: flex;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--pa-hair);
        }
        .pa-toggle {
          flex-shrink: 0;
          margin-top: 2px;
          width: 38px;
          height: 22px;
          border-radius: 999px;
          background: #c8c8c8;
          border: none;
          padding: 0;
          position: relative;
          transition: background 0.2s;
          cursor: pointer;
        }
        .pa-toggle.on {
          background: var(--pa-accent);
        }
        .pa-toggle-knob {
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
        .pa-toggle.on .pa-toggle-knob {
          left: 18px;
        }
        .pa-trial-label {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--pa-ink);
        }
        .pa-trial-desc {
          font-size: 12.5px;
          color: var(--pa-muted);
          margin-top: 2px;
        }
        .pa-trial-input-row {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--pa-ink-2);
        }

        /* Free preview slider card */
        .pa-preview-card {
          margin-top: 14px;
          padding: 16px;
          background: var(--pa-surface-2);
          border-radius: 12px;
          border: 1px solid var(--pa-hair);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pa-preview-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }
        .pa-preview-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--pa-ink);
        }
        .pa-preview-sub {
          font-size: 12px;
          color: var(--pa-muted);
          margin-top: 2px;
          max-width: 380px;
        }
        .pa-preview-count {
          display: flex;
          align-items: baseline;
          gap: 4px;
          color: var(--pa-ink);
        }
        .pa-preview-num {
          font-size: 28px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.5px;
        }
        .pa-preview-total {
          font-size: 12px;
          color: var(--pa-muted);
        }
        .pa-slider {
          width: 100%;
          accent-color: var(--pa-accent);
        }
        .pa-slider-legend {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--pa-muted);
        }
      `}</style>
    </StepShell>
  )
}
