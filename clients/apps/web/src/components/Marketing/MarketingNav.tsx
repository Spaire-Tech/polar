'use client'

import Link from 'next/link'
import { useState } from 'react'

const navLinks = [
  { label: 'Products', href: '#products' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Developers', href: '#developers' },
  { label: 'Resources', href: '/playbook' },
  { label: 'Pricing', href: '/pricing' },
]

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 right-0 left-0 z-50">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 lg:px-10">
        {/* Logo */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[20px] font-bold tracking-tight text-white">
              spaire
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[15px] font-medium text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="hidden items-center gap-6 lg:flex">
          <Link
            href="/contact"
            className="text-[15px] font-medium text-white/80 transition-colors hover:text-white"
          >
            Contact sales{' '}
            <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
              &rsaquo;
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/25 px-4 py-1.5 text-[15px] font-medium text-white transition-all hover:border-white/50 hover:bg-white/10"
          >
            Sign in{' '}
            <span className="ml-0.5">&rsaquo;</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#0a2540]/95 px-6 py-6 backdrop-blur-md lg:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[16px] font-medium text-white/80"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-white/10" />
            <Link href="/contact" className="text-[16px] font-medium text-white/80">
              Contact sales
            </Link>
            <Link href="/login" className="text-[16px] font-medium text-white/80">
              Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
