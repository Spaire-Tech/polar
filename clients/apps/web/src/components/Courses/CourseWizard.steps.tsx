'use client'

import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useRef, useState } from 'react'

// ─── Shared style block (CSS-in-JSX) ─────────────────────────────────────────

export function SpaireOnboardingStyles() {
  return (
    <style jsx global>{`
      .spaire-onboarding {
        --so-bg: #080808;
        --so-surface: rgba(255, 255, 255, 0.055);
        --so-border: rgba(255, 255, 255, 0.11);
        --so-border-focus: rgba(255, 255, 255, 0.38);
        --so-glass-blur: blur(24px) saturate(160%);
        --so-ink: #f2f1ee;
        --so-ink2: rgba(242, 241, 238, 0.5);
        --so-ink3: rgba(242, 241, 238, 0.28);
        background: var(--so-bg);
        color: var(--so-ink);
        font-family: var(--font-dm-sans), system-ui, sans-serif;
        position: fixed;
        inset: 0;
        overflow: hidden;
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
        font-family: var(--font-instrument-serif), Georgia, serif;
        font-size: 17px;
        letter-spacing: -0.02em;
        color: var(--so-ink);
      }
      .so-step-counter {
        font-size: 12px;
        color: var(--so-ink3);
        letter-spacing: 0.04em;
      }
      .so-close {
        background: none;
        border: none;
        color: var(--so-ink3);
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
        color: var(--so-ink);
        background: rgba(255, 255, 255, 0.08);
      }
      .so-progress-track {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: var(--so-border);
        z-index: 201;
      }
      .so-progress-fill {
        height: 100%;
        background: rgba(255, 255, 255, 0.4);
        transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .so-stage {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 24px 100px;
      }
      .so-screen {
        width: 100%;
        max-width: 480px;
        animation: soScreenIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes soScreenIn {
        from {
          opacity: 0;
          transform: translateY(28px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .so-eyebrow {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--so-ink3);
        margin-bottom: 20px;
      }
      .so-title {
        font-family: var(--font-instrument-serif), Georgia, serif;
        font-size: clamp(34px, 5vw, 52px);
        line-height: 1.1;
        letter-spacing: -0.025em;
        color: var(--so-ink);
        margin-bottom: 40px;
      }
      .so-fields {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 36px;
      }
      .so-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .so-label {
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--so-ink3);
        text-transform: uppercase;
      }
      .so-input,
      .so-textarea {
        width: 100%;
        padding: 14px 18px;
        background: var(--so-surface);
        -webkit-backdrop-filter: var(--so-glass-blur);
        backdrop-filter: var(--so-glass-blur);
        border: 1px solid var(--so-border);
        border-radius: 14px;
        font-family: inherit;
        font-size: 15px;
        font-weight: 300;
        color: var(--so-ink);
        outline: none;
        transition:
          border-color 0.25s,
          background 0.25s,
          box-shadow 0.25s;
        -webkit-appearance: none;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          0 2px 16px rgba(0, 0, 0, 0.25);
      }
      .so-textarea {
        resize: none;
        line-height: 1.6;
      }
      .so-input::placeholder,
      .so-textarea::placeholder {
        color: var(--so-ink3);
      }
      .so-input:focus,
      .so-textarea:focus {
        border-color: var(--so-border-focus);
        background: rgba(255, 255, 255, 0.08);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.12),
          0 4px 24px rgba(0, 0, 0, 0.3);
      }
      .so-hint {
        font-size: 12px;
        color: var(--so-ink3);
        line-height: 1.5;
      }
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
        padding: 14px 28px;
        background: var(--so-ink);
        color: var(--so-bg);
        border: none;
        border-radius: 100px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        letter-spacing: -0.01em;
        transition:
          opacity 0.18s,
          transform 0.15s;
      }
      .so-btn-cta:hover {
        opacity: 0.88;
        transform: translateY(-1px);
      }
      .so-btn-cta:active {
        transform: translateY(0);
      }
      .so-btn-cta:disabled {
        opacity: 0.2;
        pointer-events: none;
      }
      .so-btn-back {
        background: none;
        border: none;
        font-family: inherit;
        font-size: 13px;
        color: var(--so-ink3);
        cursor: pointer;
        padding: 8px 0;
        transition: color 0.15s;
      }
      .so-btn-back:hover {
        color: var(--so-ink2);
      }

      /* Intro */
      .so-intro-stage {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 24px 100px;
      }
      .so-intro-headline {
        font-family: var(--font-instrument-serif), Georgia, serif;
        font-size: clamp(52px, 8vw, 96px);
        line-height: 1.06;
        letter-spacing: -0.03em;
        color: var(--so-ink);
        max-width: 720px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0 0.2em;
        text-align: center;
      }
      .so-intro-word {
        display: inline-flex;
      }
      .so-intro-letter {
        display: inline-block;
        opacity: 0;
        transform: translateY(16px);
        transition:
          opacity 0.38s ease,
          transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .so-intro-letter.v {
        opacity: 1;
        transform: translateY(0);
      }
      .so-intro-cta {
        margin-top: 44px;
        opacity: 0;
        transform: translateY(10px);
        transition:
          opacity 0.5s ease,
          transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .so-intro-cta.v {
        opacity: 1;
        transform: translateY(0);
      }

      /* Media cards */
      .so-media-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 36px;
      }
      .so-media-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 18px 20px;
        background: var(--so-surface);
        -webkit-backdrop-filter: var(--so-glass-blur);
        backdrop-filter: var(--so-glass-blur);
        border: 1px solid var(--so-border);
        border-radius: 16px;
        cursor: pointer;
        transition:
          border-color 0.25s,
          background 0.25s,
          box-shadow 0.25s;
        text-align: left;
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        position: relative;
        font-family: inherit;
        color: var(--so-ink);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          0 2px 16px rgba(0, 0, 0, 0.2);
      }
      .so-media-card:hover {
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.075);
      }
      .so-media-card.selected {
        border-color: rgba(255, 255, 255, 0.38);
        background: rgba(255, 255, 255, 0.09);
      }
      .so-media-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.07);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .so-media-text {
        flex: 1;
      }
      .so-media-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--so-ink);
        margin-bottom: 2px;
      }
      .so-media-sub {
        font-size: 12px;
        color: var(--so-ink3);
      }
      .so-media-check {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1.5px solid var(--so-border);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition:
          border-color 0.2s,
          background 0.2s;
      }
      .so-media-card.selected .so-media-check {
        border-color: var(--so-ink);
        background: var(--so-ink);
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
        padding: 18px 20px;
        background: rgba(255, 255, 255, 0.04);
        backdrop-filter: var(--so-glass-blur);
        -webkit-backdrop-filter: var(--so-glass-blur);
        border: 1px dashed rgba(255, 255, 255, 0.14);
        border-radius: 16px;
        cursor: pointer;
        font-size: 13px;
        color: var(--so-ink2);
      }
      .so-upload-zone:hover {
        border-color: rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.06);
      }
    `}</style>
  )
}

