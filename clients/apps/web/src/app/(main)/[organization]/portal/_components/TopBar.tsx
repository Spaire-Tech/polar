'use client'

import {
  useAuthenticatedCustomer,
  usePortalAuthenticatedUser,
} from '@/hooks/queries'
import {
  type CustomerNotificationRead,
  useCustomerNotificationUnreadCount,
  useCustomerNotifications,
  useMarkAllCustomerNotificationsRead,
  useMarkCustomerNotificationRead,
} from '@/hooks/queries/community'
import { useCustomerSSE } from '@/hooks/sse'
import { createClientSideAPI } from '@/utils/client'
import { hasBillingPermission } from '@/utils/customerPortal'
import { schemas } from '@spaire/client'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'
import { BellIcon, BookmarkIcon, SearchIcon } from './icons'
import { usePortalTheme } from '../usePortalTheme'
import {
  type CustomerWithProfile,
  OnboardingModal,
  SettingsModal,
} from './ProfileOnboarding'

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
      // Don't light up Courses while inside a course's community sub-route —
      // that path belongs to the Community tab (matched below).
      matches: (p) =>
        p.includes('/portal/courses') && !/\/portal\/courses\/[^/]+\/community/.test(p),
    },
    {
      href: `/${slug}/portal/community`,
      label: 'Community',
      matches: (p) =>
        p.includes('/portal/community') ||
        /\/portal\/courses\/[^/]+\/community/.test(p),
    },
    // Phase 4d: Downloads tab hidden from the student portal nav. Route file
    // is kept; restore this entry to bring the tab back.
    // {
    //   href: `/${slug}/portal/downloads`,
    //   label: 'Downloads',
    //   matches: (p) => p.includes('/portal/downloads'),
    // },
  ]
  if (canAccessBilling) {
    tabs.push({
      href: `/${slug}/portal/orders`,
      label: 'Enrollments',
      matches: (p) => p.includes('/portal/orders'),
    })
  }
  // Phase 4d: Team tab hidden from the student portal nav. Route file is kept;
  // flip SHOW_TEAM_TAB back to true to restore the tab (it then falls back to
  // the original `showTeam` permission gate).
  const SHOW_TEAM_TAB = false
  if (SHOW_TEAM_TAB && showTeam) {
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
        <nav className="sp-tabs" aria-label="Student portal sections">
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
          <ThemeToggle slug={organization.slug} token={token ?? ''} />
          <NotificationsBell token={token} />
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
            token={token}
          />
        </div>
      </div>
    </header>
  )
}

// Dark / light toggle — the customer's choice overrides the course's
// landing theme and is remembered per org (usePortalTheme).
function ThemeToggle({ slug, token }: { slug: string; token: string }) {
  const { dark, toggle } = usePortalTheme(slug, token)
  return (
    <button
      type="button"
      className="sp-iconbtn"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  )
}

