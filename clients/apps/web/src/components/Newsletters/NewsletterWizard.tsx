'use client'

import { useCreateNewsletter } from '@/hooks/queries/newsletters'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Intro,
  SpaireOnboardingStyles,
  StepInfo,
  StepPricing,
  type PricingState,
  type NewsletterInfoState,
} from './NewsletterWizard.steps'

// Wizard for creating a newsletter. Mirrors the structure of
// CourseWizard so the two flows feel identical when an org touches
// both. Three editable steps (info → pricing → creating) plus the
// shared intro letter-stagger.
//
// We deliberately skip a separate cover-image step in V1 — the cover
// is per-post anyway, and the newsletter-level brand cover is one
// field on the settings page. Keeps the create flow to two real
// inputs and one decision (free vs paid), which matches the Substack
// pace.

type WizardStep = 'intro' | 'info' | 'pricing' | 'creating'

export default function NewsletterWizard({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const createNewsletter = useCreateNewsletter()

  const [step, setStep] = useState<WizardStep>('intro')
  const [info, setInfo] = useState<NewsletterInfoState>({
    name: '',
    desc: '',
  })
  const [pricing, setPricing] = useState<PricingState>({
    mode: 'both',
    paidAmount: 500, // cents — $5/mo default per the plan
    paidInterval: 'month',
    currency: organization.default_presentment_currency ?? 'usd',
  })
  const [createError, setCreateError] = useState<string | null>(null)

  const finalize = async () => {
    setCreateError(null)
    setStep('creating')
    try {
      const slug = slugify(info.name)
      // V1 scope (see commit message): we create the Newsletter row
      // and capture the pricing choice into the wizard state, but we
      // do NOT yet spin up the linked Product + newsletter_access
      // benefit. That wiring needs the generated API client to know
      // about newsletter_access (BenefitType enum was added in Phase
      // 0 but the OpenAPI regen is pending) and is the next ticket
      // after this one. The Newsletter.product_id field stays null
      // for now; the settings page surfaces a "Connect payments"
      // banner when pricing.mode is not 'free'.
      const newsletter = await createNewsletter.mutateAsync({
        organization_id: organization.id,
        name: info.name.trim(),
        slug,
        masthead: info.name.trim().toUpperCase(),
        description: info.desc.trim() || null,
      })
      router.push(
        `/dashboard/${organization.slug}/newsletters/${newsletter.id}`,
      )
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : 'Failed to create newsletter',
      )
      setStep('pricing')
    }
  }

  const exit = () =>
    router.push(`/dashboard/${organization.slug}/newsletters`)

  return (
    <div className="spaire-onboarding">
      <SpaireOnboardingStyles />
      {step === 'intro' && (
        <Intro onNext={() => setStep('info')} onClose={exit} />
      )}
      {step === 'info' && (
        <StepInfo
          data={info}
          onChange={setInfo}
          onNext={() => setStep('pricing')}
          onBack={() => setStep('intro')}
          onClose={exit}
        />
      )}
      {step === 'pricing' && (
        <StepPricing
          pricing={pricing}
          onChange={setPricing}
          onNext={finalize}
          onBack={() => setStep('info')}
          onClose={exit}
          error={createError}
        />
      )}
      {step === 'creating' && <CreatingScreen />}
    </div>
  )
}

function CreatingScreen() {
  return (
    <div className="so-stage">
      <div className="so-screen" style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 28,
            height: 28,
            margin: '0 auto 18px',
            border: '2px solid #e8e8e8',
            borderTopColor: '#0a0a0a',
            borderRadius: '50%',
            animation: 'soSpin 0.7s linear infinite',
          }}
        />
        <div style={{ fontSize: 14, color: '#6a6a6a' }}>
          Setting up your newsletter…
        </div>
        <style>{`
          @keyframes soSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

// Lowercase + collapse non-alphanumerics into dashes. Lives here
// rather than in a util so the wizard is self-contained.
function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}