// ─── Top bar (logo + close + step counter) ──────────────────────────────────

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

// ─── Intro screen ────────────────────────────────────────────────────────────

const INTRO_HEADLINE = 'Sell your expertise'

export function Intro({
  onNext,
  onClose,
}: {
  onNext: () => void
  onClose: () => void
}) {
  const words = INTRO_HEADLINE.trim().split(' ')
  const total = words.reduce((s, w) => s + w.length, 0)
  const [vis, setVis] = useState(0)
  const [ctaVis, setCtaVis] = useState(false)

  useEffect(() => {
    setVis(0)
    setCtaVis(false)
    let i = 0
    const iv = setInterval(() => {
      i++
      setVis(i)
      if (i >= total) clearInterval(iv)
    }, 52)
    return () => clearInterval(iv)
  }, [total])

  useEffect(() => {
    if (vis >= total && total > 0) {
      const t = setTimeout(() => setCtaVis(true), 280)
      return () => clearTimeout(t)
    }
  }, [vis, total])

  let gi = -1
  return (
    <>
      <TopBar onClose={onClose} />
      <div className="so-intro-stage">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h1 className="so-intro-headline">
            {words.map((word, wi) => (
              <span key={wi} className="so-intro-word">
                {word.split('').map((ch, ci) => {
                  gi++
                  const idx = gi
                  return (
                    <span
                      key={ci}
                      className={`so-intro-letter${idx < vis ? 'v' : ''}`}
                    >
                      {ch}
                    </span>
                  )
                })}
              </span>
            ))}
          </h1>
          <div className={`so-intro-cta${ctaVis ? 'v' : ''}`}>
            <button type="button" className="so-btn-cta" onClick={onNext}>
              Get started
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
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Step shell ──────────────────────────────────────────────────────────────

function StepShell({
  step,
  total,
  title,
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
  children: React.ReactNode
  onNext: () => void
  onBack: () => void
  onClose: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  const pct = (step / total) * 100
  return (
    <>
      <ProgressBar pct={pct} />
      <TopBar step={step} total={total} onClose={onClose} />
      <div className="so-stage">
        <div className="so-screen">
          <div className="so-eyebrow">
            Step {step} of {total}
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

// ─── Step 1: Instructor ─────────────────────────────────────────────────────

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
      title="Instructor details."
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

// ─── Step 2: Course ─────────────────────────────────────────────────────────

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
      title="Course details."
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
          <span className="so-hint">
            Summarize what students will learn in one sentence.
          </span>
        </div>
      </div>
    </StepShell>
  )
}

// ─── Step 3: Hero media ─────────────────────────────────────────────────────

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
        <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
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
        <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
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
      total={3}
      title="Hero media."
      onNext={onNext}
      onBack={onBack}
      onClose={onClose}
      nextLabel="Publish course"
      nextDisabled={!data.format}
    >
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
              onClick={() => onChange({ ...data, format: opt.id })}
            >
              <div className="so-media-icon">{opt.icon}</div>
              <div className="so-media-text">
                <div className="so-media-title">{opt.label}</div>
                <div className="so-media-sub">{opt.sub}</div>
                {isSelected && filename && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'rgba(242,241,238,0.6)',
                      marginTop: 4,
                      fontStyle: 'italic',
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
                    stroke="#080808"
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
                stroke="rgba(242,241,238,0.5)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"
                stroke="rgba(242,241,238,0.28)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span>
              {data.format === 'thumbnail'
                ? data.thumbName
                  ? `✓ ${data.thumbName}`
                  : 'Upload thumbnail'
                : data.videoName
                  ? `✓ ${data.videoName}`
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