// Top-right account chip. Acts as a button that opens a dropdown with
// Settings + Log out. Also gatekeeps the first-sign-in onboarding
// modal — when the customer hasn't picked a display name yet, we
// pop the modal automatically (per session).
function AccountAvatar({
  authenticatedUser,
  customer,
  organization,
  token,
}: {
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined
  customer: schemas['CustomerPortalCustomer'] | undefined
  organization: schemas['CustomerOrganization']
  token: string | null
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [onboardingOpen, setOnboardingOpen] = React.useState(false)
  const onboardingShownRef = React.useRef(false)

  // Cast the customer to include `avatar_url` — the field is server-side
  // already but `pnpm generate` hasn't republished the OpenAPI schema
  // yet, so the typed shape doesn't carry it.
  const customerProfile = customer as
    | (typeof customer & CustomerWithProfile)
    | undefined

  const isPreviewCustomer = !!(
    customer?.email && customer.email.endsWith('@course-preview.invalid')
  )

  // First-sign-in trigger. Real customers without a name picked land
  // on the onboarding modal once per portal session. Preview
  // customers skip it — they're really the admin and we already
  // surface their identity from the course's instructor_name.
  React.useEffect(() => {
    if (!customer || isPreviewCustomer) return
    if (onboardingShownRef.current) return
    if (typeof window === 'undefined') return
    const key = `portal_onboarding_dismissed_${customer.id ?? 'self'}`
    if (sessionStorage.getItem(key) === '1') return
    if (!customer.name || customer.name.trim().length === 0) {
      setOnboardingOpen(true)
      onboardingShownRef.current = true
    }
  }, [customer, isPreviewCustomer])

  // Resolved avatar — customer's own → preview-customer org logo
  // fallback. Initials otherwise.
  const customerAvatar = customerProfile?.avatar_url ?? null
  const avatarUrl =
    customerAvatar ?? (isPreviewCustomer ? organization.avatar_url : null)

  const displayName =
    customer?.name ?? authenticatedUser?.name ?? authenticatedUser?.email ?? ''
  const title = displayName || organization.name

  const closeMenuOnAction = (run: () => void) => {
    setMenuOpen(false)
    run()
  }

  const onLogOut = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(
          `portal_onboarding_dismissed_${customer?.id ?? 'self'}`,
        )
      } catch {
        // ignore
      }
    }
    router.push(`/${organization.slug}/portal/request`)
  }

  const onDismissOnboarding = () => {
    if (typeof window !== 'undefined' && customer) {
      try {
        sessionStorage.setItem(
          `portal_onboarding_dismissed_${customer.id ?? 'self'}`,
          '1',
        )
      } catch {
        // ignore
      }
    }
    setOnboardingOpen(false)
  }

  return (
    <>
      <div className="sp-account">
        <button
          type="button"
          className={
            'sp-avatar' +
            (avatarUrl ? ' sp-avatar--image' : '') +
            ' sp-avatar--btn'
          }
          title={title}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : authenticatedUser ? (
            initialsFor(
              customer?.name ?? authenticatedUser.name,
              authenticatedUser.email,
            )
          ) : (
            '·'
          )}
        </button>
        {menuOpen && (
          <div
            className="sp-account-menu"
            role="menu"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <div className="sp-account-menu-head">
              <div className="sp-account-menu-name">
                {displayName || 'Member'}
              </div>
              {customer?.email && !isPreviewCustomer && (
                <div className="sp-account-menu-email">{customer.email}</div>
              )}
            </div>
            <button
              type="button"
              role="menuitem"
              className="sp-account-menu-item"
              onClick={() => closeMenuOnAction(() => setSettingsOpen(true))}
            >
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              className="sp-account-menu-item sp-account-menu-item--danger"
              onClick={() => closeMenuOnAction(onLogOut)}
            >
              Log out
            </button>
          </div>
        )}
      </div>

      {customerProfile && (
        <OnboardingModal
          customer={customerProfile}
          token={token}
          open={onboardingOpen}
          onClose={onDismissOnboarding}
        />
      )}
      {customerProfile && (
        <SettingsModal
          customer={customerProfile}
          token={token}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Notifications bell — dropdown over the existing bell icon. Only the
// red dot is conditional; the icon button stays put when there's no
// token (preview/anonymous viewer) but the dropdown is then disabled.
// ---------------------------------------------------------------------

function NotificationsBell({ token }: { token: string | null }) {
  const [open, setOpen] = React.useState(false)
  const unreadQ = useCustomerNotificationUnreadCount(token)
  const listQ = useCustomerNotifications(open ? token : null)
  const markRead = useMarkCustomerNotificationRead(token)
  const markAllRead = useMarkAllCustomerNotificationsRead(token)

  // Live updates: subscribe to the customer SSE channel and invalidate
  // the unread count + list the moment the server publishes a new
  // notification. The 60s polling fallback in the query stays as a
  // safety net for dropped SSE connections.
  const queryClient = useQueryClient()
  const sse = useCustomerSSE(token ?? undefined)
  React.useEffect(() => {
    if (!token) return
    const onCreated = () => {
      queryClient.invalidateQueries({
        queryKey: ['customer-notifications-unread', token],
      })
      queryClient.invalidateQueries({
        queryKey: ['customer-notifications', token],
      })
    }
    sse.on('customer_notification.created', onCreated)
    return () => {
      sse.off('customer_notification.created', onCreated)
    }
  }, [sse, token, queryClient])

  const unread = unreadQ.data?.unread ?? 0
  const list = listQ.data ?? []

  return (
    <div className="sp-account" style={{ position: 'relative' }}>
      <button
        type="button"
        className="sp-iconbtn"
        aria-label="Notifications"
        title="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={!token}
      >
        <BellIcon />
        {unread > 0 && <span className="sp-dot" aria-hidden />}
      </button>
      {open && (
        <div
          className="sp-account-menu"
          role="menu"
          style={{ width: 360, maxHeight: 480, overflow: 'auto' }}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            className="sp-account-menu-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="sp-account-menu-name">Notifications</div>
            {unread > 0 && (
              <button
                type="button"
                className="sp-account-menu-item"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => markAllRead.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>
          {listQ.isLoading ? (
            <div
              style={{
                padding: 16,
                color: 'var(--c-muted, #6b7280)',
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          ) : list.length === 0 ? (
            <div
              style={{
                padding: 16,
                color: 'var(--c-muted, #6b7280)',
                fontSize: 13,
              }}
            >
              You&apos;re all caught up.
            </div>
          ) : (
            list.map((n) => (
              <NotificationRow
                key={n.id}
                notif={n}
                onMarkRead={() => markRead.mutate(n.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  notif,
  onMarkRead,
}: {
  notif: CustomerNotificationRead
  onMarkRead: () => void
}) {
  const title = String(
    (notif.payload as Record<string, unknown>).title ?? 'Community update',
  )
  const courseName = String(
    (notif.payload as Record<string, unknown>).course_name ?? '',
  )
  const subtitle = typeForCopy(notif.type, courseName)
  const unread = notif.read_at === null
  return (
    <button
      type="button"
      role="menuitem"
      className="sp-account-menu-item"
      onClick={onMarkRead}
      style={{
        display: 'block',
        textAlign: 'left',
        width: '100%',
        padding: '10px 12px',
        background: unread ? 'var(--c-panel-hover, #f9fafb)' : 'transparent',
      }}
    >
      <div style={{ fontWeight: unread ? 600 : 400, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-muted, #6b7280)' }}>
        {subtitle}
      </div>
    </button>
  )
}

function typeForCopy(t: string, course: string) {
  switch (t) {
    case 'community.event.published':
      return course ? `New event in ${course}` : 'New event scheduled'
    case 'community.event.starting_soon_24h':
      return 'Starts tomorrow'
    case 'community.event.starting_soon_15m':
      return 'Starts in 15 minutes'
    case 'community.event.live':
      return 'Live now'
    case 'community.event.replay_nag_t2h':
    case 'community.event.replay_nag_t24h':
      return 'Add a replay?'
    default:
      return ''
  }
}
