import Link from 'next/link'

export default function GrowthSection() {
  return (
    <section className="bg-[#f6f9fc]">
      <div className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
        {/* Header */}
        <div className="mb-16">
          <p className="mb-3 text-[15px] font-semibold text-[#635bff]">
            Built for growth
          </p>
          <h2 className="max-w-[550px] text-[34px] leading-[1.15] font-semibold tracking-tight text-[#0a2540] sm:text-[44px]">
            Take your startup farther, faster
          </h2>
          <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-[#425466]">
            Startups build on Spaire to launch faster, adapt as they grow, and
            automate workflows to do more with less. Build your own API-based
            integration or use our low- to no-code solutions, which are simple
            enough for easy implementation and powerful enough to scale as fast
            and as far as you need.
          </p>
        </div>

        {/* Card grid - Stripe "Built for growth" layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column - larger cards */}
          <div className="flex flex-col gap-6">
            {/* Company Formation card */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="bg-[#f6f9fc] p-6">
                <div className="mx-auto w-full max-w-[400px] rounded-xl bg-white p-5 shadow-md">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7ce68]">
                        <span className="text-[14px]">&#9650;</span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#0a2540]">
                        Spaire x Doola
                      </span>
                    </div>
                    <span className="text-[13px] font-medium text-[#0a2540]">
                      YourStartup, Inc.
                    </span>
                  </div>
                  <div className="mb-3 flex gap-6">
                    <div className="space-y-2 border-l-2 border-[#635bff] pl-3">
                      <p className="text-[11px] font-medium text-[#635bff]">
                        Overview
                      </p>
                      <p className="text-[11px] text-[#8898aa]">Company</p>
                      <p className="text-[11px] text-[#8898aa]">Documents</p>
                      <p className="text-[11px] text-[#8898aa]">Partners</p>
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00d4aa]">
                          <span className="text-[10px] text-white">&#10003;</span>
                        </div>
                        <span className="text-[12px] text-[#0a2540]">
                          Incorporate your company
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00d4aa]">
                          <span className="text-[10px] text-white">&#10003;</span>
                        </div>
                        <span className="text-[12px] text-[#0a2540]">
                          EIN &amp; tax setup
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00d4aa]">
                          <span className="text-[10px] text-white">&#10003;</span>
                        </div>
                        <span className="text-[12px] text-[#0a2540]">
                          Open a bank account
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#e6ebf1]">
                          <span className="text-[10px] text-[#8898aa]">&#9679;</span>
                        </div>
                        <span className="text-[12px] font-medium text-[#0a2540]">
                          Start selling globally
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#f7ce68]">
                    <span className="text-[10px]">&#9650;</span>
                  </div>
                  <span className="text-[13px] font-medium text-[#0a2540]">
                    Company Formation
                  </span>
                </div>
                <h3 className="text-[22px] font-semibold text-[#0a2540]">
                  Incorporate your company
                </h3>
                <p className="mt-2 text-[15px] text-[#425466]">
                  Form a US legal entity, get an EIN, and start accepting
                  payments — all from anywhere in the world.
                </p>
              </div>
            </div>

            {/* Checkout card */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="bg-[#f6f9fc] p-6">
                <div className="mx-auto w-full max-w-[400px] rounded-xl bg-white p-5 shadow-md">
                  <div className="mb-3">
                    <label className="mb-1 block text-[12px] text-[#0a2540]">
                      Email
                    </label>
                    <div className="flex h-9 items-center rounded-md border border-gray-300 px-3">
                      <span className="text-[12px] text-[#8898aa]">
                        jane.diaz@example.com
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="mb-1 block text-[12px] text-[#0a2540]">
                      Card information
                    </label>
                    <div className="overflow-hidden rounded-md border border-gray-300">
                      <div className="flex h-9 items-center justify-between border-b border-gray-300 px-3">
                        <span className="text-[12px] text-[#8898aa]">
                          1234 1234 1234 1234
                        </span>
                        <div className="flex gap-1">
                          <div className="h-4 w-6 rounded-sm bg-[#1a1f36]" />
                          <div className="h-4 w-6 rounded-sm bg-[#6772e5]" />
                          <div className="h-4 w-6 rounded-sm bg-[#00d4aa]" />
                        </div>
                      </div>
                      <div className="flex">
                        <div className="flex h-9 flex-1 items-center border-r border-gray-300 px-3">
                          <span className="text-[12px] text-[#8898aa]">
                            MM/YY
                          </span>
                        </div>
                        <div className="flex h-9 flex-1 items-center px-3">
                          <span className="text-[12px] text-[#8898aa]">CVC</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="mb-1 block text-[12px] text-[#0a2540]">
                      Name on card
                    </label>
                    <div className="h-9 rounded-md border border-gray-300" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#635bff]">
                    <span className="text-[10px] text-white">&#9830;</span>
                  </div>
                  <span className="text-[13px] font-medium text-[#0a2540]">
                    Checkout
                  </span>
                </div>
                <h3 className="text-[22px] font-semibold text-[#0a2540]">
                  Sell to consumers
                </h3>
                <p className="mt-2 text-[15px] text-[#425466]">
                  Launch a B2C SaaS with a prebuilt payment page that&apos;s
                  optimized for conversion.
                </p>
              </div>
            </div>
          </div>

          {/* Right column - cards */}
          <div className="flex flex-col gap-6">
            {/* Startup Perks card */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="bg-[#f6f9fc] p-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Chat mockup */}
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="space-y-2">
                      <div className="w-fit rounded-lg bg-[#00d4aa]/10 px-3 py-1.5">
                        <p className="text-[10px] text-[#0a2540]">
                          Anything I can help with today?
                        </p>
                      </div>
                      <div className="ml-auto w-fit rounded-lg bg-[#635bff]/10 px-3 py-1.5">
                        <p className="text-[10px] text-[#0a2540]">
                          What perks do I get?
                        </p>
                      </div>
                      <div className="w-fit rounded-lg bg-[#00d4aa]/10 px-3 py-1.5">
                        <p className="text-[10px] text-[#0a2540]">
                          AWS $5K, Notion, Linear...
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      <div className="h-4 w-4 rounded-full bg-[#00d4aa]" />
                    </div>
                  </div>
                  {/* Perk value */}
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-[24px] font-bold text-[#0a2540]">
                      $50K+
                    </p>
                    <p className="text-[10px] text-[#8898aa]">in partner perks</p>
                    <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#00d4aa]">
                      <span className="text-[16px] text-white">&#9733;</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00d4aa]">
                    <span className="text-[10px] text-white">&#9733;</span>
                  </div>
                  <span className="text-[13px] font-medium text-[#0a2540]">
                    Startup Stack
                  </span>
                </div>
                <h3 className="text-[22px] font-semibold text-[#0a2540]">
                  Unlock partner perks
                </h3>
                <p className="mt-2 text-[15px] text-[#425466]">
                  Get $50K+ in credits from AWS, Notion, Linear, PostHog, and
                  more — unlocked after your first sale.
                </p>
              </div>
            </div>

            {/* Customer Portal card */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="bg-[#f6f9fc] p-6">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#635bff]/10" />
                    <span className="text-[12px] font-medium text-[#0a2540]">
                      Acme Corp
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md bg-[#f6f9fc] p-2">
                      <div>
                        <p className="text-[11px] font-medium text-[#0a2540]">
                          Pro Plan
                        </p>
                        <p className="text-[9px] text-[#8898aa]">
                          Monthly &middot; Active
                        </p>
                      </div>
                      <span className="text-[12px] font-semibold text-[#0a2540]">
                        $49/mo
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-[#f6f9fc] p-2">
                      <div>
                        <p className="text-[11px] font-medium text-[#0a2540]">
                          License Key
                        </p>
                        <p className="text-[9px] text-[#8898aa]">
                          SP-XXXX-XXXX-XXXX
                        </p>
                      </div>
                      <span className="rounded bg-[#00d4aa]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#00d4aa]">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#635bff]">
                    <span className="text-[10px] text-white">&#9830;</span>
                  </div>
                  <span className="text-[13px] font-medium text-[#0a2540]">
                    Customer Portal
                  </span>
                </div>
                <h3 className="text-[22px] font-semibold text-[#0a2540]">
                  Self-service billing
                </h3>
                <p className="mt-2 text-[15px] text-[#425466]">
                  Let customers manage subscriptions, view orders, access license
                  keys, and update payment methods.
                </p>
              </div>
            </div>

            {/* Invoicing card */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="bg-[#f6f9fc] p-6">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#00d4aa]/10" />
                    <span className="text-[12px] font-medium text-[#0a2540]">
                      Acme Inc
                    </span>
                  </div>
                  <p className="text-[22px] font-bold text-[#635bff]">
                    $144.78
                  </p>
                  <p className="text-[10px] text-[#8898aa]">Due Feb 19</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#8898aa]">To</span>
                      <span className="text-[#0a2540]">Jenny Rosen</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#8898aa]">From</span>
                      <span className="text-[#0a2540]">Acme Inc</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#8898aa]">Memo</span>
                      <span className="text-[#0a2540]">
                        9 editors, unlimited projects
                      </span>
                    </div>
                  </div>
                  <Link
                    href="#"
                    className="mt-3 block text-[10px] font-medium text-[#635bff]"
                  >
                    View invoice details &rsaquo;
                  </Link>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00d4aa]">
                    <span className="text-[10px] text-white">&#9830;</span>
                  </div>
                  <span className="text-[13px] font-medium text-[#0a2540]">
                    Invoicing
                  </span>
                </div>
                <h3 className="text-[22px] font-semibold text-[#0a2540]">
                  Sell to businesses
                </h3>
                <p className="mt-2 text-[15px] text-[#425466]">
                  Launch sales-assisted deals and collect one-time or recurring
                  payments with professional invoices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
