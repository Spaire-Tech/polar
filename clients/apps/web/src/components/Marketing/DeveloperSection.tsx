import Link from 'next/link'

export default function DeveloperSection() {
  return (
    <section className="bg-[#0a2540]">
      <div className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: Copy */}
          <div>
            <p className="mb-3 text-[15px] font-semibold text-[#00d4aa]">
              Designed for developers
            </p>
            <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-white sm:text-[44px]">
              Ship more quickly with powerful and easy-to-use APIs
            </h2>
            <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-[#8898aa]">
              Save engineering time with a unified billing and payments platform.
              We obsess over the complexity of global tax, entitlements, and
              subscription lifecycle so that your teams can build what they need
              on one platform.
            </p>
            <Link
              href="https://docs.spairehq.com"
              className="mt-7 inline-flex items-center rounded-full bg-[#00d4aa] px-5 py-2.5 text-[14px] font-semibold text-[#0a2540] transition-all hover:bg-[#00c49e]"
            >
              Read the docs{' '}
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

          {/* Right: Code snippets */}
          <div className="space-y-4">
            {/* Code editor */}
            <div className="overflow-hidden rounded-xl bg-[#1a1f36] shadow-2xl">
              {/* Editor header */}
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28ca42]" />
              </div>
              {/* Code */}
              <div className="p-5 font-mono text-[13px] leading-relaxed">
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">1</span>
                  <span>
                    <span className="text-[#c792ea]">import</span>
                    <span className="text-[#d6deeb]">{' { '}</span>
                    <span className="text-[#82aaff]">Spaire</span>
                    <span className="text-[#d6deeb]">{' } '}</span>
                    <span className="text-[#c792ea]">from</span>
                    <span className="text-[#ecc48d]"> &quot;@spaire/sdk&quot;</span>
                    <span className="text-[#d6deeb]">;</span>
                  </span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">2</span>
                  <span className="text-[#d6deeb]" />
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">3</span>
                  <span>
                    <span className="text-[#c792ea]">const</span>
                    <span className="text-[#d6deeb]"> spaire = </span>
                    <span className="text-[#c792ea]">new</span>
                    <span className="text-[#82aaff]"> Spaire</span>
                    <span className="text-[#d6deeb]">{'({'}</span>
                  </span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">4</span>
                  <span>
                    <span className="text-[#d6deeb]">{'  '}</span>
                    <span className="text-[#7fdbca]">accessToken</span>
                    <span className="text-[#d6deeb]">: </span>
                    <span className="text-[#ecc48d]">&quot;sp_live_xxxxxxxx&quot;</span>
                    <span className="text-[#d6deeb]">,</span>
                  </span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">5</span>
                  <span className="text-[#d6deeb]">{'});'}</span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">6</span>
                  <span className="text-[#d6deeb]" />
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">7</span>
                  <span>
                    <span className="text-[#c792ea]">const</span>
                    <span className="text-[#d6deeb]"> checkout = </span>
                    <span className="text-[#c792ea]">await</span>
                    <span className="text-[#d6deeb]"> spaire.</span>
                    <span className="text-[#82aaff]">checkouts</span>
                    <span className="text-[#d6deeb]">.</span>
                    <span className="text-[#82aaff]">create</span>
                    <span className="text-[#d6deeb]">{'({'}</span>
                  </span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">8</span>
                  <span>
                    <span className="text-[#d6deeb]">{'  '}</span>
                    <span className="text-[#7fdbca]">productId</span>
                    <span className="text-[#d6deeb]">: </span>
                    <span className="text-[#ecc48d]">&quot;prod_xxxxx&quot;</span>
                    <span className="text-[#d6deeb]">,</span>
                  </span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">9</span>
                  <span>
                    <span className="text-[#d6deeb]">{'  '}</span>
                    <span className="text-[#7fdbca]">successUrl</span>
                    <span className="text-[#d6deeb]">: </span>
                    <span className="text-[#ecc48d]">&quot;https://example.com/success&quot;</span>
                    <span className="text-[#d6deeb]">,</span>
                  </span>
                </div>
                <div className="flex">
                  <span className="mr-4 text-[#4f5b76]">10</span>
                  <span className="text-[#d6deeb]">{'});'}</span>
                </div>
              </div>
            </div>

            {/* Terminal */}
            <div className="overflow-hidden rounded-xl bg-[#1a1f36] shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                <span className="text-[11px] font-medium text-[#8898aa]">
                  TERMINAL
                </span>
              </div>
              <div className="p-5 font-mono text-[13px] leading-relaxed">
                <p className="text-[#8898aa]">
                  <span className="text-[#00d4aa]">$</span> node server.js
                  &amp;&amp; spaire listen
                </p>
                <p className="text-[#d6deeb]">
                  &gt; Ready! Waiting for requests...
                </p>
                <p className="text-[#8898aa]">
                  2026-04-08 14:32:01{' '}
                  <span className="text-[#00d4aa]">[200]</span>{' '}
                  <span className="text-[#d6deeb]">checkout.created</span>
                </p>
                <p className="text-[#8898aa]">
                  2026-04-08 14:32:05{' '}
                  <span className="text-[#00d4aa]">[200]</span>{' '}
                  <span className="text-[#d6deeb]">order.created</span>
                </p>
                <p className="text-[#8898aa]">
                  2026-04-08 14:32:05{' '}
                  <span className="text-[#00d4aa]">[200]</span>{' '}
                  <span className="text-[#d6deeb]">subscription.active</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4-column developer features */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Use Spaire with your stack',
              desc: 'We offer TypeScript, Python, Go, PHP, and Ruby SDKs plus a REST API for any language.',
              link: 'See libraries',
              href: 'https://docs.spairehq.com/integrate/sdk/typescript',
            },
            {
              title: 'Try no-code options',
              desc: 'Checkout links and the dashboard let you accept payments with zero code.',
              link: 'Explore no-code',
              href: '/features/checkout',
            },
            {
              title: 'Explore framework adapters',
              desc: 'Connect Spaire to Next.js, Remix, Nuxt, SvelteKit, Astro, Laravel, and more.',
              link: 'Browse adapters',
              href: 'https://docs.spairehq.com/integrate/sdk/typescript',
            },
            {
              title: 'Automate with webhooks',
              desc: 'Real-time events for orders, subscriptions, and customer changes — in JSON, Slack, or Discord format.',
              link: 'Learn about webhooks',
              href: 'https://docs.spairehq.com/integrate/webhooks/delivery',
            },
          ].map((item) => (
            <div key={item.title} className="border-l-2 border-[#635bff] pl-4">
              <h3 className="text-[15px] font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#8898aa]">
                {item.desc}
              </p>
              <Link
                href={item.href}
                className="mt-3 inline-flex items-center text-[13px] font-semibold text-[#00d4aa] hover:underline"
              >
                {item.link}{' '}
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
          ))}
        </div>
      </div>
    </section>
  )
}
