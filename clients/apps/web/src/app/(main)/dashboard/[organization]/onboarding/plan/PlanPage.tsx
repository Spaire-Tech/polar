'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { toast } from '@/components/Toast/use-toast'
import {
  BillingInterval,
  formatTransactionFee,
  headlinePriceForPlan,
  PaidTierKey,
  TierPlan,
  tierDisplayName,
  useSpairePlans,
} from '@/hooks/queries/spaireTier'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import { useCallback, useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Plan + checkout step of the new-signup flow.
 *
 * Final visible step of onboarding: it sits after OrganizationStep
 * ("name + slug + logo", at /dashboard/create).
 *
 * Visual port of the "Spaire Pricing" design: Spaire-tier plans are loaded
 * via useSpairePlans, the user picks a tier + billing interval, and clicking
 * a CTA hands off to upgrade-checkout which converts the trialing subscription
 * in place and redirects to Polar-hosted checkout. Success returns to
 * /onboarding/review, which invisibly verifies the checkout, marks onboarding
 * complete, and forwards the creator straight into the course wizard.
 */
export default function PlanPage() {
  const { organization } = useContext(OrganizationContext)
  const plans = useSpairePlans()
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [pending, setPending] = useState<PaidTierKey | null>(null)

  const ordered = useMemo<TierPlan[]>(() => {
    if (!plans.data?.items) return []
    const map = new Map(plans.data.items.map((p) => [p.tier, p]))
    return (['starter', 'studio', 'scale'] as const)
      .map((t) => map.get(t))
      .filter((p): p is TierPlan => Boolean(p))
  }, [plans.data])

  const startCheckout = useCallback(
    async (tier: PaidTierKey) => {
      if (pending) return
      setPending(tier)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platformApi = api as unknown as any
        const { data, error } = await platformApi.POST(
          '/v1/platform/organizations/{organization_id}/upgrade-checkout',
          {
            params: { path: { organization_id: organization.id } },
            body: {
              tier,
              billing_interval: interval,
              success_url: `${window.location.origin}/dashboard/${organization.slug}/onboarding/review?upgraded=1`,
            },
          },
        )
        if (error || !data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = error as any
          let message = "Couldn't start checkout for this plan."
          if (Array.isArray(e?.detail) && e.detail.length > 0) {
            const first = e.detail[0]
            message = `${first?.msg ?? 'Validation failed'} (loc=${(first?.loc ?? []).join('.')})`
          } else if (typeof e?.detail === 'string') {
            message = e.detail
          }
          // eslint-disable-next-line no-console
          console.error('upgrade-checkout failed', e)
          throw new Error(message)
        }
        const checkout = data as { checkout_url?: string }
        if (!checkout.checkout_url) {
          throw new Error('Checkout URL missing from server response.')
        }
        window.location.href = checkout.checkout_url
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong.'
        toast({ title: 'Checkout failed', description: message })
        setPending(null)
      }
    },
    [interval, organization.id, organization.slug, pending],
  )

  return (
    <div className="spaire-pricing">
      {/* Existing onboarding chrome — same OnboardingProgressBar the other
          steps use, so the bar fill keeps progressing across the flow. */}
      <div className="mx-auto mb-5 w-full max-w-lg px-4 pt-6">
        <OnboardingProgressBar currentStep={2} totalSteps={2} />
      </div>

      <div className="sp-stage" data-screen-label="Pricing">
        <header className="sp-header">
          <h1 className="sp-title">Choose your plan</h1>
          <p className="sp-lede">
            Every plan starts with a 14-day free trial. You won&apos;t be
            charged during the trial — switch or cancel anytime from Settings.
          </p>
        </header>

        <div className="sp-billing">
          <IntervalToggle interval={interval} onChange={setInterval} />
          <span className="sp-save-badge">Save 20%</span>
        </div>

        {plans.isLoading ? (
          <div className="sp-grid sp-grid--loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sp-skeleton" />
            ))}
          </div>
        ) : (
          <div className="sp-grid">
            {ordered.map((plan, idx) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                previousPlanName={idx === 0 ? null : ordered[idx - 1].name}
                interval={interval}
                pending={pending}
                onChoose={startCheckout}
              />
            ))}
          </div>
        )}

        <button type="button" className="sp-compare">
          <span>Compare all plans and features</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <SpaireOnboardingPricingStyles />
    </div>
  )
}

