'use client'

import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useState } from 'react'

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
        align-items: flex-start;
        justify-content: center;
        padding: 88px 24px 72px;
        background: var(--so-white);
        overflow-y: auto;
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

  // Build letter list with delays
  const chars: { ch: string; delay: number }[] = []
  let idx = 0
  INTRO_WORDS.forEach((word) => {
    word.split('').forEach((ch) => {
      chars.push({ ch, delay: idx * STAGGER_MS })
      idx++
    })
  })
  const periodDelay = idx * STAGGER_MS

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Auto-advance after period lands + settle + pause
  useEffect(() => {
    if (!started) return
    const total = periodDelay + 520 + 700
    const t = setTimeout(() => onNext(), total)
    return () => clearTimeout(t)
  }, [started, periodDelay, onNext])

  // Rebuild word groups from chars
  const wordGroups: (typeof chars)[] = []
  let ci = 0
  INTRO_WORDS.forEach((word) => {
    wordGroups.push(chars.slice(ci, ci + word.length))
    ci += word.length
  })

  const animStyle = (delay: number) =>
    started
      ? { animation: `soLetterUp 0.52s cubic-bezier(0.22,1,0.36,1) ${delay}ms forwards` }
      : {}

  return (
    <>
      <TopBar onClose={onClose} />
      <div className="so-intro-stage">
        <h1 className="so-intro-headline">
          {wordGroups.map((group, wi) => (
            <span key={wi} className="so-intro-word">
              {group.map((c, li) => (
                <span key={li} className="so-intro-letter" style={animStyle(c.delay)}>
                  {c.ch}
                </span>
              ))}
            </span>
          ))}
          {/* Orange period */}
          <span className="so-intro-word" style={{ marginLeft: 0, gap: 0 }}>
            <span
              className="so-intro-letter"
              style={{ color: 'var(--so-orange)', ...animStyle(periodDelay) }}
            >
              .
            </span>
          </span>
        </h1>
      </div>
    </>
  )
}

// ─── Step shell ───────────────────────────────────────────────────────────────

