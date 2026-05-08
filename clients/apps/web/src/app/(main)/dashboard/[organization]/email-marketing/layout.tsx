'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { DialogsRoot } from './_components/dialogs'
import { Icon } from './_components/Icon'
import {
  MarkAnalytics,
  MarkBroadcast,
  MarkPeople,
  MarkSequences,
} from './_components/MarkIcons'
import './styles.css'

const TABS = [
  { suffix: '/subscribers', label: 'Subscribers', Mark: MarkPeople },
  { suffix: '/broadcasts', label: 'Broadcasts', Mark: MarkBroadcast },
  { suffix: '/sequences', label: 'Sequences', Mark: MarkSequences },
  { suffix: '/analytics', label: 'Analytics', Mark: MarkAnalytics },
] as const

export default function EmailMarketingLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/email-marketing`
  const activeTabSuffix =
    TABS.find((t) => pathname.startsWith(`${base}${t.suffix}`))?.suffix ??
    '/subscribers'

  return (
    <div className="spaire-email-app">
      <div
        className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/85 backdrop-blur-md"
        style={{ WebkitBackdropFilter: 'saturate(180%) blur(20px)' }}
      >
        <div className="container flex h-[78px] items-center justify-between">
          <div className="flex items-center gap-7">
            <Link
              href={`/dashboard/${params.organization}`}
              className="btn-icon"
              style={{ width: 36, height: 36, borderRadius: 9 }}
              aria-label="Back to dashboard"
            >
              <Icon name="arrow-left" size={15} />
            </Link>
            <span className="brand">
              <span className="brand-text">
                <span className="brand-name">Email Marketing</span>
              </span>
            </span>
            <span className="brand-divider" />
            <nav className="tabs" aria-label="Email marketing sections">
              {TABS.map(({ suffix, label, Mark }) => (
                <Link
                  key={suffix}
                  href={`${base}${suffix}`}
                  prefetch
                  className={`tab ${
                    activeTabSuffix === suffix ? 'tab-active' : ''
                  }`}
                  aria-current={
                    activeTabSuffix === suffix ? 'page' : undefined
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <Mark size={18} />
                    {label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="container pt-14 pb-24">{children}</div>
      <DialogsRoot />
    </div>
  )
}