// ── Billing toggle ──────────────────────────────────────────────────────────

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval
  onChange: (interval: BillingInterval) => void
}) {
  const isAnnual = interval === 'year'
  return (
    <div
      className="sp-toggle"
      role="tablist"
      aria-label="Billing period"
    >
      {/* Sliding pill — CSS handles the position via the data attribute on
          the container, so we don't have to measure widths in JS. */}
      <span
        className="sp-toggle-pill"
        data-active={isAnnual ? 'annual' : 'monthly'}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={!isAnnual}
        onClick={() => onChange('month')}
        className={twMerge(
          'sp-toggle-btn',
          !isAnnual && 'sp-toggle-btn--active',
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isAnnual}
        onClick={() => onChange('year')}
        className={twMerge(
          'sp-toggle-btn',
          isAnnual && 'sp-toggle-btn--active',
        )}
      >
        Annual
      </button>
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: TierPlan
  previousPlanName: string | null
  interval: BillingInterval
  pending: PaidTierKey | null
  onChoose: (tier: PaidTierKey) => void
}

function PlanCard({
  plan,
  previousPlanName,
  interval,
  pending,
  onChoose,
}: PlanCardProps) {
  const tier = plan.tier as PaidTierKey
  const annualAvailable = plan.annual_price_cents != null
  const effectiveInterval: BillingInterval =
    interval === 'year' && !annualAvailable ? 'month' : interval
  const headline = headlinePriceForPlan(plan, effectiveInterval)
  const featureLines = featuresForTier(plan)
  const isPending = pending === tier
  const disabled = pending !== null && pending !== tier
  const isRecommended = tier === 'studio'

  return (
    <article
      className={twMerge('sp-card', isRecommended && 'sp-card--featured')}
      data-plan={tier}
    >
      <div className="sp-plan-row">
        <div className="sp-plan-name">{tierDisplayName(plan.tier)}</div>
        {isRecommended && <span className="sp-badge">Recommended</span>}
      </div>

      <div className="sp-price">
        <span className="sp-price-currency">$</span>
        <span className="sp-price-amount">{headline.dollars}</span>
      </div>
      <div className="sp-price-sub">
        {effectiveInterval === 'year'
          ? 'Per month, billed annually'
          : 'Per month, billed monthly'}
      </div>

      {previousPlanName && (
        <div className="sp-features-intro">
          Everything from Spaire {previousPlanName}, plus:
        </div>
      )}
      <ul className="sp-features">
        {featureLines.map((line, i) => (
          <li key={i}>
            <CheckIcon />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="sp-cta-wrap">
        <button
          type="button"
          onClick={() => onChoose(tier)}
          disabled={disabled || isPending}
          className={twMerge(
            'sp-cta',
            isRecommended && 'sp-cta--featured',
            (disabled || isPending) && 'sp-cta--disabled',
          )}
        >
          {isPending ? 'Loading…' : 'Start free trial'}
        </button>
        <p className="sp-fine">
          Card required. Won&apos;t be charged during the 14-day trial.
        </p>
      </div>
    </article>
  )
}

function CheckIcon() {
  return (
    <svg
      className="sp-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

// ── Tier copy ───────────────────────────────────────────────────────────────

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

const featuresForTier = (plan: TierPlan): string[] => {
  if (plan.tier === 'starter') {
    return [
      'Merchant of Record — Spaire handles tax & VAT',
      `${formatTransactionFee(plan.transaction_fee)} per transaction`,
      `${plan.limits.published_courses} published courses`,
      `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
      'Unlimited email sends',
      'Unlimited email sequences',
      `${plan.limits.video_hours_hosted} hours of hosted video`,
      'Sandbox / test environment',
    ]
  }
  if (plan.tier === 'studio') {
    return [
      `${formatTransactionFee(plan.transaction_fee)} per transaction (saves 2% vs Starter)`,
      `${plan.limits.published_courses} published courses`,
      `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
      'Custom email sender domain',
      'White-label course player',
      'Customer wallet',
      `${plan.limits.dashboard_team_seats} team seats`,
    ]
  }
  if (plan.tier === 'scale') {
    return [
      `${formatTransactionFee(plan.transaction_fee)} per transaction (saves 4% vs Starter)`,
      `${plan.limits.published_courses} published courses`,
      `${formatCount(plan.limits.email_subscribers ?? 0)} email subscribers`,
      'Unlimited email sequences',
      `${plan.limits.storage_gb} GB storage`,
      `${plan.limits.dashboard_team_seats} team seats`,
      'Audit logs · dedicated support',
    ]
  }
  return []
}

// ── Scoped styles ──────────────────────────────────────────────────────────

function SpaireOnboardingPricingStyles() {
  return (
    <style jsx global>{`
      .spaire-pricing {
        --sp-bg-0: oklch(0.985 0.003 280);
        --sp-bg-1: #ffffff;
        --sp-line: oklch(0.92 0.003 280);
        --sp-line-soft: oklch(0.945 0.003 280);
        --sp-fg-0: oklch(0.18 0.008 280);
        --sp-fg-1: oklch(0.32 0.008 280);
        --sp-fg-2: oklch(0.52 0.008 280);
        --sp-fg-3: oklch(0.66 0.006 280);
        --sp-accent: #3847cc;
        --sp-accent-hover: #2d3aab;
        --sp-accent-soft: oklch(0.95 0.04 270);
        color: var(--sp-fg-0);
        font-family: var(--font-poppins), 'Poppins', system-ui, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        letter-spacing: -0.005em;
        min-height: 100vh;
        background: #ffffff;
        /* The onboarding layout is "flex flex-row" — without these the
           plan page sizes to its content and pins to the left edge.
           flex: 1 + width 100% makes us claim the full row, and the
           internal align-items: center on .sp-stage takes over from there. */
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      .spaire-pricing *,
      .spaire-pricing *::before,
      .spaire-pricing *::after {
        box-sizing: border-box;
      }
      .spaire-pricing ::selection {
        background: rgb(56 71 204 / 0.12);
      }

      /* Stage */
      .sp-stage {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 32px 28px;
      }

      /* Header */
      .sp-header {
        text-align: center;
        max-width: 580px;
        margin-bottom: 18px;
      }
      .sp-title {
        font-size: clamp(24px, 3vw, 32px);
        font-weight: 600;
        letter-spacing: -0.03em;
        line-height: 1.08;
        margin: 0 0 8px;
        color: var(--sp-fg-0);
        text-wrap: balance;
      }
      .sp-lede {
        font-size: 13px;
        color: var(--sp-fg-2);
        text-wrap: pretty;
        line-height: 1.5;
        max-width: 500px;
        margin: 0 auto;
      }

      /* Billing toggle */
      .sp-billing {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 22px;
      }
      .sp-toggle {
        display: inline-flex;
        background: var(--sp-bg-1);
        border: 1px solid var(--sp-line);
        border-radius: 999px;
        padding: 3px;
        position: relative;
        box-shadow: 0 1px 2px oklch(0 0 0 / 0.04);
      }
      .sp-toggle-btn {
        position: relative;
        padding: 6px 18px;
        font-size: 12px;
        font-weight: 500;
        color: var(--sp-fg-2);
        border-radius: 999px;
        transition: color 200ms ease;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        z-index: 1;
      }
      .sp-toggle-btn--active {
        color: #fff;
      }
      .sp-toggle-pill {
        position: absolute;
        top: 3px;
        bottom: 3px;
        width: calc(50% - 3px);
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          oklch(0.28 0.008 280) 0%,
          oklch(0.14 0.008 280) 100%
        );
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.18),
          inset 0 -1px 0 rgba(0, 0, 0, 0.4),
          0 1px 2px rgba(0, 0, 0, 0.18);
        transition: transform 280ms cubic-bezier(0.34, 1.3, 0.64, 1);
        z-index: 0;
      }
      .sp-toggle-pill[data-active='monthly'] {
        left: 3px;
        transform: translateX(0);
      }
      .sp-toggle-pill[data-active='annual'] {
        left: 3px;
        transform: translateX(100%);
      }
      .sp-save-badge {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--sp-accent);
        letter-spacing: -0.005em;
      }

      /* Card grid */
      .sp-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        width: 100%;
        max-width: 940px;
        margin-bottom: 18px;
        align-items: stretch;
      }
      .sp-grid--loading .sp-skeleton {
        height: 380px;
        border-radius: 18px;
        background: oklch(0.97 0.002 280);
        animation: spSkeleton 1.4s ease-in-out infinite;
      }
      @keyframes spSkeleton {
        0%,
        100% {
          opacity: 0.7;
        }
        50% {
          opacity: 1;
        }
      }

      .sp-card {
        position: relative;
        background: var(--sp-bg-1);
        border-radius: 18px;
        border: 1px solid var(--sp-line);
        overflow: hidden;
        isolation: isolate;
        transition:
          transform 220ms cubic-bezier(0.34, 1.3, 0.64, 1),
          box-shadow 220ms ease,
          border-color 220ms ease;
        box-shadow:
          0 1px 2px oklch(0 0 0 / 0.04),
          0 6px 18px oklch(0 0 0 / 0.05);
        display: flex;
        flex-direction: column;
        padding: 20px 20px 18px;
      }
      .sp-card:hover {
        transform: translateY(-2px);
        box-shadow:
          0 2px 4px oklch(0 0 0 / 0.05),
          0 14px 32px oklch(0 0 0 / 0.09);
      }
      .sp-card--featured {
        border-color: var(--sp-accent);
        box-shadow:
          0 0 0 1px var(--sp-accent),
          0 2px 5px oklch(0 0 0 / 0.06),
          0 18px 38px rgb(56 71 204 / 0.13);
      }
      .sp-card--featured:hover {
        box-shadow:
          0 0 0 1px var(--sp-accent),
          0 2px 5px oklch(0 0 0 / 0.06),
          0 22px 44px rgb(56 71 204 / 0.18);
      }

      /* Card header */
      .sp-plan-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 14px;
        min-height: 22px;
      }
      .sp-plan-name {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--sp-fg-0);
      }
      .sp-badge {
        font-size: 8.5px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--sp-accent);
        background: var(--sp-accent-soft);
        padding: 4px 9px;
        border-radius: 999px;
      }

      /* Price */
      .sp-price {
        display: flex;
        align-items: baseline;
        gap: 2px;
        margin-bottom: 4px;
      }
      .sp-price-currency {
        font-size: 18px;
        font-weight: 500;
        color: var(--sp-fg-0);
        letter-spacing: -0.02em;
        align-self: flex-start;
        margin-top: 6px;
      }
      .sp-price-amount {
        font-size: 42px;
        font-weight: 600;
        letter-spacing: -0.04em;
        line-height: 1;
        color: var(--sp-fg-0);
        font-variant-numeric: tabular-nums;
      }
      .sp-price-sub {
        font-size: 12px;
        color: var(--sp-fg-2);
        margin-bottom: 16px;
      }

      /* Features */
      .sp-features-intro {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--sp-fg-0);
        letter-spacing: -0.005em;
        margin-bottom: 10px;
      }
      .sp-features {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin: 0 0 16px;
        padding: 0;
      }
      .sp-features li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 12px;
        color: var(--sp-fg-1);
        line-height: 1.45;
        text-wrap: pretty;
      }
      .sp-check {
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        margin-top: 2px;
        color: var(--sp-fg-2);
      }
      .sp-card--featured .sp-check {
        color: var(--sp-accent);
      }

      /* CTA */
      .sp-cta-wrap {
        margin-top: auto;
        padding-top: 6px;
      }
      .sp-cta {
        width: 100%;
        padding: 11px 18px;
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          oklch(0.28 0.008 280) 0%,
          oklch(0.14 0.008 280) 100%
        );
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.005em;
        border: none;
        cursor: pointer;
        font-family: inherit;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.18),
          inset 0 -1px 0 rgba(0, 0, 0, 0.4),
          0 1px 2px rgba(0, 0, 0, 0.15),
          0 5px 14px rgba(0, 0, 0, 0.16);
        transition:
          transform 150ms ease,
          box-shadow 150ms ease,
          opacity 150ms ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .sp-cta:hover {
        transform: translateY(-1px);
      }
      .sp-cta--featured {
        background: linear-gradient(180deg, #4756d8 0%, #2d3aab 100%);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.22),
          inset 0 -1px 0 rgba(0, 0, 0, 0.3),
          0 1px 2px rgba(0, 0, 0, 0.12),
          0 6px 18px rgb(56 71 204 / 0.32);
      }
      .sp-cta--disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
      }
      .sp-fine {
        font-size: 10.5px;
        color: var(--sp-fg-3);
        text-align: center;
        margin: 8px 0 0;
        line-height: 1.45;
        text-wrap: pretty;
      }

      /* Compare link */
      .sp-compare {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12.5px;
        color: var(--sp-fg-2);
        padding: 8px 14px;
        border-radius: 999px;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        transition:
          color 150ms ease,
          background 150ms ease;
      }
      .sp-compare:hover {
        color: var(--sp-fg-0);
        background: oklch(0.97 0.002 280);
      }
      .sp-compare svg {
        transition: transform 200ms ease;
      }
      .sp-compare:hover svg {
        transform: translateX(2px);
      }

      @media (max-width: 980px) {
        .sp-grid {
          grid-template-columns: 1fr;
          max-width: 420px;
        }
        .sp-stage {
          padding: 8px 20px 32px;
        }
      }
    `}</style>
  )
}
