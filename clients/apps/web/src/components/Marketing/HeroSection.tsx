import Link from 'next/link'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Gradient Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #a960ee 0%, #ff7eb5 25%, #ffb86c 50%, #f7ce68 65%, #90e0ef 85%, #a18cd1 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, #ff6ec7 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #7b68ee 0%, transparent 50%), radial-gradient(ellipse at 60% 80%, #ffa07a 0%, transparent 50%)',
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-6 pt-32 pb-20 lg:px-10 lg:pt-40 lg:pb-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy */}
          <div>
            <h1 className="text-[48px] leading-[1.08] font-semibold tracking-tight text-[#0a2540] sm:text-[56px] lg:text-[68px]">
              Payment infrastructure for software
            </h1>
            <p className="mt-6 max-w-[500px] text-[17px] leading-relaxed text-[#425466] lg:text-[19px]">
              SaaS companies and digital product creators use Spaire to accept
              payments, manage billing, automate tax compliance, and grow
              revenue. We are the merchant of record — so you can focus on
              building, not operations.
            </p>
            <div className="mt-8 flex items-center gap-5">
              <Link
                href="/signup"
                className="inline-flex items-center rounded-full bg-[#635bff] px-6 py-3 text-[15px] font-semibold text-white shadow-lg transition-all hover:bg-[#5851ea] hover:shadow-xl"
              >
                Start now{' '}
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
                href="/contact"
                className="inline-flex items-center text-[15px] font-semibold text-[#0a2540] transition-colors hover:text-[#425466]"
              >
                Contact sales{' '}
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
            </div>
          </div>

          {/* Right: UI Mockups */}
          <div className="relative hidden lg:block">
            {/* Checkout Card */}
            <div className="absolute top-0 left-0 z-10 w-[320px] rounded-2xl bg-white p-6 shadow-2xl">
              {/* Product */}
              <div className="mb-4 flex flex-col items-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#635bff] to-[#a259ff]">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <p className="text-[14px] font-medium text-[#0a2540]">
                  Starter Kit
                </p>
                <p className="text-[13px] text-[#425466]">$19 per month</p>
              </div>

              {/* Apple Pay Button */}
              <div className="mb-3 flex h-11 items-center justify-center rounded-lg bg-black">
                <span className="text-[15px] font-medium text-white">
                   Pay
                </span>
              </div>

              {/* Divider */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[12px] text-[#8898aa]">
                  Or pay with card
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Email field */}
              <div className="mb-3">
                <label className="mb-1 block text-[13px] text-[#0a2540]">
                  Email
                </label>
                <div className="h-10 rounded-md border border-gray-300 bg-white" />
              </div>

              {/* Card Info */}
              <div className="mb-3">
                <label className="mb-1 block text-[13px] text-[#0a2540]">
                  Card information
                </label>
                <div className="overflow-hidden rounded-md border border-gray-300">
                  <div className="flex h-10 items-center justify-between border-b border-gray-300 px-3">
                    <span className="text-[13px] text-[#8898aa]">Number</span>
                    <div className="flex gap-1">
                      <div className="h-5 w-8 rounded bg-[#1a1f36]" />
                      <div className="h-5 w-8 rounded bg-[#6772e5]" />
                    </div>
                  </div>
                  <div className="flex">
                    <div className="flex h-10 flex-1 items-center border-r border-gray-300 px-3">
                      <span className="text-[13px] text-[#8898aa]">
                        MM / YY
                      </span>
                    </div>
                    <div className="flex h-10 flex-1 items-center px-3">
                      <span className="text-[13px] text-[#8898aa]">CVC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Country */}
              <div className="mb-4">
                <label className="mb-1 block text-[13px] text-[#0a2540]">
                  Country or region
                </label>
                <div className="flex h-10 items-center justify-between rounded-md border border-gray-300 px-3">
                  <span className="text-[13px] text-[#0a2540]">
                    United States
                  </span>
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Pay Button */}
              <button className="flex h-11 w-full items-center justify-center rounded-lg bg-[#635bff] text-[15px] font-semibold text-white">
                Pay
              </button>
            </div>

            {/* Dashboard Card */}
            <div className="ml-[200px] mt-[20px] w-[380px] rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#0a2540]">
                  Today
                </h3>
              </div>

              {/* Metrics */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] text-[#635bff]">Net volume</p>
                  <p className="text-[22px] font-semibold text-[#0a2540]">
                    $3,528,198.72
                  </p>
                  <p className="text-[11px] text-[#8898aa]">2:00 PM</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#8898aa]">Yesterday</p>
                  <p className="text-[18px] font-medium text-[#8898aa]">
                    $2,931,556.34
                  </p>
                </div>
              </div>

              {/* Chart placeholder */}
              <div className="mb-4 h-[80px] rounded-lg bg-gradient-to-r from-[#f6f9fc] to-[#f0f4f8]">
                <svg
                  viewBox="0 0 380 80"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,60 C50,55 80,40 120,35 C160,30 200,45 240,30 C280,15 320,20 380,10"
                    fill="none"
                    stroke="#635bff"
                    strokeWidth="2"
                  />
                  <path
                    d="M0,60 C50,55 80,40 120,35 C160,30 200,45 240,30 C280,15 320,20 380,10 L380,80 L0,80 Z"
                    fill="url(#chartGrad)"
                    opacity="0.1"
                  />
                  <defs>
                    <linearGradient
                      id="chartGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#635bff" />
                      <stop offset="100%" stopColor="#635bff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Bottom stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] text-[#0a2540]">
                      Net volume from sales
                    </p>
                    <span className="text-[11px] font-medium text-[#00d4aa]">
                      +32.8%
                    </span>
                  </div>
                  <p className="text-[18px] font-semibold text-[#0a2540]">
                    $39,274.29
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] text-[#0a2540]">New customers</p>
                    <span className="text-[11px] font-medium text-[#00d4aa]">
                      +32.1%
                    </span>
                  </div>
                  <p className="text-[18px] font-semibold text-[#0a2540]">
                    37
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
