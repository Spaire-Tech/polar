# Spaire Pricing

Three paid tiers — **Pro**, **Studio**, **Scale** — calibrated against what the platform actually ships today and benchmarked against Kajabi, Podia, Thinkific, Lemon Squeezy, Paddle, and Gumroad. Every paid tier ships with a **14-day free trial** so creators can build inside Spaire before being charged.

Spaire's positioning vs. those competitors:

- **Merchant of Record** built in (Kajabi/Podia/Thinkific don't do this — tax/VAT stays on the creator).
- **Developer-first** APIs, SDKs, webhooks, license keys, usage-based billing (course platforms lack these).
- **Course builder + email marketing** in the same product (Lemon Squeezy/Paddle/Gumroad don't have these).

The tiering story: "Stripe-grade infra + Kajabi-grade creator tools + MoR tax handling — pick your scale."

---

## Universal — applies to Pro, Studio, and Scale

The following are part of the product on every tier. Gating any of these would break delivery for paying customers.

| Item | Policy |
|---|---|
| Free trial on every paid tier | 14 days, no card required up front |
| Merchant of Record (tax/VAT handled) | ✓ |
| Customer portal (login, manage subs, access purchases) | ✓ |
| Course player + lesson access for buyers | ✓ |
| Digital download delivery | ✓ |
| License key issuance & validation | ✓ |
| Discord / GitHub benefit granting | ✓ |
| Customer invoices & receipts | ✓ |
| Full REST API + all webhook events | ✓ |
| Email broadcasts | ✓ |
| Discount codes (creator-shared) | ✓ |
| CSV exports of analytics & customer data | ✓ |
| "Powered by Spaire" badge on storefront & checkout | shown on Pro; removable on Studio & Scale |
| Payout settlement | 7-day delay from transaction date |
| Settlement grandfathering | orgs created before May 12, 2026 keep instant payouts |
| Stripe chargeback fee | $15 passthrough to creator |
| International card / FX | Stripe surcharge passthrough |
| Minimum payout threshold | $25 |
| Refund policy | Spaire's % fee retained on refund |

---

## Tier differentiators

| Lever | Pro | Studio | Scale |
|---|---|---|---|
| **Best for** | Solo creators starting out | Small teams scaling up | Established businesses |
| **Free trial** | 14 days | 14 days | 14 days |
| **Monthly** | $49 | $129 | $299 |
| **Transaction fee** | 4% + $0.40 | 3.8% + $0.35 | 3.5% + $0.30 |
| **Custom pricing at scale** | — | — | available above $50k/mo GMV |
| Products (one-time, sub, downloads, license keys, usage-based) | unlimited | unlimited | unlimited |
| Published courses | unlimited | unlimited | unlimited |
| Lessons per course | unlimited | unlimited | unlimited |
| Drip scheduling | ✓ | ✓ | ✓ |
| Course video hours hosted ‡ | 50 | 200 | unlimited |
| Course video views / month ‡ | 50,000 | 250,000 | unlimited |
| Downloadables storage ‡ | 25 GB | 100 GB | unlimited |
| Email subscribers | 25,000 | 100,000 | unlimited |
| Email sends / month ‡ | 250,000 | 1,000,000 | 2,000,000 |
| Email sequences & segments | ✓ | ✓ | ✓ |
| Email A/B testing | ✓ | ✓ | ✓ |
| Stackable / cart-rule discounts ★ | roadmap | roadmap | roadmap |
| Checkout links | ✓ | ✓ | ✓ |
| Embedded checkout on your site | ✓ | ✓ | ✓ |
| Custom email sender domain ★ | ✓ | ✓ | ✓ |
| White-label course player ★ | — | ✓ | ✓ |
| Seat-based product pricing (B2B sales) | ✓ | ✓ | ✓ |
| Customer wallet (prepaid balance, auto-top-up) | — | ✓ | ✓ |
| Analytics — revenue, MRR, churn rate | ✓ | ✓ | ✓ |
| Analytics — cohort retention curves ★ | roadmap | roadmap | roadmap |
| CSV exports of analytics & customer data | ✓ | ✓ | ✓ |
| Dashboard team seats | 5 | 15 | unlimited |
| API rate limits | higher | higher | highest + custom |
| Sandbox / test mode ★ | — | — | roadmap |
| Custom storefront domain ★ | — | — | roadmap |
| Custom checkout domain ★ | — | — | roadmap |
| SSO + audit logs ★ | — | — | roadmap |
| Support | email, 1 business day | priority email, same day | Slack + dedicated AM, 4-hour SLA |

‡ = quota enforcement enforced via metered events.
★ = feature itself must be built or completed before this row is shippable.

---

## Glossary

**GMV (Gross Merchandise Value):** total $ value sold through Spaire by a creator in a month — not what Spaire collects in fees. Used to determine eligibility for custom Scale pricing.

**MoR (Merchant of Record):** Spaire is the legal seller, handling sales tax / VAT collection and remittance globally. The creator does not need to register for tax in foreign jurisdictions.

**Customer wallet:** a prepaid balance a creator's customer can top up. Drawn down as they consume usage-priced products. Reduces failed-payment churn on metered billing.

**Drip scheduling:** automatic timed release of course lessons over days/weeks after enrollment, rather than all-at-once access.

**White-label course player:** option to hide Spaire branding from the course video player.

**Custom email sender domain:** outbound emails sent from `you@yourdomain.com` (with DKIM/SPF) instead of Spaire's default `notifications.spairehq.com`.

**SSO:** Single Sign-On for the merchant dashboard via the customer's identity provider (Okta, Google Workspace, Microsoft Entra).

**Audit logs:** "who did what, when" log of admin actions inside an org.

**Sandbox / test mode:** a non-production environment for testing integrations without real payments or transaction fees.

**Legacy:** internal-only fallback tier for organizations created before tiered pricing existed, plus the $0 destination an org lands on after canceling. Not a public plan; not selectable from the upgrade modal.

---

## Pricing math sanity check

Spaire's true per-transaction cost as MoR on Stripe is roughly:

| Cost | Rate |
|---|---|
| Stripe card processing (US card) | 2.9% + $0.30 |
| Stripe card processing (international card) | +1.5% |
| Currency conversion | +1% |
| Stripe Tax | +0.5% |
| Chargeback fee (per dispute) | $15 |
| Tax remittance & compliance overhead | ongoing fixed cost |

**Floor cost is ~3.5% + $0.30**, often closer to 4.5% + $0.30 once international and FX are mixed in.

This is why:

- **Pro at $49/mo + 4% + $0.40** is the entry point — the monthly fee covers compliance overhead while the per-transaction rate keeps margin on US card volume.
- **Studio at $129/mo + 3.8% + $0.35** trades a higher fixed fee for a lower variable rate. It pays off for creators above ~$15k/mo GMV.
- **Scale at $299/mo + 3.5% + $0.30** is at-cost on the variable side; the monthly fee is the margin. Below 3.5% requires negotiated volume commitments.

Custom pricing for the Scale tier kicks in above $50k/month GMV. The negotiated floor is around 3.0% — Stripe's processing cost — and is the same floor competitors like Paddle hold to at scale.

---

## Trial & onboarding flow

1. Creator signs up → backend auto-starts a **14-day Pro trial** subscription on the platform org. No card required at signup.
2. During the trial the creator has Pro entitlements (limits + features) and can build courses, send emails, etc.
3. At any point the creator can switch the target tier (Pro / Studio / Scale) via the upgrade modal in `Settings → Billing`. The upgrade-checkout endpoint converts the trialing subscription in-place — they enter a payment method, the trial keeps running for the remaining days, then bills at the picked tier.
4. If the trial expires without conversion, the subscription lapses and the org is moved to **Legacy** (no charge, no enforcement) so creators don't hard-lose access mid-month while ops follows up.

---

## Audit findings — what's built today vs. needs work

### Built and shippable today

- Customer portal, course player, downloads, license keys
- Subscriptions, one-time products, usage-based / metered billing
- Discord & GitHub benefit granting
- Embedded checkout, checkout links
- Discount codes
- Email broadcasts with A/B testing (`EmailBroadcastABTest` model)
- Email sequences and segments
- Drip scheduling on course lessons (`drip_days`, `release_at` on `CourseLesson`)
- Customer wallet with Stripe off-session top-ups and tax calculation
- Seat-based product pricing (`customer_seat/`)
- CSV exports (pattern established in email analytics endpoint)
- Per-org rate limiting (`rate_limit_group` on Organization model)
- Webhooks, full REST API, OAuth2 for end-customers
- Team members with roles (`member/` module)
- Basic revenue / MRR / churn-rate analytics
- 14-day trial machinery on Product (`trial_interval`, `trial_interval_count`)
- Quota enforcement: video hours hosted, video views/month, storage bytes, email sends/month

### Built infrastructure, needs surfacing or completion

- Custom email sender domain — Resend integration with verification hourly cron, needs the rest of the dashboard UX polished.
- White-label course player — YouTube embeds use `modestbranding=1`, main lesson player has no toggle.
- Cohort analysis — only aggregate churn rate today, no retention curves.
- Refund/chargeback fee policy — fee types tracked (`ProcessorFeeType.dispute`, `ProcessorFeeType.refund`), no policy config for absorption.

### Not built — Scale-tier roadmap

- Custom storefront domain (was previously removed in `2024-06-21-1348_remove_organization_custom_domain.py`; needs to be rebuilt).
- Custom checkout domain (no DNS verification, SSL provisioning, or domain routing).
- SSO / SAML for the merchant dashboard.
- Audit logs (model + endpoints exist; UI surface still pending).
- Sandbox / test mode (no per-org Stripe test/live toggle today).

### Trial conversion follow-ups

- Cron task to expire / lapse Pro trials that didn't capture a payment method by day 14 — currently Pro-trial subscriptions run indefinitely once `trial_end` passes; they need to be flipped to `past_due` or canceled, then auto-resubscribed to Legacy via the existing `platform.resubscribe_to_legacy` actor.
- Creator-facing reminder emails at trial day 7, day 12, and day 14.
- "Trial extension" override for support to give a creator more time.

### Deliberately removed from the table

- **Affiliate program** — no signup portal, dashboard, or payouts for third-party affiliates. The `campaign/` module is alpha and appears to be for Spaire's own platform-fee promo codes, not creator-facing referrals.
- **Account credits as a tier feature** — `account_credit/` is an internal lever Spaire uses to issue promo credits against platform fees, not a perk a creator gets via tier.
- **Daily payouts** — incompatible with MoR risk windows (chargebacks up to 120 days). Universal 7-day settlement applies instead.

---

## Recommended ship order

1. **Trial conversion plumbing** — lapse-expired-trial cron, reminder emails, support extension. This is the highest-leverage gap; without it Pro trials sit in `trialing` forever.
2. **Studio differentiators** — white-label player toggle, customer wallet polish so the +$80 between Pro and Studio is visible.
3. **Cohort retention curves** — closes the cohort_analytics roadmap row that's open across all three tiers.
4. **Scale-tier build** — sandbox/test mode, audit logs UI, then the domain bundles.
5. **Defer until paying Scale demand exists** — SSO, SCIM, course certificates, affiliate portal.
