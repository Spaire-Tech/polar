import Link from 'next/link'

const footerColumns = [
  {
    title: 'Products',
    links: [
      { label: 'Payments', href: '/products/payments' },
      { label: 'Billing & Subscriptions', href: '/products/billing' },
      { label: 'Usage-based Billing', href: '/products/usage-billing' },
      { label: 'Checkouts', href: '/products/checkouts' },
      { label: 'Merchant of Record', href: '/products/merchant-of-record' },
      { label: 'Customer Portal', href: '/products/customer-portal' },
      { label: 'Customer Management', href: '/products/customer-management' },
      { label: 'Invoicing', href: '/products/invoicing' },
      { label: 'Fraud Prevention', href: '/products/fraud-prevention' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Digital Products', href: '/solutions/digital-products' },
      { label: 'Spaire Space', href: '/solutions/space' },
      { label: 'Enterprise', href: '/solutions/enterprise' },
      { label: 'Startup Stack', href: '/solutions/startup-stack' },
      { label: 'Company Formation', href: '/solutions/company-formation' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: 'https://docs.spairehq.com' },
      { label: 'API Reference', href: 'https://docs.spairehq.com/api-reference' },
      { label: 'SDKs & Libraries', href: 'https://docs.spairehq.com/integrate/sdk/typescript' },
      { label: 'Webhooks', href: 'https://docs.spairehq.com/integrate/webhooks/delivery' },
      { label: 'Changelog', href: 'https://docs.spairehq.com/changelog' },
      { label: 'Sandbox', href: 'https://sandbox.spairehq.com' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Playbook', href: '/playbook' },
      { label: 'Compare', href: '/compare' },
      { label: 'Brand Assets', href: '/brand' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
]

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[#e6ebf1] bg-white">
      <div className="mx-auto max-w-[1280px] px-6 pt-16 pb-10 lg:px-10">
        {/* Footer columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-[13px] font-semibold text-[#0a2540]">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[#425466] transition-colors hover:text-[#0a2540]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-[#e6ebf1] pt-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-6">
            <span className="text-[18px] font-bold tracking-tight text-[#0a2540]">
              spaire
            </span>
            <span className="text-[12px] text-[#8898aa]">
              &copy; {new Date().getFullYear()} Spaire Technologies, Inc.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/legal/privacy"
              className="text-[12px] text-[#8898aa] hover:text-[#425466]"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="text-[12px] text-[#8898aa] hover:text-[#425466]"
            >
              Terms
            </Link>
            <Link
              href="/legal/dpa"
              className="text-[12px] text-[#8898aa] hover:text-[#425466]"
            >
              DPA
            </Link>
            {/* Social icons */}
            <Link
              href="https://x.com/spairehq"
              className="text-[#8898aa] transition-colors hover:text-[#425466]"
              aria-label="X (Twitter)"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
            <Link
              href="https://github.com/spaire-tech"
              className="text-[#8898aa] transition-colors hover:text-[#425466]"
              aria-label="GitHub"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
