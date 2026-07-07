'use client'

// Mobile-only bottom tab bar. Sticks to the bottom of the viewport and
// mirrors the desktop `TopBar` tabs (Overview / Courses / Community /
// Enrollments / Billing) with permission rules. Visible only at narrow
// widths — the CSS in portal.css hides it on desktop.
//
// Phase 4d: Downloads is hidden in both this bar and the desktop TopBar.

import {
  useAuthenticatedCustomer,
  usePortalAuthenticatedUser,
} from '@/hooks/queries'
import { useCommunityEnrolledCourses } from '@/hooks/queries/community'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import * as React from 'react'

type Tab = {
  href: string
  label: string
  matches: (path: string) => boolean
  icon: (active: boolean) => React.ReactNode
}

// Tab glyphs — line-based, fill the body when active for a soft "selected"
// state without competing with the brand's grayscale palette.
const HomeIcon = (active: boolean) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-4v-7h-8v7H4a1 1 0 0 1-1-1v-8.5Z" />
  </svg>
)
const StackIcon = (active: boolean) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect
      x="3"
      y="4"
      width="18"
      height="6"
      rx="1.5"
      fill={active ? 'currentColor' : 'none'}
    />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
  </svg>
)
// Retained for when the Downloads tab is restored (Phase 4d).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TrayIcon = (active: boolean) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path
      d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.15 : 0}
    />
    <path d="M8 11l4 4 4-4M12 4v11" />
  </svg>
)
const BagIcon = (active: boolean) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8Z" />
    <path
      d="M9 8V6a3 3 0 0 1 6 0v2"
      stroke={active ? '#fff' : 'currentColor'}
    />
  </svg>
)
const CardIcon = (active: boolean) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect
      x="3"
      y="6"
      width="18"
      height="13"
      rx="2"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.12 : 0}
    />
    <path d="M3 10h18M7 15h3" />
  </svg>
)
const ChatIcon = (active: boolean) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 12a8 8 0 0 1-12.7 6.5L3 20l1.5-5.3A8 8 0 1 1 21 12z" />
  </svg>
)

const buildTabs = (
  organization: schemas['CustomerOrganization'],
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined,
  showCommunity: boolean,
): Tab[] => {
  const slug = organization.slug
  const canAccessBilling = hasBillingPermission(authenticatedUser)
  const tabs: Tab[] = [
    {
      href: `/${slug}/portal/overview`,
      label: 'Overview',
      matches: (p) => p.includes('/portal/overview'),
      icon: HomeIcon,
    },
    {
      href: `/${slug}/portal/courses`,
      label: 'Courses',
      matches: (p) => p.includes('/portal/courses'),
      icon: StackIcon,
    },
    // Community only appears once an enrolled course's community is live and
    // published — mirrors the desktop TopBar gating.
    ...(showCommunity
      ? [
          {
            href: `/${slug}/portal/community`,
            label: 'Community',
            matches: (p: string) =>
              p.includes('/portal/community') ||
              /\/portal\/courses\/[^/]+\/community/.test(p),
            icon: ChatIcon,
          },
        ]
      : []),
    // Phase 4d: Downloads tab hidden from the student portal nav. Route file
    // is kept; restore this entry to bring the tab back.
    // {
    //   href: `/${slug}/portal/downloads`,
    //   label: 'Downloads',
    //   matches: (p) => p.includes('/portal/downloads'),
    //   icon: TrayIcon,
    // },
  ]
  if (canAccessBilling) {
    tabs.push({
      href: `/${slug}/portal/orders`,
      label: 'Enrollments',
      matches: (p) => p.includes('/portal/orders'),
      icon: BagIcon,
    })
    tabs.push({
      href: `/${slug}/portal/settings`,
      label: 'Billing',
      matches: (p) => p.includes('/portal/settings'),
      icon: CardIcon,
    })
  }
  return tabs
}

export const MobileTabBar = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Match TopBar's auth pattern so the tab list filters by permission.
  const token =
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token')
  const api = React.useMemo(() => createClientSideAPI(token ?? ''), [token])
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  // Pull the customer record too — same hook the desktop bar uses — so any
  // future role gating can be folded in without re-fetching.
  useAuthenticatedCustomer(api)
  const { data: communityCourses } = useCommunityEnrolledCourses(token)

  // Match the desktop TopBar: surface Community only when at least one
  // enrolled course has a live, published community.
  const showCommunity = (communityCourses ?? []).some(
    (c) => c.community_enabled,
  )

  const tabs = buildTabs(organization, authenticatedUser, showCommunity)
  const buildHref = (href: string) => {
    const qs = searchParams.toString()
    return qs ? `${href}?${qs}` : href
  }

  return (
    <nav className="sp-tabbar" aria-label="Student portal sections">
      <div className="sp-tabbar-inner">
        {tabs.map((t) => {
          const active = t.matches(pathname)
          return (
            <Link
              key={t.href}
              href={buildHref(t.href)}
              className={'sp-tabbar-item' + (active ? ' is-active' : '')}
              aria-current={active ? 'page' : undefined}
              prefetch
            >
              <span className="sp-tabbar-icon" aria-hidden>
                {t.icon(active)}
              </span>
              <span className="sp-tabbar-label">{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
