'use client'

import { useCreateProduct } from '@/hooks/queries/products'
import type { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import {
  GhostButton,
  PrimaryButton,
} from './CoachingWizard.primitives'
import type { PartialOutline } from './CoachingWizard.ai'
import type { WizardState } from './CoachingWizard'

// ─── Preview screen ─────────────────────────────────────────────────────────
export function Preview({
  state,
  aiResult,
  organization,
  onEdit,
}: {
  state: WizardState
  aiResult: PartialOutline | null
  organization: schemas['Organization']
  onEdit: () => void
}) {
  const router = useRouter()
  const createProduct = useCreateProduct(organization)
  const [showConfetti, setShowConfetti] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 2000)
    return () => clearTimeout(t)
  }, [])

  const formatLabels: Record<string, string> = {
    self: 'Self‑paced',
    cohort: 'Cohort',
    hybrid: 'Hybrid',
  }
  const formatLabel = formatLabels[state.format] || 'Self‑paced'

  const pricingSummary = (() => {
    const p = state.price || '49'
    if (state.pricingModel === 'subscription') {
      return `$${p} / ${state.interval === 'Yearly' ? 'year' : 'month'}`
    }
    if (state.pricingModel === 'plan') {
      return `${state.installments || '3'} × $${p}`
    }
    return `$${p} one‑time`
  })()

  // Module/lesson counts come from the AI result if present, otherwise show
  // the defaults from the prototype (4 modules / 11 lessons).
  const moduleCount = aiResult?.modules?.length ?? 4
  const lessonCount =
    aiResult?.modules?.reduce(
      (acc, m) => acc + (m?.lessons?.length ?? 0),
      0,
    ) ?? 11

  const openInEditor = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const priceAmountCents = Math.round(
        parseFloat(state.price || '0') * 100,
      )
      const isSub = state.pricingModel === 'subscription'
      const recurring_interval: 'month' | 'year' | null = isSub
        ? state.interval === 'Monthly'
          ? 'month'
          : 'year'
        : null

      // The product create payload. `product_type: 'coaching'` is sent so the
      // backend can route the product into the coaching flow. We use a typed
      // `as` cast on the body since `ProductCreate` is a discriminated union
      // (Recurring vs OneTime) and we want to flip between them at runtime.
      const body = {
        name: state.programTitle || 'Untitled Program',
        description: state.promise || null,
        organization_id: organization.id,
        product_type: 'coaching',
        recurring_interval,
        prices: [
          {
            amount_type: 'fixed' as const,
            price_amount: priceAmountCents,
            price_currency: 'usd',
          },
        ],
        medias: [],
        metadata: {},
      } as unknown as schemas['ProductCreate']

      const result = await createProduct.mutateAsync(body)
      if (result.error || !result.data) {
        throw new Error(
          `Product creation failed: ${JSON.stringify(result.error ?? {})}`,
        )
      }
      const productId = result.data.id

      // Persist the wizard state + AI draft to the coaching API.
      try {
        const wizardSubmit = {
          product_id: productId,
          format: state.format || 'self',
          cohort_start: state.startDate || null,
          cohort_end: state.endDate || null,
          weeks: state.weeks ? parseInt(state.weeks, 10) : null,
          promise: state.promise || '',
          coach_name: state.coachName || '',
          coach_bio: state.coachBio || null,
          coach_credentials: state.coachCreds || null,
          pricing_model: state.pricingModel || 'onetime',
          access_duration: state.access || 'lifetime',
          free_preview: state.freePreview || false,
          landing_data: aiResult?.landing
            ? { landing: aiResult.landing }
            : null,
          intake_questions: aiResult?.intakeQuestions ?? [],
          session_ideas: aiResult?.sessionIdeas ?? [],
          ai_generated: !!aiResult,
          modules:
            aiResult?.modules?.map((m) => ({
              title: m.title,
              lessons:
                m.lessons?.map((l) => ({
                  type: l.type,
                  title: l.title,
                })) ?? [],
            })) ?? [],
        }
        const persistRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/coaching/wizard`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(wizardSubmit),
          },
        )
        if (!persistRes.ok) {
          console.warn(
            '[CoachingWizard] /v1/coaching/wizard returned',
            persistRes.status,
            await persistRes.text().catch(() => ''),
          )
        }
      } catch (e) {
        console.warn('[CoachingWizard] coaching persistence failed:', e)
      }

      router.push(`/dashboard/${organization.slug}/products/${productId}`)
    } catch (e) {
      console.error('[CoachingWizard] open-in-editor failed:', e)
      setError(
        e instanceof Error ? e.message : 'Could not create the program.',
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 540 }}>
      {showConfetti && <Confetti />}

      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            letterSpacing: '0.02em',
            marginBottom: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--indigo)',
              color: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
            }}
          >
            ✓
          </span>
          <span>All set</span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 36,
            lineHeight: 1.08,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
          }}
        >
          Your program is ready.
        </h1>
      </div>

      {/* Summary card */}
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          background: '#fff',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            aspectRatio: '16/9',
            background: state.thumbnail
              ? 'linear-gradient(135deg, #2d2a5e 0%, #514c9a 100%)'
              : '#F5F5F7',
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 20,
          }}
        >
          {!state.thumbnail && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: 'var(--muted-2)',
              }}
            >
              No thumbnail
            </div>
          )}
          {state.thumbnail && (
            <svg
              viewBox="0 0 100 100"
              style={{
                position: 'absolute',
                bottom: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40%',
                opacity: 0.4,
              }}
            >
              <circle cx="50" cy="35" r="16" fill="#a8a3d8" />
              <path d="M 18 100 C 18 70, 82 70, 82 100 Z" fill="#a8a3d8" />
            </svg>
          )}
        </div>

        <div style={{ padding: '24px 26px' }}>
          {/* Coach row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: state.coachPhoto
                  ? 'linear-gradient(135deg, #c5c0e8, #8580bf)'
                  : '#E5E5EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {(state.coachName || 'A')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              {state.coachName || 'You'}
            </span>
          </div>

          <h2
            style={{
              margin: '0 0 8px',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              lineHeight: 1.15,
            }}
          >
            {state.programTitle || 'Untitled program'}
          </h2>

          <p
            style={{
              margin: '0 0 20px',
              fontSize: 15,
              color: 'var(--muted)',
              lineHeight: 1.5,
            }}
          >
            {state.promise ||
              'A short promise of what your buyers will walk away with.'}
          </p>

          {/* Pills */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 22,
            }}
          >
            <Pill>{formatLabel}</Pill>
            {(state.format === 'cohort' || state.format === 'hybrid') &&
              state.startDate && (
                <Pill>
                  {formatDate(state.startDate)} – {formatDate(state.endDate)}
                </Pill>
              )}
            <Pill>{state.weeks || '6'} weeks</Pill>
            <Pill primary>{pricingSummary}</Pill>
          </div>

          {/* Modules count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 0',
              borderTop: '1px solid var(--line-2)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--ink)',
                }}
              >
                {moduleCount} modules
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--muted)',
                  marginTop: 1,
                }}
              >
                {lessonCount} lessons in total
              </div>
            </div>
            <button
              type="button"
              onClick={onEdit}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--indigo)',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Review
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fff5f5',
            border: '1.5px solid #fecaca',
            color: '#dc2626',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <PrimaryButton onClick={openInEditor} disabled={submitting}>
          {submitting ? 'Creating…' : 'Open in editor'}
        </PrimaryButton>
        <GhostButton onClick={onEdit}>Edit landing page first</GhostButton>
      </div>
    </div>
  )
}

// ─── Pill ───────────────────────────────────────────────────────────────────
export function Pill({
  children,
  primary,
}: {
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 11px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 500,
        background: primary ? 'var(--ink)' : '#F2F2F4',
        color: primary ? '#fff' : 'var(--ink-2)',
        letterSpacing: '-0.005em',
      }}
    >
      {children}
    </span>
  )
}

// ─── formatDate ─────────────────────────────────────────────────────────────
export function formatDate(s: string) {
  if (!s) return ''
  try {
    const d = new Date(s)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}

// ─── Confetti ───────────────────────────────────────────────────────────────
export function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => i)
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {pieces.map((i) => {
        const left = 20 + Math.random() * 60
        const delay = Math.random() * 0.3
        const dur = 1.2 + Math.random() * 0.8
        const size = 4 + Math.random() * 6
        const colors = ['var(--indigo)', '#1A1A1A', '#E5E5EA']
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '20%',
              left: `${left}%`,
              width: size,
              height: size,
              background: colors[i % 3],
              borderRadius: i % 2 ? '50%' : '2px',
              animation: `coachingConfetti ${dur}s ease-out ${delay}s forwards`,
              opacity: 0,
            }}
          />
        )
      })}
    </div>
  )
}