function StepShell({
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
}: {
  step: number
  total: number
  title: string
  eyebrow?: string
  children: React.ReactNode
  onNext: () => void
  onBack: () => void
  onClose: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <>
      <ProgressBar pct={(step / total) * 100} />
      <TopBar step={step} total={total} onClose={onClose} />
      <div className="so-stage">
        <div className="so-screen">
          <div className="so-eyebrow">
            {eyebrow ?? `Step ${step} of ${total}`}
          </div>
          <h2 className="so-title">{title}</h2>
          {children}
          <div className="so-btn-row">
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
      total={4}
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
      total={4}
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

// ─── Step 3: Pricing ──────────────────────────────────────────────────────────

export type PricingState = {
  billing: 'one-time' | 'recurring'
  model: 'fixed' | 'free'
  amount: string
  interval: 'month' | 'year'
  intervalCount: number
  paywallOn: boolean
  paywallPos: number
  totalLessons: number
}

const radioCard = (selected: boolean) => ({
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: 14,
  padding: '13px 16px',
  background: selected ? '#ffffff' : '#f4f4f4',
  border: `1.5px solid ${selected ? '#0a0a0a' : '#e8e8e8'}`,
  borderRadius: 12,
  cursor: 'pointer' as const,
  transition: 'all 0.18s',
  textAlign: 'left' as const,
  width: '100%',
  boxShadow: selected ? '0 0 0 3px rgba(10,10,10,0.06)' : 'none',
  fontFamily: 'inherit',
})

const pillBtn = (active: boolean) => ({
  flex: 1,
  padding: '10px 0',
  background: active ? 'var(--so-black)' : 'var(--so-gray1)',
  border: `1.5px solid ${active ? 'var(--so-black)' : 'var(--so-gray2)'}`,
  borderRadius: 100,
  color: active ? 'var(--so-white)' : 'var(--so-gray4)',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer' as const,
  transition: 'all 0.18s',
})

export function StepPricing({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: PricingState
  onChange: (next: PricingState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  const set = (patch: Partial<PricingState>) => onChange({ ...data, ...patch })
  const canContinue = data.model === 'free' || data.amount.trim() !== ''

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
          </label>
        )}
      </div>

      {/* Pricing model */}
      <div className="so-label" style={{ marginBottom: 8 }}>Pricing model</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: data.model === 'fixed' ? 14 : 24 }}>
        {([{ id: 'fixed', label: 'Fixed price' }, { id: 'free', label: 'Free' }] as const).map((opt) => (
          <button key={opt.id} type="button"
            onClick={() => set({ model: opt.id })}
            style={pillBtn(data.model === opt.id)}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Price input (fixed only) */}
      {data.model === 'fixed' && (
        <div style={{ marginBottom: 24, animation: 'soScreenIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, fontWeight: 500, color: 'var(--so-gray4)', pointerEvents: 'none',
            }}>$</span>
            <input
              className="so-input"
              type="number" min={0} step={1} placeholder="0"
              value={data.amount}
              onChange={(e) => set({ amount: e.target.value })}
              style={{ paddingLeft: 30 }}
              autoFocus
            />
          </div>
          {data.billing === 'recurring' && data.amount && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--so-gray3)' }}>
              Charged every {data.intervalCount > 1 ? `${data.intervalCount} ` : ''}{data.interval}{data.intervalCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--so-gray2)', margin: '0 0 24px' }} />

      {/* Paywall toggle */}
      <div style={{ marginBottom: data.paywallOn ? 20 : 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--so-black)', marginBottom: 4 }}>Paywall</div>
            <div style={{ fontSize: 12, color: 'var(--so-gray3)', lineHeight: 1.55, maxWidth: 290 }}>
              Place a paywall between lessons. Lessons above are free preview; everything after is locked until purchase.
            </div>
          </div>
          <button type="button"
            onClick={() => set({ paywallOn: !data.paywallOn })}
            style={{
              width: 44, height: 26, borderRadius: 100,
              background: data.paywallOn ? '#7c3aed' : 'var(--so-gray2)',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              position: 'relative', transition: 'background 0.22s', marginTop: 2,
            }}>
            <div style={{
              position: 'absolute', top: 3,
              left: data.paywallOn ? 21 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#ffffff',
              transition: 'left 0.22s cubic-bezier(0.22,1,0.36,1)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>
      </div>

      {/* Paywall position */}
      {data.paywallOn && (
        <div style={{ animation: 'soScreenIn 0.32s cubic-bezier(0.22,1,0.36,1) forwards', marginBottom: 8 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--so-black)', marginBottom: 3 }}>Paywall position</div>
            <div style={{ fontSize: 12, color: 'var(--so-gray3)', lineHeight: 1.5 }}>
              Number of lessons visible before the paywall.
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--so-gray1)', border: '1.5px solid var(--so-gray2)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <button type="button"
              onClick={() => set({ paywallPos: Math.max(0, data.paywallPos - 1) })}
              style={{
                width: 48, height: 52, border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 22, fontWeight: 300, color: 'var(--so-gray4)',
                transition: 'background 0.15s, color 0.15s', flexShrink: 0, lineHeight: 1, fontFamily: 'inherit',
              }}>−</button>
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', borderLeft: '1px solid var(--so-gray2)', borderRight: '1px solid var(--so-gray2)',
            }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--so-black)', lineHeight: 1 }}>
                {data.paywallPos}
              </span>
              <span style={{ fontSize: 11, color: 'var(--so-gray3)', marginTop: 3 }}>
                of {data.totalLessons} lessons visible
              </span>
            </div>
            <button type="button"
              onClick={() => set({ paywallPos: Math.min(data.totalLessons, data.paywallPos + 1) })}
              style={{
                width: 48, height: 52, border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 22, fontWeight: 300, color: 'var(--so-gray4)',
                transition: 'background 0.15s, color 0.15s', flexShrink: 0, lineHeight: 1, fontFamily: 'inherit',
              }}>+</button>
          </div>
          {/* Dot strip */}
          <div style={{ marginTop: 12, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {Array.from({ length: data.totalLessons }).map((_, i) => (
              <div key={i}
                onClick={() => set({ paywallPos: i + 1 })}
                style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: i < data.paywallPos ? '#7c3aed' : 'var(--so-gray2)',
                  transition: 'background 0.12s', cursor: 'pointer',
                }} />
            ))}
          </div>
          <div style={{ marginTop: 7, fontSize: 11, color: 'var(--so-gray3)' }}>
            {data.paywallPos === 0
              ? 'All lessons locked — no free preview.'
              : data.paywallPos === data.totalLessons
              ? 'All lessons free — no paywall.'
              : `${data.totalLessons - data.paywallPos} lesson${data.totalLessons - data.paywallPos === 1 ? '' : 's'} locked.`}
          </div>
        </div>
      )}
    </StepShell>
  )
}

// ─── Step 4: Pricing & access ────────────────────────────────────────────────

export type BillingType = 'one_time' | 'subscription'
export type RecurringInterval = 'month' | 'year'

export type PricingState = {
  paywallEnabled: boolean
  billingType: BillingType
  recurringInterval: RecurringInterval
  currency: string
  priceCents: number
  freePreviewLessons: number
}

const CURRENCY_OPTIONS: { code: string; label: string; symbol: string }[] = [
  { code: 'usd', label: 'USD', symbol: '$' },
  { code: 'eur', label: 'EUR', symbol: '€' },
  { code: 'gbp', label: 'GBP', symbol: '£' },
  { code: 'cad', label: 'CAD', symbol: 'CA$' },
  { code: 'aud', label: 'AUD', symbol: 'A$' },
  { code: 'jpy', label: 'JPY', symbol: '¥' },
  { code: 'chf', label: 'CHF', symbol: 'Fr' },
  { code: 'sek', label: 'SEK', symbol: 'kr' },
]

function symbolFor(code: string): string {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol ?? '$'
}

export function StepPricing({
  data,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  data: PricingState
  onChange: (next: PricingState) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  const [priceText, setPriceText] = useState(
    data.paywallEnabled && data.priceCents > 0
      ? (data.priceCents / 100).toFixed(0)
      : '',
  )

  const validPrice =
    !data.paywallEnabled ||
    (data.priceCents > 0 && Number.isFinite(data.priceCents))

  return (
    <StepShell
      step={4}
      total={4}
      title="Pricing & access"
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextLabel="Generate outline"
      nextDisabled={!validPrice}
    >
      <div className="so-fields">
        {/* ── Access ────────────────────────────────────────── */}
        <div className="so-field">
          <label className="so-label">Access</label>
          <div className="so-pricing-toggle-row">
            <button
              type="button"
              className={`so-pricing-card${!data.paywallEnabled ? 'selected' : ''}`}
              onClick={() =>
                onChange({ ...data, paywallEnabled: false, priceCents: 0 })
              }
            >
              <div className="so-pricing-card-title">Free</div>
              <div className="so-pricing-card-sub">
                Anyone can watch every lesson.
              </div>
            </button>
            <button
              type="button"
              className={`so-pricing-card${data.paywallEnabled ? 'selected' : ''}`}
              onClick={() => onChange({ ...data, paywallEnabled: true })}
            >
              <div className="so-pricing-card-title">Paid</div>
              <div className="so-pricing-card-sub">
                First few lessons free, rest unlocks on purchase.
              </div>
            </button>
          </div>
        </div>

        {data.paywallEnabled && (
          <>
            {/* ── Billing model ─────────────────────────────── */}
            <div className="so-field">
              <label className="so-label">Billing model</label>
              <div className="so-pricing-toggle-row">
                <button
                  type="button"
                  className={`so-pricing-card${data.billingType === 'one_time' ? 'selected' : ''}`}
                  onClick={() => onChange({ ...data, billingType: 'one_time' })}
                >
                  <div className="so-pricing-card-title">One-time</div>
                  <div className="so-pricing-card-sub">
                    Pay once, watch forever.
                  </div>
                </button>
                <button
                  type="button"
                  className={`so-pricing-card${data.billingType === 'subscription' ? 'selected' : ''}`}
                  onClick={() =>
                    onChange({ ...data, billingType: 'subscription' })
                  }
                >
                  <div className="so-pricing-card-title">Subscription</div>
                  <div className="so-pricing-card-sub">
                    Recurring access, monthly or yearly.
                  </div>
                </button>
              </div>
            </div>

            {/* ── Recurring interval (subscription only) ────── */}
            {data.billingType === 'subscription' && (
              <div className="so-field">
                <label className="so-label">Renews</label>
                <div className="so-segment-row">
                  {(['month', 'year'] as const).map((iv) => (
                    <button
                      key={iv}
                      type="button"
                      className={`so-segment${data.recurringInterval === iv ? 'selected' : ''}`}
                      onClick={() =>
                        onChange({ ...data, recurringInterval: iv })
                      }
                    >
                      {iv === 'month' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Currency + price ──────────────────────────── */}
            <div className="so-field">
              <label className="so-label">Price</label>
              <div className="so-price-row">
                <select
                  className="so-currency"
                  value={data.currency}
                  onChange={(e) =>
                    onChange({ ...data, currency: e.target.value })
                  }
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#6a6a6a',
                      fontSize: 15,
                      pointerEvents: 'none',
                    }}
                  >
                    {symbolFor(data.currency)}
                  </span>
                  <input
                    className="so-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="79"
                    value={priceText}
                    style={{
                      paddingLeft:
                        symbolFor(data.currency).length > 1 ? 44 : 28,
                    }}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '')
                      setPriceText(raw)
                      const amount = parseFloat(raw)
                      // Most currencies use 2 minor units; JPY uses 0.
                      const minorUnits = data.currency === 'jpy' ? 1 : 100
                      onChange({
                        ...data,
                        priceCents: Number.isFinite(amount)
                          ? Math.round(amount * minorUnits)
                          : 0,
                      })
                    }}
                  />
                </div>
              </div>
              <span className="so-hint">
                {data.billingType === 'subscription'
                  ? `What students pay every ${data.recurringInterval}.`
                  : 'What students pay once to enroll. You can change this later.'}
              </span>
            </div>

            {/* ── Free preview lessons ──────────────────────── */}
            <div className="so-field">
              <label className="so-label">Free preview lessons</label>
              <input
                className="so-input"
                type="number"
                min={0}
                max={20}
                value={data.freePreviewLessons}
                onChange={(e) =>
                  onChange({
                    ...data,
                    freePreviewLessons: Math.max(
                      0,
                      Math.min(20, parseInt(e.target.value || '0', 10)),
                    ),
                  })
                }
              />
              <span className="so-hint">
                Lessons visible before the paywall. The rest unlock after
                purchase.
              </span>
            </div>
          </>
        )}
      </div>
      <style jsx global>{`
        .so-pricing-toggle-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .so-pricing-card {
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
          font-family: var(--font-poppins), system-ui, sans-serif;
          color: var(--so-black);
          -webkit-appearance: none;
        }
        .so-pricing-card:hover {
          border-color: #c8c8c8;
          background: #f0f0f0;
        }
        .so-pricing-card.selected {
          border-color: var(--so-black);
          background: var(--so-white);
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.07);
        }
        .so-pricing-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--so-black);
          margin-bottom: 4px;
        }
        .so-pricing-card-sub {
          font-size: 12px;
          color: var(--so-gray3);
          line-height: 1.5;
        }
        .so-segment-row {
          display: inline-flex;
          padding: 4px;
          background: var(--so-gray1);
          border: 1.5px solid var(--so-gray2);
          border-radius: 12px;
        }
        .so-segment {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--so-gray4);
          cursor: pointer;
          transition:
            background 0.15s,
            color 0.15s;
        }
        .so-segment.selected {
          background: var(--so-white);
          color: var(--so-black);
          box-shadow: 0 1px 2px rgba(10, 10, 10, 0.08);
        }
        .so-price-row {
          display: flex;
          gap: 10px;
        }
        .so-currency {
          padding: 13px 14px;
          background: var(--so-gray1);
          border: 1.5px solid var(--so-gray2);
          border-radius: 10px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: var(--so-black);
          outline: none;
          cursor: pointer;
        }
        .so-currency:focus {
          border-color: var(--so-black);
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.07);
        }
      `}</style>
    </StepShell>
  )
}
