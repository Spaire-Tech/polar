'use client'

import {
  useAuthenticatedCustomer,
  usePortalAuthenticatedUser,
} from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import * as React from 'react'
import { BellIcon, BookmarkIcon, SearchIcon } from './icons'

type Tab = {
  href: string
  label: string
  matches: (path: string) => boolean
}

const buildTabs = (
  organization: schemas['CustomerOrganization'],
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined,
  customer: schemas['CustomerPortalCustomer'] | undefined,
): Tab[] => {
  const slug = organization.slug
  const canAccessBilling = hasBillingPermission(authenticatedUser)
  const isTeamCustomer = customer?.type === 'team'
  const showTeam =
    isTeamCustomer &&
    canAccessBilling &&
    organization.organization_features?.member_model_enabled

  const tabs: Tab[] = [
    {
      href: `/${slug}/portal/overview`,
      label: 'Overview',
      matches: (p) => p.includes('/portal/overview'),
    },
    {
      href: `/${slug}/portal/courses`,
      label: 'Courses',
      matches: (p) => p.includes('/portal/courses'),
    },
    {
      href: `/${slug}/portal/community`,
      label: 'Community',
      matches: (p) =>
        p.includes('/portal/community') ||
        /\/portal\/courses\/[^/]+\/community/.test(p),
    },
    {
      href: `/${slug}/portal/downloads`,
      label: 'Downloads',
      matches: (p) => p.includes('/portal/downloads'),
    },
  ]
  if (canAccessBilling) {
    tabs.push({
      href: `/${slug}/portal/orders`,
      label: 'Orders',
      matches: (p) => p.includes('/portal/orders'),
    })
  }
  if (showTeam) {
    tabs.push({
      href: `/${slug}/portal/team`,
      label: 'Team',
      matches: (p) => p.includes('/portal/team'),
    })
  }
  if (canAccessBilling) {
    tabs.push({
      href: `/${slug}/portal/settings`,
      label: 'Billing',
      matches: (p) => p.includes('/portal/settings'),
    })
  }
  return tabs
}

const initialsFor = (name: string | null | undefined, email: string) => {
  const source = (name && name.trim()) || email
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const orgInitial = (name: string) => {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '·'
}

export const TopBar = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const token =
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token')

  // Always call hooks at the top level (rules of hooks). When there is no
  // token the API instance still gets built, but the underlying queries will
  // fail silently and the right-side actions render with empty defaults.
  const api = React.useMemo(() => createClientSideAPI(token ?? ''), [token])
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const { data: customer } = useAuthenticatedCustomer(api)

  const buildHref = (href: string) => {
    if (!searchParams.toString()) return href
    return `${href}?${searchParams.toString()}`
  }

  const tabs = buildTabs(organization, authenticatedUser, customer)
  const overviewHref = buildHref(`/${organization.slug}/portal/overview`)

  return (
    <header className="sp-topbar">
      <div className="sp-topbar-inner">
        <Link
          href={overviewHref}
          className="sp-brand"
          aria-label={organization.name}
        >
          <span className="sp-brand-mark" aria-hidden>
            {organization.avatar_url ? (
              <img src={organization.avatar_url} alt="" />
            ) : (
              orgInitial(organization.name)
            )}
          </span>
          <span>{organization.name}</span>
        </Link>
        <nav className="sp-tabs" aria-label="Customer portal sections">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={buildHref(t.href)}
              className={'sp-tab' + (t.matches(pathname) ? ' is-active' : '')}
              prefetch
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="sp-right">
          <label className="sp-search">
            <SearchIcon size={15} />
            <input
              type="search"
              placeholder="Search courses, orders…"
              aria-label="Search"
            />
          </label>
          {/* Mobile-only — the desktop label above turns into a compact
              icon button on narrow viewports (where the long search
              input would crowd the brand + tab row). */}
          <button
            type="button"
            className="sp-iconbtn sp-iconbtn--mobile"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon size={18} />
          </button>
          <button
            type="button"
            className="sp-iconbtn"
            aria-label="Notifications"
            title="Notifications"
          >
            <BellIcon />
            <span className="sp-dot" aria-hidden />
          </button>
          <Link
            href={buildHref(`/${organization.slug}/portal/bookmarks`)}
            className={
              'sp-iconbtn' +
              (pathname.includes('/portal/bookmarks') ? ' is-active' : '')
            }
            aria-label="Bookmarks"
            title="Bookmarks"
          >
            <BookmarkIcon />
          </Link>
          <AccountAvatar
            authenticatedUser={authenticatedUser}
            customer={customer}
            organization={organization}
          />
        </div>
      </div>
    </header>
  )
}

// Top-right account chip. Renders an <img> when a real avatar exists —
// preview customers (the editor's "act as a student" flow) borrow the
// org's logo so the chip reads as the admin themselves, not as an
// initial-only blank. Real customers still fall back to initials.
function AccountAvatar({
  authenticatedUser,
  customer,
  organization,
}: {
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined
  customer: schemas['CustomerPortalCustomer'] | undefined
  organization: schemas['CustomerOrganization']
}) {
  const isPreviewCustomer = !!(
    customer?.email &&
    customer.email.endsWith('@course-preview.invalid')
  )
  const avatarUrl = isPreviewCustomer ? organization.avatar_url : null
  const displayName =
    customer?.name ??
    authenticatedUser?.name ??
    authenticatedUser?.email ??
    ''
  const title = displayName || organization.name

  if (avatarUrl) {
    return (
      <div
        className="sp-avatar sp-avatar--image"
        title={title}
        aria-label="Account"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" />
      </div>
    )
  }

  return (
    <div className="sp-avatar" title={title} aria-label="Account">
      {authenticatedUser
        ? initialsFor(
            customer?.name ?? authenticatedUser.name,
            authenticatedUser.email,
          )
        : '·'}
    </div>
  )
}
