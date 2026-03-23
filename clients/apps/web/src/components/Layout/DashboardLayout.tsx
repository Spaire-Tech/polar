'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { OmniSearch } from '@/components/Search/OmniSearch'
import { useAuth } from '@/hooks/auth'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setLastVisitedOrg } from '@/utils/cookies'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { schemas } from '@spaire/client'
import {
  SidebarTrigger,
  useSidebar,
} from '@spaire/ui/components/atoms/Sidebar'
import { Tabs, TabsList, TabsTrigger } from '@spaire/ui/components/atoms/Tabs'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
  type JSX,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { DashboardProvider } from '../Dashboard/DashboardProvider'
import { SubRouteWithActive } from '../Dashboard/navigation'
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
      <div className="relative flex h-full w-full flex-col bg-white md:flex-row dark:bg-transparent">
        <MobileNav
          organization={organization}
          organizations={organizations ?? []}
          type={props.type}
        />
        <div className="hidden md:flex">
          <DashboardSidebar
            organization={organization}
            organizations={organizations ?? []}
            type={props.type}
          />
        </div>
        <div
          className={twMerge(
            'relative flex h-full w-full flex-col',
            props.className,
          )}
        >
          {/* On large devices, scroll here. On small devices the _document_ is the only element that should scroll. */}
          <main className="relative flex min-h-0 min-w-0 grow flex-col">
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()
  const { currentUser } = useAuth()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const header = (
    <div className="dark:bg-black sticky top-0 right-0 left-0 flex w-full flex-row items-center justify-between bg-white p-4">
      <a
        href="/"
        className="shrink-0 items-center font-semibold text-black dark:text-white"
      >
        <LogoIcon className="h-10 w-10" />
      </a>

      <div className="flex flex-row items-center gap-x-6">
        <TopbarRight authenticatedUser={currentUser} />
        <SidebarTrigger />
      </div>
    </div>
  )

  return (
    <div className="dark:bg-black relative z-20 flex w-screen flex-col items-center justify-between bg-white md:hidden">
      {mobileNavOpen ? (
        <div className="relative flex h-full w-full flex-col">
          {header}
          <div className="dark:bg-black flex h-full flex-col bg-white px-4">
            <DashboardSidebar
              organization={organization}
              organizations={organizations}
              type={type}
            />
          </div>
        </div>
      ) : (
        header
      )}
    </div>
  )
}

const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs value={current?.title}>
      <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link} prefetch={true}>
              <TabsTrigger
                className="flex flex-row items-center gap-x-2 px-4"
                value={item.title}
              >
                <h3>{item.title}</h3>
              </TabsTrigger>
            </Link>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

const PageTabNav = ({ tabs }: { tabs: PageTab[] }) => {
  const pathname = usePathname()

  return (
    <Tabs
      value={
        tabs.find(
          (t) =>
            pathname === t.href ||
            (t.href !== tabs[0]?.href && pathname.startsWith(t.href)),
        )?.title ?? tabs[0]?.title
      }
    >
      <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} prefetch={true}>
            <TabsTrigger
              className="flex flex-row items-center gap-x-2 px-4"
              value={tab.title}
            >
              <h3>{tab.title}</h3>
            </TabsTrigger>
          </Link>
        ))}
      </TabsList>
    </Tabs>
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
  const { currentRoute, currentSubRoute } = useRoute()
  const { organization } = useContext(OrganizationContext)

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const current = currentSubRoute ?? currentRoute

  const parsedTitle = title ?? current?.title

  return (
    <motion.div
      className={twMerge(
        'flex h-full w-full flex-row gap-x-2',
        contextViewPlacement === 'left' ? 'flex-row-reverse' : '',
      )}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="dark:md:bg-black dark:border-spaire-800 relative flex min-w-0 flex-2 flex-col items-center rounded-2xl border-gray-200 px-4 md:overflow-y-auto md:border md:bg-white md:px-8 md:shadow-xs">
        <div
          className={twMerge(
            'flex min-h-full w-full flex-col gap-8 pt-6',
            wrapperClassName,
            wide ? '' : 'max-w-(--breakpoint-xl)',
          )}
        >
          {/* Search + Notifications bar */}
          <div className="flex items-center justify-end gap-x-2">
            {organization && (
              <>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="dark:bg-spaire-900 dark:border-spaire-700 dark:hover:bg-spaire-800 flex w-56 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                >
                  <SearchOutlined
                    fontSize="small"
                    className="dark:text-spaire-500 shrink-0 text-gray-400"
                  />
                  <span className="dark:text-spaire-500 flex-1 text-left text-gray-400">
                    Search...
                  </span>
                  <kbd className="dark:border-spaire-700 dark:bg-spaire-800 dark:text-spaire-400 hidden h-5 items-center gap-0.5 rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] text-gray-500 sm:inline-flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
                <OmniSearch
                  open={searchOpen}
                  onOpenChange={setSearchOpen}
                  organization={organization}
                />
              </>
            )}
            <NotificationsPopover />
          </div>

          {(title !== null || !!header) && (
            <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between md:gap-x-4">
              {title !== null &&
                (!title || typeof parsedTitle === 'string' ? (
                  <h4 className="text-2xl font-medium whitespace-nowrap dark:text-white">
                    {title ?? current?.title}
                  </h4>
                ) : (
                  parsedTitle
                ))}

              {header ? (
                header
              ) : isCollapsed && currentRoute && 'subs' in currentRoute ? (
                <SubNav items={currentRoute.subs ?? []} />
              ) : null}
            </div>
          )}

          {tabs && tabs.length > 0 && <PageTabNav tabs={tabs} />}

          <motion.div
            className={twMerge('flex w-full flex-col pb-8', className)}
            variants={{
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { duration: 0.3 } },
              exit: { opacity: 0, transition: { duration: 0.3 } },
            }}
          >
            {children}
          </motion.div>
        </div>
      </div>
      {contextView ? (
        <motion.div
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { duration: 0.3 } },
            exit: { opacity: 0, transition: { duration: 0.3 } },
          }}
          className={twMerge(
            'dark:bg-black dark:border-spaire-800 w-full flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white md:max-w-[320px] md:shadow-xs xl:max-w-[440px]',
            contextViewClassName,
          )}
        >
          {contextView}
        </motion.div>
      ) : null}
    </motion.div>
  )
}
