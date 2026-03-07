'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { useAuth } from '@/hooks/auth'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setLastVisitedOrg } from '@/utils/cookies'
import { schemas } from '@spaire/client'
import {
  SidebarTrigger,
  useSidebar,
} from '@spaire/ui/components/atoms/Sidebar'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  useContext,
  useEffect,
  type JSX,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { DashboardProvider } from '../Dashboard/DashboardProvider'
import { useRoute } from '../Navigation/useRoute'
import { DashboardSidebar } from './Dashboard/DashboardSidebar'
import TopbarRight from './Public/TopbarRight'

const DashboardLayout = (
  props: PropsWithChildren<{
    type?: 'organization' | 'account'
    className?: string
  }>,
) => {
  const { organization, organizations } = useContext(OrganizationContext)

  useEffect(() => {
    if (organization) {
      setLastVisitedOrg(organization.slug)
    }
  }, [organization])

  return (
    <DashboardProvider organization={organization}>
      {/* Full-bleed dark canvas — no floating card, no gray gutter */}
      <div className="relative flex h-full w-full flex-col dark:bg-spaire-950 md:flex-row">
        {/* Mobile top bar */}
        <MobileNav
          organization={organization}
          organizations={organizations ?? []}
          type={props.type}
        />
        {/* Desktop sidebar — flush, full-height, no gap */}
        <div className="hidden md:flex">
          <DashboardSidebar
            organization={organization}
            organizations={organizations ?? []}
            type={props.type}
          />
        </div>
        {/* Content column — fills remaining width */}
        <div
          className={twMerge(
            'relative flex h-full min-w-0 flex-1 flex-col',
            props.className,
          )}
        >
          <main className="relative flex min-h-0 min-w-0 grow flex-col overflow-hidden">
            {props.children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  )
}

export default DashboardLayout

const MobileNav = ({
  type = 'organization',
  organization,
  organizations,
}: {
  type?: 'organization' | 'account'
  organization?: schemas['Organization']
  organizations: schemas['Organization'][]
}) => {
  const pathname = usePathname()
  const { currentUser } = useAuth()

  // Close mobile nav on navigation
  useEffect(() => {}, [pathname])

  return (
    <div className="dark:bg-spaire-950 dark:border-spaire-800 sticky top-0 z-20 flex w-screen items-center justify-between border-b px-4 py-3 md:hidden">
      <Link href="/" className="shrink-0">
        <LogoIcon className="h-8 w-8" />
      </Link>
      <div className="flex items-center gap-x-4">
        <TopbarRight authenticatedUser={currentUser} />
        <SidebarTrigger />
      </div>
    </div>
  )
}

export interface PageTab {
  title: string
  href: string
}

export interface DashboardBodyProps {
  children?: React.ReactNode
  className?: string
  wrapperClassName?: string
  title?: JSX.Element | string | null
  contextView?: React.ReactNode
  contextViewClassName?: string
  contextViewPlacement?: 'left' | 'right'
  header?: JSX.Element
  tabs?: PageTab[]
  wide?: boolean
}

/**
 * DashboardBody — the Stripe-style page content wrapper.
 *
 * Visual model:
 *   - No outer card / no rounded-2xl border frame (that was Polar's signature look)
 *   - Sticky page header bar contains the title + optional action header
 *   - Horizontal underline tabs live directly below the header (always visible)
 *   - Scrollable content area below that
 *   - Optional context panel on right (kept for backward compat)
 */
export const DashboardBody = ({
  children,
  className,
  wrapperClassName,
  title,
  contextView,
  contextViewClassName,
  contextViewPlacement = 'right',
  header,
  tabs,
  wide = false,
}: DashboardBodyProps) => {
  const { currentRoute } = useRoute()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const parsedTitle = title ?? currentRoute?.title

  return (
    <div
      className={twMerge(
        'flex h-full w-full flex-row',
        contextViewPlacement === 'left' ? 'flex-row-reverse' : '',
      )}
    >
      {/* ── Main content column ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sticky page header — title + actions */}
        {(title !== null || !!header) && (
          <div className="dark:bg-spaire-950 dark:border-spaire-800 sticky top-0 z-10 flex min-h-[56px] shrink-0 items-center border-b border-gray-200 px-6 md:px-8">
            <div className="flex flex-1 items-center gap-3">
              {title !== null &&
                (!title || typeof parsedTitle === 'string' ? (
                  <h1 className="text-base font-semibold whitespace-nowrap text-gray-900 dark:text-white">
                    {parsedTitle}
                  </h1>
                ) : (
                  parsedTitle
                ))}
            </div>
            {header && (
              <div className="flex items-center gap-2">{header}</div>
            )}
          </div>
        )}

        {/* Horizontal underline tab nav — always visible when tabs present */}
        {tabs && tabs.length > 0 && (
          <PageTabNav tabs={tabs} />
        )}

        {/* Scrollable page body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div
            className={twMerge(
              'flex w-full flex-col gap-8 px-6 pt-8 pb-16 md:px-8',
              wrapperClassName,
              wide ? '' : 'max-w-(--breakpoint-xl)',
            )}
          >
            <div className={twMerge('flex w-full flex-col', className)}>
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* ── Optional context panel (right/left) ── */}
      {contextView && (
        <div
          className={twMerge(
            'dark:bg-spaire-900 dark:border-spaire-800 hidden w-full max-w-[320px] shrink-0 flex-col overflow-y-auto border-l border-gray-200 xl:flex xl:max-w-[400px]',
            contextViewClassName,
          )}
        >
          {contextView}
        </div>
      )}
    </div>
  )
}

const PageTabNav = ({ tabs }: { tabs: PageTab[] }) => {
  const pathname = usePathname()
  const activeTab = tabs.find(
    (t) =>
      pathname === t.href ||
      (t.href !== tabs[0]?.href && pathname.startsWith(t.href)),
  ) ?? tabs[0]

  return (
    <nav className="dark:border-spaire-800 flex shrink-0 border-b border-gray-200 px-6 md:px-8">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch={true}
          className={twMerge(
            'flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors',
            tab.title === activeTab?.title
              ? 'border-blue-500 text-gray-900 dark:text-white'
              : 'dark:text-spaire-400 dark:hover:text-spaire-100 border-transparent text-gray-500 hover:text-gray-900',
          )}
        >
          {tab.title}
        </Link>
      ))}
    </nav>
  )
}
