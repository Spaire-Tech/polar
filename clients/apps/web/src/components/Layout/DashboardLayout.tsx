'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { useAuth } from '@/hooks/auth'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setLastVisitedOrg } from '@/utils/cookies'
import { schemas } from '@polar-sh/client'
import {
  SidebarTrigger,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
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
      <div className="relative flex h-full w-full flex-col bg-white md:flex-row md:bg-gray-75 md:p-2 dark:bg-transparent">
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
    <div className="sticky top-0 right-0 left-0 flex w-full flex-row items-center justify-between bg-white p-4 dark:bg-spaire-900">
      <a
        href="/"
        className="shrink-0 items-center font-bold text-gray-900 dark:text-white"
      >
        Spaire
      </a>

      <div className="flex flex-row items-center gap-x-6">
        <TopbarRight authenticatedUser={currentUser} />
        <SidebarTrigger />
      </div>
    </div>
  )

  return (
    <div className="relative z-20 flex w-screen flex-col items-center justify-between bg-white md:hidden dark:bg-spaire-900">
      {mobileNavOpen ? (
        <div className="relative flex h-full w-full flex-col">
          {header}
          <div className="flex h-full flex-col bg-white px-4 dark:bg-spaire-900">
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

export interface DashboardBodyProps {
  children?: React.ReactNode
  className?: string
  wrapperClassName?: string
  title?: JSX.Element | string | null
  contextView?: React.ReactNode
  contextViewClassName?: string
  contextViewPlacement?: 'left' | 'right'
  header?: JSX.Element
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
  wide = false,
}: DashboardBodyProps) => {
  const { currentRoute, currentSubRoute } = useRoute()

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'

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
      <div className="relative flex min-w-0 flex-2 flex-col items-center rounded-lg border-gray-200 px-4 md:overflow-y-auto md:border md:bg-white md:px-10 md:shadow-xs dark:md:bg-spaire-900 dark:border-spaire-800">
        <div
          className={twMerge(
            'flex h-full w-full flex-col gap-10 pt-10',
            wrapperClassName,
            wide ? '' : 'max-w-(--breakpoint-xl)',
          )}
        >
          {(title !== null || !!header) && (
            <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between md:gap-x-4">
              {title !== null &&
                (!title || typeof parsedTitle === 'string' ? (
                  <h4 className="text-xl font-semibold tracking-tight whitespace-nowrap text-gray-900 dark:text-white">
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

          <motion.div
            className={twMerge('flex w-full flex-col pb-10', className)}
            variants={{
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { duration: 0.2 } },
              exit: { opacity: 0, transition: { duration: 0.2 } },
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
            animate: { opacity: 1, transition: { duration: 0.2 } },
            exit: { opacity: 0, transition: { duration: 0.2 } },
          }}
          className={twMerge(
            'w-full flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white md:max-w-[320px] md:shadow-xs xl:max-w-[440px] dark:bg-spaire-900 dark:border-spaire-800',
            contextViewClassName,
          )}
        >
          {contextView}
        </motion.div>
      ) : null}
    </motion.div>
  )
}
