'use client'

import {
  useCreateNewsletter,
  useSetupNewsletterPaidAccess,
} from '@/hooks/queries/newsletters'
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
  const setupPaidAccess = useSetupNewsletterPaidAccess()

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

    // Two retry attempts on the create step. The slug derived from
    // the name is deterministic, so a collision (the user submitted
    // a newsletter named "Daily Brief" twice — happens on retries
    // after a previous wizard run failed mid-flight) returns a 409
    // from the server. The first retry appends a short nonce, the
    // second appends a timestamp to all but guarantee uniqueness.
    let newsletter: { id: string } | undefined
    const baseSlug = slugify(info.name)
    for (const attempt of [0, 1, 2]) {
      const slug =
        attempt === 0
          ? baseSlug
          : attempt === 1
            ? `${baseSlug}-${shortNonce()}`
            : `${baseSlug}-${Date.now().toString(36).slice(-6)}`
      try {
        newsletter = await createNewsletter.mutateAsync({
          organization_id: organization.id,
          name: info.name.trim(),
          slug,
          masthead: info.name.trim().toUpperCase(),
          description: info.desc.trim() || null,
        })
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        const isConflict = /409|already exists|slug/i.test(msg)
        if (!isConflict || attempt === 2) {
          setCreateError(
            msg ||
              "Couldn't create newsletter. Try a different name or check your connection.",
          )
          setStep('pricing')
          return
        }
        // 409 + attempt < 2 → loop with a fresh slug
      }
    }
    if (!newsletter) return

    // Paid tier setup is a SEPARATE try block so a failure here
    // doesn't roll back the newsletter we just created. The most
    // common failure mode is the org not having a connected payments
    // account yet (the 422 the user hit), which is recoverable: the
    // newsletter still exists, the user can connect payments and
    // re-run setup from the settings page later.
    if (pricing.mode !== 'free') {
      try {
        await setupPaidAccess.mutateAsync({
          newsletterId: newsletter.id,
          productName: info.name.trim(),
          amount: pricing.paidAmount,
          currency: pricing.currency,
          recurringInterval: pricing.paidInterval,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        // Send the user to the detail page with a hash that the
        // detail screen can read to render a "connect payments"
        // banner. The newsletter is already created; this is a
        // soft failure.
        router.push(
          `/dashboard/${organization.slug}/newsletters/${newsletter.id}#payments-pending`,
        )
        console.warn('Newsletter created; paid tier setup deferred:', msg)
        return
      }
    }

    router.push(
      `/dashboard/${organization.slug}/newsletters/${newsletter.id}`,
    )
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

// Short random suffix used to bust slug collisions on retry. 4 chars
// from the base36 alphabet is ~1.6M values, plenty when the wizard
// only retries twice.
function shortNonce(): string {
  return Math.random().toString(36).slice(2, 6)
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
