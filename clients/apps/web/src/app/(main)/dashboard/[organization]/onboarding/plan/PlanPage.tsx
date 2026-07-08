'use client'

import { toast } from '@/components/Toast/use-toast'
import { BillingInterval, PaidTierKey } from '@/hooks/queries/spaireTier'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import { ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Plan + checkout step of the new-signup flow.
 *
 * Final visible step of onboarding: it sits after OrganizationStep
 * ("Profile basics", at /dashboard/create).
 *
 * Visual port of the "Choose your plan" design — a full-screen dark
 * liquid-glass pricing stage with Studio as the bright recommended card.
 * The creator picks a tier + billing interval, and clicking a card's CTA
 * hands off to upgrade-checkout which converts the trialing subscription in
 * place and redirects to the Polar-hosted checkout. Success returns to
 * /onboarding/review, which invisibly verifies the checkout, marks
 * onboarding complete, and forwards the creator into the course wizard.
 */

// ── Tier copy ────────────────────────────────────────────────────────────────
//
// Every plan is the whole platform — features are never gated. The cards
// only list USAGE (fee rate, courses, contacts, video/storage, seats,
// support); the shared feature set lives in SHARED_FEATURES below the grid.

interface DesignFeature {
  label: ReactNode
  shield?: boolean
}

interface DesignTier {
  tier: PaidTierKey
  name: string
  monthly: number
  annual: number
  recommended: boolean
  includes: ReactNode
  features: DesignFeature[]
}

const TIERS: DesignTier[] = [
  {
    tier: 'starter',
    name: 'Starter',
    monthly: 49,
    annual: 39,
    recommended: false,
    includes: (
      <>
        The whole platform, <span className="from">sized for starting out</span>
      </>
    ),
    features: [
      {
        label: (
          <>
            <b>7% + $0.30</b> per transaction
          </>
        ),
      },
      { label: <>5 published courses</> },
      { label: <>10K email subscribers</> },
      { label: <>25 video hours · 5 GB storage</> },
      { label: <>1 team seat</> },
      { label: <>Email support, 1 business day</> },
    ],
  },
  {
    tier: 'studio',
    name: 'Studio',
    monthly: 129,
    annual: 103,
    recommended: true,
    includes: (
      <>
        The whole platform, <span className="from">sized for growth</span>
      </>
    ),
    features: [
      {
        label: (
          <>
            <b>5% + $0.30</b> per transaction{' '}
            <span className="sub">(saves 2%)</span>
          </>
        ),
      },
      { label: <>25 published courses</> },
      { label: <>50K email subscribers</> },
      { label: <>50 video hours · 50 GB storage</> },
      { label: <>5 team seats</> },
      { label: <>Priority support, same day</> },
    ],
  },
  {
    tier: 'scale',
    name: 'Scale',
    monthly: 299,
    annual: 239,
    recommended: false,
    includes: (
      <>
        The whole platform, <span className="from">sized for volume</span>
      </>
    ),
    features: [
      {
        label: (
          <>
            <b>3% + $0.30</b> per transaction{' '}
            <span className="sub">(saves 4%)</span>
          </>
        ),
      },
      { label: <>100 published courses</> },
      { label: <>150K email subscribers</> },
      { label: <>200 video hours · 250 GB storage</> },
      { label: <>20 team seats</> },
      { label: <>Slack + dedicated AM · 4-hr SLA</> },
      { label: <>Custom pricing above $50k/mo GMV</> },
    ],
  },
]

// Everything below ships on every plan — this is the platform, not a tier.
const SHARED_FEATURES: DesignFeature[] = [
  {
    label: <>Merchant of Record — Spaire handles tax &amp; VAT</>,
    shield: true,
  },
  { label: <>AI teaching assistant on every course</> },
  { label: <>Email sequences, segments, drip &amp; A/B testing</> },
  { label: <>Unlimited email sends &amp; unlimited products</> },
  { label: <>Custom email sender domain</> },
  { label: <>White-label course player</> },
  { label: <>Customer wallet &amp; seat-based B2B pricing</> },
  { label: <>Custom storefront domain</> },
  { label: <>Revenue, MRR &amp; churn analytics</> },
  { label: <>Full REST API, webhooks &amp; audit logs</> },
]

const BILLING_STORAGE_KEY = 'spaire_billing_cycle'

export default function PlanPage() {
  const { organization } = useContext(OrganizationContext)
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [pending, setPending] = useState<PaidTierKey | null>(null)

  // Restore the creator's last-picked billing cycle (matches the design's
  // localStorage persistence). Read after mount to avoid hydration mismatch.
  useEffect(() => {
    const saved = window.localStorage.getItem(BILLING_STORAGE_KEY)
    if (saved === 'annual') setInterval('year')
    else if (saved === 'monthly') setInterval('month')
  }, [])

  const selectInterval = useCallback((next: BillingInterval) => {
    setInterval(next)
    window.localStorage.setItem(
      BILLING_STORAGE_KEY,
      next === 'year' ? 'annual' : 'monthly',
    )
  }, [])

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

  const isAnnual = interval === 'year'

  return (
    <div className="spaire-plan-picker">
      <div className="stage">
        <div className="head">
          <h1>Choose your plan</h1>
          <p>
            Every plan is the whole platform — you pay for how much of it you
            use. Each starts with a 14-day free trial; switch or cancel
            anytime from Settings.
          </p>
        </div>

        <div className="toggle-wrap">
        <div className="seg" role="tablist" aria-label="Billing period">
          <button
            type="button"
            role="tab"
            aria-selected={!isAnnual}
            className={isAnnual ? '' : 'on'}
            onClick={() => selectInterval('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isAnnual}
            className={isAnnual ? 'on' : ''}
            onClick={() => selectInterval('year')}
          >
            Annual
          </button>
        </div>
        <span className="save-note" style={{ opacity: isAnnual ? 0 : 1 }}>
          Save <b>20%</b> with annual billing
        </span>
      </div>

      <div className="cards">
        {TIERS.map((t) => {
          const amount = isAnnual ? t.annual : t.monthly
          const isPending = pending === t.tier
          const disabled = pending !== null && pending !== t.tier
          return (
            <div
              key={t.tier}
              className={twMerge('card', t.recommended && 'rec')}
              data-tier={t.name}
            >
              {t.recommended ? (
                <div className="rec-label">Recommended</div>
              ) : (
                <div className="tier-spacer" />
              )}
              <div className="tier">{t.name}</div>

              <div className="price">
                <span className="cur">$</span>
                <span className="amt">{amount}</span>
                <span className="per">/mo</span>
              </div>
              <div className="bill">
                {isAnnual ? (
                  <>
                    <span className="was">${t.monthly}</span>Billed annually
                  </>
                ) : (
                  'Billed monthly'
                )}
              </div>

              <button
                type="button"
                className="cta"
                disabled={disabled || isPending}
                onClick={() => startCheckout(t.tier)}
              >
                {isPending ? 'Starting…' : 'Start free trial'}
              </button>
              <div className="cta-note">
                Card required. Won&rsquo;t be charged during the 14-day trial.
              </div>

              <div className="divider" />
              <div className="incl">{t.includes}</div>
              <div className="feats">
                {t.features.map((feature, i) => (
                  <div className="feat" key={i}>
                    {feature.shield ? <ShieldIcon /> : <CheckIcon />}
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        </div>

        <div className="allplans">
          <div className="allplans-head">
            <h2>Every plan includes the whole platform</h2>
            <p>
              No feature gates, ever. Upgrading only buys a lower transaction
              rate and more usage.
            </p>
          </div>
          <div className="allplans-grid">
            {SHARED_FEATURES.map((feature, i) => (
              <div className="feat" key={i}>
                {feature.shield ? <ShieldIcon /> : <CheckIcon />}
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SpairePlanPickerStyles />
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 4 5v6c0 5 3.4 8 8 11 4.6-3 8-6 8-11V5l-8-3Z" />
    </svg>
  )
}

// ── Scoped styles (ported from the design, scoped under .spaire-plan-picker
//    so the dark/full-screen rules don't leak onto the rest of the app) ──────

function SpairePlanPickerStyles() {
  return (
    <style jsx global>{`
      .spaire-plan-picker {
        --ink: #1d1d1f;
        --gray: #86868b;
        --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
          'SF Pro Text', system-ui, sans-serif;
        --po: var(--font-poppins), 'Poppins', -apple-system,
          BlinkMacSystemFont, system-ui, sans-serif;
        font-family: var(--sf);
        color: #fff;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        letter-spacing: -0.01em;
        /* The onboarding layout is "flex flex-row" and the dashboard shell is
           "md:h-screen" — so we claim the full row (flex:1) and become our own
           vertical scroll container. Centering lives on .stage via margin:auto
           so tall content (small viewports) top-aligns and scrolls instead of
           being clipped, while short content stays centered. */
        flex: 1;
        width: 100%;
        min-height: 100vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        background: #000;
      }
      .spaire-plan-picker .stage {
        margin: auto;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 72px 32px;
      }
      .spaire-plan-picker *,
      .spaire-plan-picker *::before,
      .spaire-plan-picker *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .spaire-plan-picker button {
        font-family: inherit;
        cursor: pointer;
        border: none;
        background: none;
        color: inherit;
      }

      /* ---------- header ---------- */
      .spaire-plan-picker .head {
        text-align: center;
        margin-bottom: 26px;
      }
      .spaire-plan-picker .head h1 {
        font-family: var(--po);
        font-size: clamp(32px, 3.4vw, 46px);
        font-weight: 600;
        letter-spacing: -0.03em;
        line-height: 1.05;
        text-shadow: 0 1px 30px rgba(0, 0, 0, 0.3);
      }
      .spaire-plan-picker .head p {
        font-size: 17px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.82);
        font-weight: 400;
        margin-top: 14px;
        max-width: 540px;
        margin-left: auto;
        margin-right: auto;
        text-shadow: 0 1px 16px rgba(0, 0, 0, 0.3);
      }

      /* ---------- billing toggle (centered) ---------- */
      .spaire-plan-picker .toggle-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 11px;
        margin-bottom: 40px;
      }
      .spaire-plan-picker .seg {
        display: inline-flex;
        gap: 3px;
        padding: 4px;
        border-radius: 980px;
        background: rgba(0, 0, 0, 0.32);
        -webkit-backdrop-filter: blur(24px) saturate(160%);
        backdrop-filter: blur(24px) saturate(160%);
        box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.16);
      }
      .spaire-plan-picker .seg button {
        height: 38px;
        padding: 0 26px;
        border-radius: 980px;
        font-size: 15px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: rgba(255, 255, 255, 0.72);
        transition: color 0.2s, background 0.2s, box-shadow 0.2s;
      }
      .spaire-plan-picker .seg button.on {
        color: var(--ink);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
      }
      .spaire-plan-picker .save-note {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.72);
        text-shadow: 0 1px 12px rgba(0, 0, 0, 0.3);
        transition: opacity 0.25s;
      }
      .spaire-plan-picker .save-note b {
        color: #fff;
        font-weight: 600;
      }

      /* ---------- cards ---------- */
      .spaire-plan-picker .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        width: 100%;
        max-width: 1060px;
        align-items: stretch;
      }

      /* base = dark liquid glass */
      .spaire-plan-picker .card {
        position: relative;
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        padding: 32px 28px 30px;
        background: rgba(16, 18, 22, 0.34);
        -webkit-backdrop-filter: blur(44px) saturate(170%);
        backdrop-filter: blur(44px) saturate(170%);
        box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.14),
          0 24px 50px -28px rgba(0, 0, 0, 0.5);
        color: #fff;
        transition: transform 0.3s cubic-bezier(0.2, 1, 0.3, 1);
      }
      .spaire-plan-picker .card:hover {
        transform: translateY(-4px);
      }

      /* recommended = bright frosted-white focal card */
      .spaire-plan-picker .card.rec {
        background: rgba(255, 255, 255, 0.92);
        -webkit-backdrop-filter: blur(44px) saturate(180%);
        backdrop-filter: blur(44px) saturate(180%);
        box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.6),
          0 34px 70px -26px rgba(0, 0, 0, 0.55);
        color: var(--ink);
        transform: translateY(-12px);
      }
      .spaire-plan-picker .card.rec:hover {
        transform: translateY(-16px);
      }

      .spaire-plan-picker .rec-label {
        display: inline-flex;
        align-items: center;
        align-self: flex-start;
        height: 24px;
        padding: 0 11px;
        border-radius: 980px;
        margin-bottom: 12px;
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink);
        background: rgba(0, 0, 0, 0.08);
      }
      .spaire-plan-picker .tier-spacer {
        height: 36px;
      }
      .spaire-plan-picker .tier {
        font-family: var(--po);
        font-size: 21px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      /* price */
      .spaire-plan-picker .price {
        display: flex;
        align-items: flex-start;
        gap: 2px;
        margin-top: 16px;
      }
      .spaire-plan-picker .price .cur {
        font-size: 20px;
        font-weight: 500;
        margin-top: 5px;
      }
      .spaire-plan-picker .price .amt {
        font-size: 46px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .spaire-plan-picker .price .per {
        font-size: 14px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.6);
        align-self: flex-end;
        margin-left: 4px;
        margin-bottom: 6px;
      }
      .spaire-plan-picker .card.rec .price .per {
        color: var(--gray);
      }
      .spaire-plan-picker .bill {
        font-size: 13px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.62);
        margin-top: 8px;
        min-height: 18px;
      }
      .spaire-plan-picker .card.rec .bill {
        color: var(--gray);
      }
      .spaire-plan-picker .bill .was {
        text-decoration: line-through;
        opacity: 0.65;
        margin-right: 5px;
      }

      /* CTA */
      .spaire-plan-picker .cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 46px;
        border-radius: 980px;
        margin-top: 22px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
        transition: transform 0.16s, background 0.16s, opacity 0.16s;
      }
      .spaire-plan-picker .cta:hover {
        background: rgba(255, 255, 255, 0.26);
        transform: scale(1.015);
      }
      .spaire-plan-picker .cta:active {
        transform: scale(0.98);
      }
      .spaire-plan-picker .card.rec .cta {
        background: var(--ink);
        color: #fff;
        box-shadow: none;
      }
      .spaire-plan-picker .card.rec .cta:hover {
        background: #000;
      }
      .spaire-plan-picker .cta:disabled {
        cursor: not-allowed;
        opacity: 0.55;
        transform: none;
      }

      .spaire-plan-picker .cta-note {
        font-size: 11.5px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
        margin-top: 11px;
      }
      .spaire-plan-picker .card.rec .cta-note {
        color: var(--gray);
      }

      /* feature list */
      .spaire-plan-picker .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.16);
        margin: 24px 0 18px;
      }
      .spaire-plan-picker .card.rec .divider {
        background: rgba(0, 0, 0, 0.1);
      }
      .spaire-plan-picker .incl {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 16px;
        color: rgba(255, 255, 255, 0.92);
      }
      .spaire-plan-picker .card.rec .incl {
        color: var(--ink);
      }
      .spaire-plan-picker .incl .from {
        font-weight: 400;
        color: rgba(255, 255, 255, 0.6);
      }
      .spaire-plan-picker .card.rec .incl .from {
        color: var(--gray);
      }
      .spaire-plan-picker .feats {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .spaire-plan-picker .feat {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 14px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.92);
      }
      .spaire-plan-picker .card.rec .feat {
        color: var(--ink);
      }
      .spaire-plan-picker .feat svg {
        flex-shrink: 0;
        margin-top: 2px;
        color: #fff;
        opacity: 0.92;
      }
      .spaire-plan-picker .card.rec .feat svg {
        color: var(--ink);
        opacity: 1;
      }
      .spaire-plan-picker .feat b {
        font-weight: 600;
      }
      .spaire-plan-picker .feat .sub {
        color: rgba(255, 255, 255, 0.55);
      }
      .spaire-plan-picker .card.rec .feat .sub {
        color: var(--gray);
      }

      /* ---------- shared "whole platform" panel ---------- */
      .spaire-plan-picker .allplans {
        width: 100%;
        max-width: 1060px;
        margin-top: 22px;
        border-radius: 24px;
        padding: 30px 32px 32px;
        background: rgba(16, 18, 22, 0.34);
        -webkit-backdrop-filter: blur(44px) saturate(170%);
        backdrop-filter: blur(44px) saturate(170%);
        box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.14),
          0 24px 50px -28px rgba(0, 0, 0, 0.5);
      }
      .spaire-plan-picker .allplans-head h2 {
        font-family: var(--po);
        font-size: 19px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .spaire-plan-picker .allplans-head p {
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.62);
        margin-top: 6px;
      }
      .spaire-plan-picker .allplans-grid {
        margin-top: 22px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 32px;
      }

      @media (max-width: 860px) {
        .spaire-plan-picker .stage {
          padding: 56px 22px;
        }
        .spaire-plan-picker .cards {
          grid-template-columns: 1fr;
          max-width: 420px;
          gap: 16px;
        }
        .spaire-plan-picker .card.rec {
          transform: none;
        }
        .spaire-plan-picker .card.rec:hover {
          transform: translateY(-4px);
        }
        .spaire-plan-picker .allplans {
          max-width: 420px;
          padding: 26px 24px 28px;
        }
        .spaire-plan-picker .allplans-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  )
}
