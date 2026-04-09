import Link from 'next/link'

/* ─── Shared Section Shell ─────────────────────────────────────────── */
function ProductSection({
  eyebrow,
  eyebrowColor = '#635bff',
  title,
  description,
  ctaLabel,
  ctaHref,
  seeAlso,
  children,
  reversed = false,
}: {
  eyebrow: string
  eyebrowColor?: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
  seeAlso: { label: string; desc: string; href: string }[]
  children: React.ReactNode
  reversed?: boolean
}) {
  return (
    <div
      className={`grid items-center gap-12 py-24 lg:grid-cols-2 lg:gap-20 ${reversed ? 'lg:[direction:rtl]' : ''}`}
    >
      <div className={reversed ? 'lg:[direction:ltr]' : ''}>
        <p
          className="mb-3 text-[15px] font-semibold"
          style={{ color: eyebrowColor }}
        >
          {eyebrow}
        </p>
        <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-[#0a2540] sm:text-[40px]">
          {title}
        </h2>
        <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-[#425466]">
          {description}
        </p>
        <Link
          href={ctaHref}
          className="mt-7 inline-flex items-center rounded-full bg-[#635bff] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#5851ea]"
        >
          {ctaLabel}{' '}
          <svg
            className="ml-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>

        {seeAlso.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-[14px] font-semibold text-[#0a2540]">
              See also
            </p>
            {seeAlso.map((item) => (
              <p key={item.label} className="text-[14px] text-[#425466]">
                <Link
                  href={item.href}
                  className="font-medium text-[#635bff] hover:underline"
                >
                  {item.label}
                </Link>{' '}
                {item.desc}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className={reversed ? 'lg:[direction:ltr]' : ''}>{children}</div>
    </div>
  )
}

/* ─── Modular Solutions Intro ──────────────────────────────────────── */
function ModularSolutionsIntro() {
  return (
    <div className="border-b border-[#e6ebf1] py-24">
      <p className="mb-3 text-[15px] font-semibold text-[#635bff]">
        Unified commerce
      </p>
      <h2 className="max-w-[550px] text-[34px] leading-[1.15] font-semibold tracking-tight text-[#0a2540] sm:text-[44px]">
        A fully integrated suite of billing, payments, and compliance products
      </h2>
      <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-[#425466]">
        Reduce costs, grow revenue, and run your software business more
        efficiently on a single platform. Use Spaire to handle all of your
        payments-related needs, manage revenue operations, and launch (or invent)
        new business models.
      </p>
    </div>
  )
}

/* ─── Payments Section ─────────────────────────────────────────────── */
function PaymentsSection() {
  return (
    <ProductSection
      eyebrow="Payments"
      title="Accept and optimize payments, globally"
      description="Increase authorization rates, optimize your checkout conversion, and offer local payment methods in every market. Support 36+ currencies with a single integration."
      ctaLabel="Start with Payments"
      ctaHref="/signup"
      seeAlso={[
        { label: 'Tax compliance', desc: 'for automating sales tax and VAT', href: 'https://docs.spairehq.com/merchant-of-record/introduction' },
        { label: 'Fraud prevention', desc: 'for real-time transaction security', href: 'https://docs.spairehq.com/features/fraud' },
        { label: 'Customer Portal', desc: 'for self-service billing management', href: 'https://docs.spairehq.com/features/customer-portal' },
      ]}
    >
      {/* Checkout mockup */}
      <div className="mx-auto w-[320px] rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
        <div className="mb-4 flex flex-col items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f6f9fc]">
            <svg className="h-6 w-6 text-[#635bff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#0a2540]">Design System Pro</p>
          <p className="text-[20px] font-semibold text-[#0a2540]">$149</p>
        </div>

        <div className="mb-3 flex h-10 items-center justify-center rounded-md bg-black">
          <span className="text-[14px] font-medium text-white"> Pay</span>
        </div>

        <div className="mb-3 flex h-10 items-center justify-center rounded-md bg-[#00d4aa]">
          <span className="text-[14px] font-semibold text-white">Pay faster</span>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] text-[#8898aa]">Or pay another way</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[12px] text-[#0a2540]">Email</label>
          <div className="flex h-9 items-center rounded-md border border-gray-300 px-3">
            <span className="text-[12px] text-[#8898aa]">jane.diaz@example.com</span>
          </div>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[12px] text-[#0a2540]">Card information</label>
          <div className="overflow-hidden rounded-md border border-gray-300">
            <div className="flex h-9 items-center justify-between border-b border-gray-300 px-3">
              <span className="text-[12px] text-[#8898aa]">4242 4242 4242 4242</span>
              <div className="flex gap-1">
                <div className="h-4 w-6 rounded-sm bg-[#1a1f36]" />
                <div className="h-4 w-6 rounded-sm bg-[#6772e5]" />
              </div>
            </div>
            <div className="flex">
              <div className="flex h-9 flex-1 items-center border-r border-gray-300 px-3">
                <span className="text-[12px] text-[#8898aa]">05/26</span>
              </div>
              <div className="flex h-9 flex-1 items-center px-3">
                <span className="text-[12px] text-[#8898aa]">123</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[12px] text-[#0a2540]">Country or region</label>
          <div className="flex h-9 items-center justify-between rounded-md border border-gray-300 px-3">
            <span className="text-[12px] text-[#0a2540]">United States</span>
            <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <button className="mt-3 flex h-10 w-full items-center justify-center rounded-md bg-[#635bff] text-[14px] font-semibold text-white">
          Pay $149
        </button>
      </div>
    </ProductSection>
  )
}

/* ─── Billing Section ──────────────────────────────────────────────── */
function BillingSection() {
  return (
    <ProductSection
      eyebrow="Billing"
      eyebrowColor="#00d4aa"
      title="Capture recurring revenue"
      description="Support subscriptions, one-time purchases, seat-based licensing, and usage-based billing — all from one engine. Manage trials, proration, dunning, and lifecycle events automatically."
      ctaLabel="Start with Billing"
      ctaHref="/signup"
      reversed
      seeAlso={[
        { label: 'Usage-based billing', desc: 'for metered and consumption pricing', href: 'https://docs.spairehq.com/features/usage-based-billing/introduction' },
        { label: 'Seat-based pricing', desc: 'for team and enterprise products', href: 'https://docs.spairehq.com/features/seat-based-pricing' },
        { label: 'Discounts', desc: 'for coupons, trials, and promotional pricing', href: 'https://docs.spairehq.com/features/discounts' },
      ]}
    >
      {/* Pricing table mockup */}
      <div className="mx-auto w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-[#635bff]" />
            <span className="text-[13px] font-medium text-[#0a2540]">Quantum</span>
          </div>
          <div className="flex gap-4">
            <span className="text-[11px] text-[#8898aa]">Products</span>
            <span className="text-[11px] text-[#8898aa]">Pricing</span>
            <span className="text-[11px] text-[#8898aa]">Contact</span>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Standard', desc: 'Up to 5 users', price: '$49', highlight: false },
            { name: 'Professional', desc: 'Up to 25 users', price: '$149', highlight: true },
            { name: 'Enterprise', desc: 'Unlimited users', price: '$299', highlight: false },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-lg p-3 ${plan.highlight ? 'bg-[#f6f9fc] ring-2 ring-[#635bff]' : ''}`}
            >
              <p className="text-[11px] font-medium text-[#0a2540]">
                {plan.name}
                {plan.highlight && (
                  <span className="ml-1.5 rounded bg-[#635bff] px-1 py-0.5 text-[9px] text-white">
                    Popular
                  </span>
                )}
              </p>
              <p className="text-[9px] text-[#8898aa]">{plan.desc}</p>
              <p className="mt-1 text-[18px] font-semibold text-[#0a2540]">
                {plan.price}
                <span className="text-[10px] font-normal text-[#8898aa]">
                  /month
                </span>
              </p>
              <button className="mt-2 w-full rounded-md bg-[#635bff] py-1.5 text-[10px] font-semibold text-white">
                Subscribe
              </button>
              <div className="mt-2 space-y-1">
                <p className="text-[8px] text-[#8898aa]">This includes:</p>
                {['Historical data', 'Data refresh', 'Integrations', 'Reporting'].map(
                  (f) => (
                    <p key={f} className="flex items-center gap-1 text-[8px] text-[#425466]">
                      <span className="text-[#00d4aa]">&#10003;</span> {f}
                    </p>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProductSection>
  )
}

/* ─── Merchant of Record Section ───────────────────────────────────── */
function MerchantOfRecordSection() {
  return (
    <ProductSection
      eyebrow="Merchant of Record"
      eyebrowColor="#0048e5"
      title="We handle taxes, you handle product"
      description="Spaire is the legal seller on every transaction. We calculate, collect, and remit VAT, GST, and sales tax globally — so you can sell in 100+ countries without registering a single tax entity."
      ctaLabel="Learn about MoR"
      ctaHref="https://docs.spairehq.com/merchant-of-record/introduction"
      seeAlso={[
        { label: 'Supported countries', desc: 'for global coverage details', href: 'https://docs.spairehq.com/merchant-of-record/supported-countries' },
        { label: 'Payouts', desc: 'for balance tracking and disbursements', href: 'https://docs.spairehq.com/features/finance/payouts' },
        { label: 'Invoicing', desc: 'for compliant billing documents', href: 'https://docs.spairehq.com/features/invoices' },
      ]}
    >
      {/* MoR flow diagram */}
      <div className="mx-auto w-full max-w-[380px]">
        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          {/* Order header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#8898aa]">#9124</span>
              <span className="text-[13px] font-medium text-[#0a2540]">
                Jacques Muller
              </span>
            </div>
            <span className="text-[16px] font-semibold text-[#0a2540]">
              $200.00
            </span>
          </div>
          <div className="mb-6">
            <span className="rounded bg-[#635bff]/10 px-2 py-0.5 text-[11px] font-medium text-[#635bff]">
              Processing
            </span>
          </div>

          {/* Flow */}
          <div className="flex flex-col items-center">
            <div className="rounded-full bg-[#00d4aa] px-4 py-1.5 text-[12px] font-semibold text-white">
              Buyers
            </div>
            <div className="my-2 flex flex-col items-center">
              {[...Array(4)].map((_, i) => (
                <svg key={i} className="h-3 w-3 text-[#635bff]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 16l-6-6h12z" />
                </svg>
              ))}
            </div>
            <div className="flex items-center gap-6">
              <div className="rounded-full bg-[#635bff] px-4 py-1.5 text-[12px] font-semibold text-white">
                Spaire (MoR)
              </div>
              <span className="text-[13px] font-medium text-[#0a2540]">
                Tax &amp; compliance
              </span>
            </div>
            <div className="my-2 flex flex-col items-center">
              {[...Array(4)].map((_, i) => (
                <svg key={i} className="h-3 w-3 text-[#635bff]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 16l-6-6h12z" />
                </svg>
              ))}
            </div>
            <div className="flex items-center gap-6">
              <div className="rounded-full bg-[#00d4aa] px-4 py-1.5 text-[12px] font-semibold text-white">
                You
              </div>
              <span className="text-[13px] font-medium text-[#0a2540]">
                $190.00 payout
              </span>
            </div>
          </div>
        </div>
      </div>
    </ProductSection>
  )
}

/* ─── Spaire Space Section ─────────────────────────────────────────── */
function SpairSpaceSection() {
  return (
    <ProductSection
      eyebrow="Spaire Space"
      eyebrowColor="#00d4aa"
      title="Your storefront, ready in minutes"
      description="Every account gets a hosted product page. Sell subscriptions, digital downloads, license keys, and one-time products from a branded storefront — no website required."
      ctaLabel="Start with Space"
      ctaHref="/signup"
      reversed
      seeAlso={[
        { label: 'Products', desc: 'for catalog and pricing configuration', href: 'https://docs.spairehq.com/features/products' },
        { label: 'Benefits', desc: 'for automated entitlements and delivery', href: 'https://docs.spairehq.com/features/benefits/introduction' },
        { label: 'License keys', desc: 'for software activation and distribution', href: 'https://docs.spairehq.com/features/benefits/license-keys' },
      ]}
    >
      {/* Storefront mockup */}
      <div className="mx-auto w-full max-w-[380px] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5">
        {/* Header gradient */}
        <div className="mb-4 h-24 overflow-hidden rounded-xl bg-gradient-to-r from-[#635bff] via-[#a259ff] to-[#ff6ec7]">
          <div className="flex h-full items-end p-4">
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur" />
          </div>
        </div>

        <h3 className="text-[15px] font-semibold text-[#0a2540]">
          Acme Software
        </h3>
        <p className="mb-4 text-[12px] text-[#425466]">
          Developer tools for modern teams
        </p>

        {/* Products */}
        <div className="space-y-3">
          {[
            { name: 'Pro Plan', price: '$49/mo', tag: 'Subscription' },
            { name: 'Icon Pack', price: '$29', tag: 'Digital download' },
            { name: 'Enterprise', price: '$299/mo', tag: 'Seat-based' },
          ].map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between rounded-lg border border-[#e6ebf1] p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f6f9fc]">
                  <div className="h-3 w-3 rounded-sm bg-[#635bff]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#0a2540]">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-[#8898aa]">{p.tag}</p>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#0a2540]">
                {p.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </ProductSection>
  )
}

/* ─── Export All ────────────────────────────────────────────────────── */
export {
  ModularSolutionsIntro,
  PaymentsSection,
  BillingSection,
  MerchantOfRecordSection,
  SpairSpaceSection,
}
