'use client'

import type { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import {
  CoachingWizardStyles,
  GhostButton,
  PrimaryButton,
} from './CoachingWizard.primitives'
import {
  StepCoach,
  StepMedia,
  StepPricing,
  StepProgram,
} from './CoachingWizard.steps'
import { StepAI, type PartialOutline } from './CoachingWizard.ai'
import { Preview } from './CoachingWizard.preview'
import { RightPanel } from './CoachingWizard.rightPanel'

// ─── Wizard state ───────────────────────────────────────────────────────────
export type WizardState = {
  // Step 1 — Coach
  coachName: string
  coachBio: string
  coachCreds: string
  coachPhoto: boolean
  // Step 2 — Program
  programTitle: string
  promise: string
  format: '' | 'self' | 'cohort' | 'hybrid'
  startDate: string
  endDate: string
  weeks: string
  // Step 3 — Media
  thumbnail: boolean
  trailer: boolean
  // Step 4 — Pricing
  pricingModel: 'onetime' | 'subscription' | 'plan'
  price: string
  interval: 'Monthly' | 'Yearly'
  installments: string
  access: string
  freePreview: boolean
  // Step 5 — AI
  aiPrompt: string
  generationDone: boolean
}

const INITIAL_STATE: WizardState = {
  coachName: '',
  coachBio: '',
  coachCreds: '',
  coachPhoto: false,
  programTitle: '',
  promise: '',
  format: '',
  startDate: '',
  endDate: '',
  weeks: '',
  thumbnail: false,
  trailer: false,
  pricingModel: 'onetime',
  price: '',
  interval: 'Monthly',
  installments: '3',
  access: 'lifetime',
  freePreview: false,
  aiPrompt: '',
  generationDone: false,
}

// ─── Main wizard ────────────────────────────────────────────────────────────
export default function CoachingWizard({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1..5, 6=preview
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [aiCanContinue, setAiCanContinue] = useState(false)
  const [aiResult, setAiResult] = useState<PartialOutline | null>(null)

  useEffect(() => {
    if (step !== 5) setAiCanContinue(false)
    if (step === 5 && state.generationDone) setAiCanContinue(true)
  }, [step, state.generationDone])

  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }))

  const canContinue = (() => {
    if (step === 1) return state.coachName.trim().length > 0
    if (step === 2)
      return state.programTitle.trim().length > 0 && !!state.format
    if (step === 3) return true
    if (step === 4)
      return !!state.pricingModel && (state.price || '').toString().length > 0
    if (step === 5) return aiCanContinue
    return true
  })()

  const next = () => {
    if (step < 5) setStep(step + 1)
    else if (step === 5) setStep(6)
  }
  const back = () => {
    if (step > 1) setStep(step - 1)
  }

  const onSaveAndExit = () => {
    // v1: data isn't yet persisted between steps, so we just navigate away
    // without confirmation.
    router.push(`/dashboard/${organization.slug}/products`)
  }

  const content = (() => {
    if (step === 1) return <StepCoach state={state} update={update} />
    if (step === 2) return <StepProgram state={state} update={update} />
    if (step === 3) return <StepMedia state={state} update={update} />
    if (step === 4) return <StepPricing state={state} update={update} />
    if (step === 5)
      return (
        <StepAI
          state={state}
          update={update}
          organization={{ slug: organization.slug }}
          onComplete={() => setAiCanContinue(true)}
          onResult={setAiResult}
        />
      )
    if (step === 6)
      return (
        <Preview
          state={state}
          aiResult={aiResult}
          organization={organization}
          onEdit={() => setStep(1)}
        />
      )
    return null
  })()

  return (
    <div
      className="coaching-wizard"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.7fr)',
        height: '100vh',
        background: '#fff',
      }}
    >
      <CoachingWizardStyles />

      {/* Left content */}
      <div
        className="pane"
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Top bar — progress dots + Save & exit */}
        <div
          style={{
            padding: '24px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ProgressDots current={step} total={5} />
          <button
            type="button"
            onClick={onSaveAndExit}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              color: 'var(--muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 6,
            }}
          >
            Save & exit
          </button>
        </div>

        {/* Scroll area */}
        <div
          className="pane"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 48px 140px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: 540 }}>{content}</div>
        </div>

        {/* Sticky bottom bar */}
        {step <= 5 && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 48px 20px',
              background:
                'linear-gradient(to top, #fff 70%, rgba(255,255,255,0.9) 90%, rgba(255,255,255,0))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginTop: 'auto',
              flexShrink: 0,
            }}
          >
            <GhostButton
              onClick={back}
              style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
            >
              Back
            </GhostButton>
            <PrimaryButton onClick={next} disabled={!canContinue}>
              {step === 5 ? 'Continue to preview' : 'Continue'}
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* Right panel */}
      <RightPanel currentStep={step} />
    </div>
  )
}

// ─── ProgressDots ───────────────────────────────────────────────────────────
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const active = idx === current
        const done = idx < current
        return (
          <div
            key={i}
            style={{
              height: 4,
              width: active ? 28 : done ? 18 : 18,
              borderRadius: 2,
              background: active
                ? 'var(--ink)'
                : done
                  ? 'var(--ink)'
                  : '#E5E5EA',
              transition: 'all 250ms cubic-bezier(0.2, 0.7, 0.2, 1)',
            }}
          />
        )
      })}
      <span
        style={{
          marginLeft: 10,
          fontSize: 12.5,
          color: 'var(--muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.min(current, total)} / {total}
      </span>
    </div>
  )
}
