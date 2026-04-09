import Link from 'next/link'

export default function LaunchSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: Copy */}
          <div>
            <p className="mb-3 text-[15px] font-semibold text-[#635bff]">
              Launch with ease
            </p>
            <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-[#0a2540] sm:text-[44px]">
              No-code and low-code options for getting started
            </h2>
            <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-[#425466]">
              If you&apos;d like to use Spaire but don&apos;t have developers on
              staff, no problem. We&apos;ll help you find a solution. Create
              products, generate checkout links, and manage subscriptions
              entirely from the dashboard — or embed a checkout with a single
              line of code.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
              <Link
                href="/signup"
                className="inline-flex items-center rounded-full bg-[#635bff] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#5851ea]"
              >
                Create a checkout link{' '}
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
              <Link
                href="https://docs.spairehq.com/features/checkout/embed"
                className="inline-flex items-center text-[14px] font-semibold text-[#635bff] hover:underline"
              >
                Embed checkout{' '}
                <svg
                  className="ml-1 h-3 w-3"
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
            </div>
          </div>

          {/* Right: Dashboard mockup */}
          <div className="rounded-2xl bg-[#f6f9fc] p-6 shadow-sm ring-1 ring-black/5">
            <div className="rounded-xl bg-white p-5 shadow-md">
              {/* Dashboard header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#635bff]" />
                  <span className="text-[13px] font-semibold text-[#0a2540]">
                    Dashboard
                  </span>
                </div>
                <div className="flex gap-4 text-[11px] text-[#8898aa]">
                  <span>Products</span>
                  <span>Customers</span>
                  <span>Analytics</span>
                </div>
              </div>

              {/* Product list */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#0a2540]">
                    Products
                  </span>
                  <button className="rounded-md bg-[#635bff] px-3 py-1 text-[10px] font-medium text-white">
                    + New product
                  </button>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Starter Plan', price: '$19/mo', status: 'Active' },
                    { name: 'Pro Plan', price: '$49/mo', status: 'Active' },
                    { name: 'Enterprise', price: 'Custom', status: 'Active' },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between rounded-lg border border-[#e6ebf1] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-[#f6f9fc]" />
                        <span className="text-[11px] font-medium text-[#0a2540]">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#425466]">
                          {p.price}
                        </span>
                        <span className="rounded bg-[#00d4aa]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#00d4aa]">
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checkout link */}
              <div className="rounded-lg bg-[#f6f9fc] p-3">
                <p className="mb-1 text-[10px] font-medium text-[#0a2540]">
                  Checkout Link
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-[#e6ebf1] bg-white px-2 py-1">
                    <span className="text-[10px] text-[#8898aa]">
                      buy.spairehq.com/acme/pro-plan
                    </span>
                  </div>
                  <button className="rounded-md bg-[#0a2540] px-2 py-1 text-[10px] text-white">
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
