# Spaire Pricing

Three tiers — **Free**, **Pro**, **Scale** — calibrated against what the platform actually ships today and benchmarked against Kajabi, Podia, Thinkific, Lemon Squeezy, Paddle, and Gumroad.

Spaire's positioning vs. those competitors:

- **Merchant of Record** built in (Kajabi/Podia/Thinkific don't do this — tax/VAT stays on the creator).
- **Developer-first** APIs, SDKs, webhooks, license keys, usage-based billing (course platforms lack these).
- **Course builder + email marketing** in the same product (Lemon Squeezy/Paddle/Gumroad don't have these).

The tiering story: "Stripe-grade infra + Kajabi-grade creator tools + MoR tax handling — pick your scale."

---

## Universal — applies to Free, Pro, and Scale

The following are part of the product on every tier. Gating any of these would break delivery for paying customers.

| Item | Policy |
|---|---|
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
| "Powered by Spaire" badge on storefront & checkout | shown on all tiers |
| Payout settlement | 7-day delay from transaction date |
| Settlement grandfathering | orgs created before May 12, 2026 keep instant payouts |
| Stripe chargeback fee | $15 passthrough to creator |
| International card / FX | Stripe surcharge passthrough |
| Minimum payout threshold | $25 |
| Refund policy | Spaire's % fee retained on refund |

---

## Tier differentiators

| Lever | Free | Pro | Scale |
|---|---|---|---|
| **Monthly** | $0 | $49 | $299 |
| **Transaction fee** | 5% + $0.50 | 4% + $0.40 | 3.5% + $0.30 |
| **Custom pricing at scale** | — | — | available above $50k/mo GMV |
| Products (one-time, sub, downloads, license keys, usage-based) | unlimited | unlimited | unlimited |
| Published courses | 1 | unlimited | unlimited |
| Lessons per course | 10 | unlimited | unlimited |
| Drip scheduling | — | ✓ | ✓ |
| Course video hours hosted ‡ | 5 | 50 | unlimited |
| Course video views / month ‡ | 1,000 | 50,000 | unlimited |
| Downloadables storage ‡ | 1 GB | 25 GB | unlimited |
| Email subscribers | 1,000 | 25,000 | unlimited |
| Email sends / month ‡ | 5,000 | 250,000 | 2,000,000 |
| Email sequences & segments | — | ✓ | ✓ |
| Email A/B testing | — | ✓ | ✓ |
| Stackable / cart-rule discounts ★ | — | roadmap | roadmap |
| Checkout links | ✓ | ✓ | ✓ |
| Embedded checkout on your site | ✓ | ✓ | ✓ |
| Custom email sender domain ★ | — | ✓ | ✓ |
| White-label course player ★ | — | — | ✓ |
| Seat-based product pricing (B2B sales) | — | ✓ | ✓ |
| Customer wallet (prepaid balance, auto-top-up) | — | ✓ | ✓ |
| Analytics — revenue, MRR, churn rate | ✓ | ✓ | ✓ |
| Analytics — cohort retention curves ★ | — | roadmap | roadmap |
| CSV exports of analytics & customer data | ✓ | ✓ | ✓ |
| Dashboard team seats | 1 | 5 | unlimited |
| API rate limits | standard | higher | highest + custom |
| Sandbox / test mode ★ | — | — | roadmap |
| Custom storefront domain ★ | — | — | roadmap |
| Custom checkout domain ★ | — | — | roadmap |
| SSO + audit logs ★ | — | — | roadmap |
| Support | community (Discord) | email, 1 business day | Slack + dedicated AM, 4-hour SLA |

‡ = quota enforcement must be built before this row is shippable.
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

- **Free at 5% + $0.50** leaves margin without a monthly fee.
- **Pro at 4% + $0.40** matches the Polar precedent and is sustainable with the monthly anchor.
- **Scale at 3.5% + $0.30** is at-cost; the monthly fee is the margin. Below 3.5% requires negotiated volume commitments.

Custom pricing for the Scale tier kicks in above $50k/month GMV. The negotiated floor is around 3.0% — Stripe's processing cost — and is the same floor competitors like Paddle hold to at scale.

---

## Audit findings — what's built today vs. needs work

Audit ran against `/home/user/polar` to verify each pricing-page row is backed by code.

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

### Built infrastructure, needs surfacing or completion

- Custom email sender domain — default sender exists, no verification UI for per-org domains.
- White-label course player — YouTube embeds use `modestbranding=1`, main lesson player has no toggle.
- Cohort analysis — only aggregate churn rate today, no retention curves.
- Refund/chargeback fee policy — fee types tracked (`ProcessorFeeType.dispute`, `ProcessorFeeType.refund`), no policy config for absorption.

### Not built — required before launch

Cost-control prerequisites for the Free tier. Without these, a single user can incur more in vendor cost than the entire Free tier earns:

- Video hours-hosted cap and views-per-month cap (Mux usage tracking + enforcement).
- Downloadables storage GB cap (S3 usage tracking + enforcement).
- Email sends-per-month cap (per-org outbound email tracking).

### Not built — Scale-tier roadmap

- Custom storefront domain (was previously removed in `2024-06-21-1348_remove_organization_custom_domain.py`; needs to be rebuilt).
- Custom checkout domain (no DNS verification, SSL provisioning, or domain routing).
- SSO / SAML for the merchant dashboard.
- Audit logs.
- Sandbox / test mode (no per-org Stripe test/live toggle today).

### Deliberately removed from the table

- **Affiliate program** — no signup portal, dashboard, or payouts for third-party affiliates. The `campaign/` module is alpha and appears to be for Spaire's own platform-fee promo codes, not creator-facing referrals.
- **Account credits as a tier feature** — `account_credit/` is an internal lever Spaire uses to issue promo credits against platform fees, not a perk a creator gets via tier.
- **Daily payouts** — incompatible with MoR risk windows (chargebacks up to 120 days). Universal 7-day settlement applies instead.

---

## Recommended ship order

1. **Free-tier blockers** — video hours/views cap, storage GB cap, email send cap. Without these, Free is unsafe to launch.
2. **Pro-tier polish** — custom email sender domain verification UI, white-label player toggle, cohort retention curves.
3. **Scale-tier build** — sandbox/test mode, audit logs.
4. **Defer until paying Scale demand exists** — custom storefront and checkout domains, SSO, SCIM, course certificates, affiliate portal.
