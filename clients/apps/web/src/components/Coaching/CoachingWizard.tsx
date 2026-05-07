'use client'

import { useCreateProduct } from '@/hooks/queries/products'
import type { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCoachingDraft,
  deleteCoachingProgram,
  finalizeAI,
  patchCoachingProgram,
  uploadCoachPhoto as uploadCoachPhotoApi,
  uploadThumbnail as uploadThumbnailApi,
  type CoachingProgram,
  type CoachingProgramPatch,
} from './api'
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
  // Real persisted URL (or object URL while pending). null = no photo.
  coachPhotoUrl: string | null
  // Pending File for step 1 — uploaded the moment the program is created.
  pendingCoachPhoto: File | null
  // Step 2 — Program
  programTitle: string
  promise: string
  format: '' | 'self' | 'cohort' | 'hybrid'
  startDate: string
  endDate: string
  weeks: string
  // Step 3 — Media
  thumbnailUrl: string | null
  pendingThumbnail: File | null
  // Trailer is OUT OF SCOPE for this PR — kept as a no-op boolean to preserve
  // the existing dropzone visual. Marked "Coming soon" in the UI.
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
  coachPhotoUrl: null,
  pendingCoachPhoto: null,
  programTitle: '',
  promise: '',
  format: '',
  startDate: '',
  endDate: '',
  weeks: '',
  thumbnailUrl: null,
  pendingThumbnail: null,
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
  const createProduct = useCreateProduct(organization)
  const [step, setStep] = useState(1) // 1..5, 6=preview
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [aiCanContinue, setAiCanContinue] = useState(false)
  const [aiResult, setAiResult] = useState<PartialOutline | null>(null)
  const [programId, setProgramId] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)

  useEffect(() => {
    if (step !== 5) setAiCanContinue(false)
    if (step === 5 && state.generationDone) setAiCanContinue(true)
  }, [step, state.generationDone])

  const update = useCallback((patch: Partial<WizardState>) => {
    setState((s) => ({ ...s, ...patch }))
  }, [])

  // ── Debounced PATCH /v1/coaching/{programId} ─────────────────────────────
  // Whenever wizard state mutates AND a programId exists (i.e. step 3+), we
  // schedule a 600ms-debounced patch with the up-to-date wizard fields. This
  // keeps the draft persisted without firing on every keystroke.
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!programId) return
    if (patchTimer.current) clearTimeout(patchTimer.current)
    patchTimer.current = setTimeout(() => {
      const body: CoachingProgramPatch = {
        title: state.programTitle || undefined,
        format: state.format || undefined,
        cohort_start: state.startDate || null,
        cohort_end: state.endDate || null,
        weeks: state.weeks ? parseInt(state.weeks, 10) : null,
        promise: state.promise || null,
        coach_name: state.coachName || null,
        coach_bio: state.coachBio || null,
        coach_credentials: state.coachCreds || null,
        pricing_model: state.pricingModel,
        access_duration: state.access || 'lifetime',
        free_preview: state.freePreview,
      }
      patchCoachingProgram(programId, body).catch(() => {
        /* surfaced in the network tab; non-fatal for draft UX */
      })
    }, 600)
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    programId,
    state.programTitle,
    state.format,
    state.startDate,
    state.endDate,
    state.weeks,
    state.promise,
    state.coachName,
    state.coachBio,
    state.coachCreds,
    state.pricingModel,
    state.access,
    state.freePreview,
  ])

  // ── Pre-create product + draft when leaving step 2 ───────────────────────
  const ensureDraft = async (): Promise<string | null> => {
    if (programId) return programId
    setTransitioning(true)
    setDraftError(null)
    try {
      const priceAmountCents = Math.max(
        Math.round(parseFloat(state.price || '0') * 100),
        0,
      )
      const isSub = state.pricingModel === 'subscription'
      const recurring_interval: 'month' | 'year' | null = isSub
        ? state.interval === 'Monthly'
          ? 'month'
          : 'year'
        : null

      const productBody = {
        name: state.programTitle || 'Untitled Program',
        description: state.promise || null,
        organization_id: organization.id,
        product_type: 'coaching',
        recurring_interval,
        prices: [
          {
            amount_type: 'fixed' as const,
            // Use a placeholder $1 if user hasn't entered the price yet; we
            // re-validate at step 4 anyway.
            price_amount: priceAmountCents > 0 ? priceAmountCents : 100,
            price_currency: 'usd',
          },
        ],
        medias: [],
        metadata: {},
      } as unknown as schemas['ProductCreate']

      const result = await createProduct.mutateAsync(productBody)
      if (result.error || !result.data) {
        throw new Error(
          `Product creation failed: ${JSON.stringify(result.error ?? {})}`,
        )
      }
      const productIdNew = result.data.id

      const program = await createCoachingDraft({
        product_id: productIdNew,
        title: state.programTitle || undefined,
        organization_id: organization.id,
      })
      setProgramId(program.id)

      // After the draft exists, flush any pending file uploads from step 1.
      await flushPendingUploads(program.id)

      return program.id
    } catch (e) {
      console.error('[CoachingWizard] ensureDraft failed:', e)
      setDraftError(
        e instanceof Error ? e.message : 'Could not create the program draft.',
      )
      return null
    } finally {
      setTransitioning(false)
    }
  }

  // ── Flush pending uploads (called once a programId exists) ──────────────
  const flushPendingUploads = async (id: string) => {
    if (state.pendingCoachPhoto) {
      try {
        const program = await uploadCoachPhotoApi(id, state.pendingCoachPhoto)
        update({
          coachPhotoUrl: program.coach_photo_url ?? state.coachPhotoUrl,
          pendingCoachPhoto: null,
        })
      } catch {
        update({ pendingCoachPhoto: null })
      }
    }
    if (state.pendingThumbnail) {
      try {
        const program = await uploadThumbnailApi(id, state.pendingThumbnail)
        update({
          thumbnailUrl: program.thumbnail_url ?? state.thumbnailUrl,
          pendingThumbnail: null,
        })
      } catch {
        update({ pendingThumbnail: null })
      }
    }
  }

  // ── Coach-photo upload (step 1) ──────────────────────────────────────────
  // If a programId exists, hit the endpoint immediately. Otherwise stash the
  // File and a local object-URL preview; the upload runs once the draft is
  // created at the step-2→3 boundary.
  const uploadCoachPhoto = async (file: File): Promise<string | null> => {
    if (!programId) {
      const localUrl = URL.createObjectURL(file)
      update({ pendingCoachPhoto: file, coachPhotoUrl: localUrl })
      return localUrl
    }
    try {
      const program = await uploadCoachPhotoApi(programId, file)
      const url = program.coach_photo_url
      if (url) update({ coachPhotoUrl: url })
      return url
    } catch (e) {
      console.warn('[CoachingWizard] coach photo upload failed', e)
      return null
    }
  }

  const uploadThumbnail = async (file: File): Promise<string | null> => {
    if (!programId) {
      const localUrl = URL.createObjectURL(file)
      update({ pendingThumbnail: file, thumbnailUrl: localUrl })
      return localUrl
    }
    try {
      const program = await uploadThumbnailApi(programId, file)
      const url = program.thumbnail_url
      if (url) update({ thumbnailUrl: url })
      return url
    } catch (e) {
      console.warn('[CoachingWizard] thumbnail upload failed', e)
      return null
    }
  }

  const canContinue = (() => {
    if (transitioning) return false
    if (step === 1) return state.coachName.trim().length > 0
    if (step === 2)
      return state.programTitle.trim().length > 0 && !!state.format
    if (step === 3) return true
    if (step === 4) {
      if (state.pricingModel === 'plan') return false // Coming soon
      const num = parseFloat(state.price || '0')
      return state.pricingModel.length > 0 && num > 0
    }
    if (step === 5) return aiCanContinue
    return true
  })()

  const next = async () => {
    if (step === 2) {
      const id = await ensureDraft()
      if (!id) return
      setStep(3)
      return
    }
    if (step < 5) setStep(step + 1)
    else if (step === 5) setStep(6)
  }
  const back = () => {
    if (step > 1) setStep(step - 1)
  }

  const onSaveAndExit = () => {
    if (programId) {
      setShowExitDialog(true)
      return
    }
    router.push(`/dashboard/${organization.slug}/products`)
  }

  const confirmDiscard = async () => {
    if (programId) {
      await deleteCoachingProgram(programId).catch(() => {})
    }
    router.push(`/dashboard/${organization.slug}/products`)
  }

  // Persist AI result via finalize-ai when arriving at preview.
  const onAIFinalize = async (result: PartialOutline): Promise<boolean> => {
    if (!programId) return false
    try {
      const modules = (result.modules ?? [])
        .map((m) => {
          const title = m?.title
          if (typeof title !== 'string' || title.length === 0) return null
          const lessons = (m?.lessons ?? [])
            .filter(
              (l): l is { type: 'doc' | 'video'; title: string } =>
                !!l &&
                (l.type === 'doc' || l.type === 'video') &&
                typeof l.title === 'string',
            )
            .map((l) => ({ type: l.type as string, title: l.title }))
          return { title, lessons }
        })
        .filter((m): m is { title: string; lessons: { type: string; title: string }[] } => m !== null)

      await finalizeAI(programId, {
        modules,
        landing_data: result.landing ?? null,
        intake_questions: (result.intakeQuestions ?? []).filter(
          (q): q is string => typeof q === 'string',
        ),
        session_ideas: (result.sessionIdeas ?? []).filter(
          (s): s is string => typeof s === 'string',
        ),
      })
      return true
    } catch (e) {
      console.warn('[CoachingWizard] finalize-ai failed', e)
      return false
    }
  }

  const content = (() => {
    if (step === 1)
      return (
        <StepCoach
          state={state}
          update={update}
          onUploadPhoto={uploadCoachPhoto}
        />
      )
    if (step === 2) return <StepProgram state={state} update={update} />
    if (step === 3)
      return (
        <StepMedia
          state={state}
          update={update}
          onUploadThumbnail={uploadThumbnail}
        />
      )
    if (step === 4) return <StepPricing state={state} update={update} />
    if (step === 5)
      return (
        <StepAI
          state={state}
          update={update}
          organization={{ slug: organization.slug }}
          onComplete={() => setAiCanContinue(true)}
          onResult={setAiResult}
          programId={programId}
          onFinalize={onAIFinalize}
        />
      )
    if (step === 6 && programId)
      return (
        <Preview
          state={state}
          aiResult={aiResult}
          organization={organization}
          programId={programId}
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
          <div style={{ width: '100%', maxWidth: 540 }}>
            {draftError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#fff5f5',
                  border: '1.5px solid #fecaca',
                  color: '#dc2626',
                  fontSize: 13,
                }}
              >
                {draftError}
              </div>
            )}
            {content}
          </div>
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
              {transitioning
                ? 'Creating draft…'
                : step === 5
                  ? 'Continue to preview'
                  : 'Continue'}
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* Right panel */}
      <RightPanel currentStep={step} />

      {showExitDialog && (
        <ExitDialog
          onCancel={() => setShowExitDialog(false)}
          onConfirm={confirmDiscard}
        />
      )}
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

// ─── ExitDialog ─────────────────────────────────────────────────────────────
function ExitDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          width: 'min(420px, 90vw)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          Discard this draft?
        </h2>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 14,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          Your in-progress program will be deleted. You can always start again
          from the products list.
        </p>
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
        >
          <GhostButton onClick={onCancel}>Keep editing</GhostButton>
          <PrimaryButton onClick={onConfirm}>Discard draft</PrimaryButton>
        </div>
      </div>
    </div>
  )
}

// Re-export so that legacy CoachingWizardType reference stays valid where
// other modules expect a default-only export (no other re-export needed).
export type { PartialOutline }
