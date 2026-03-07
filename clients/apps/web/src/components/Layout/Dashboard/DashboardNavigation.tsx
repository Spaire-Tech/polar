'use client'

import { schemas } from '@spaire/client'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from '@spaire/ui/components/atoms/Sidebar'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import {
  RouteGroup,
  RouteWithActive,
  SubRouteWithActive,
  useAccountRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from '../../Dashboard/navigation'

// ── Section group metadata ───────────────────────────────────────────────────

const GROUP_LABELS: Record<RouteGroup, string> = {
  core: '',
  monetization: 'Monetization',
  customers: 'Customers',
  reporting: 'Reporting',
  'founder-tools': 'Founder Tools',
  platform: 'Platform',
}

// ── Shared nav item renderer ─────────────────────────────────────────────────

const NavItem = ({
  route,
  isCollapsed,
}: {
  route: RouteWithActive
  isCollapsed: boolean
}) => (
  <SidebarMenuItem key={route.link}>
    <SidebarMenuButton tooltip={route.title} asChild isActive={route.isActive}>
      <Link
        href={route.link}
        prefetch={true}
        className={twMerge(
          // Base: full-width flex row, no background
          'relative flex flex-row items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          // Left border accent replaces background-fill active pill
          route.isActive
            ? 'before:bg-blue-500 text-gray-900 before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r before:content-[""] dark:text-white'
            : 'dark:text-spaire-500 dark:hover:text-spaire-100 text-gray-500 hover:text-gray-900',
        )}
      >
        {'icon' in route && route.icon ? (
          <span
            className={twMerge(
              'flex h-4 w-4 shrink-0 items-center justify-center text-[14px]',
              route.isActive
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 dark:text-inherit',
            )}
          >
            {route.icon}
          </span>
        ) : null}
        {!isCollapsed && (
          <span className="font-medium">{route.title}</span>
        )}
      </Link>
    </SidebarMenuButton>

    {/* Sub-routes — shown inline when route is active */}
    {route.isActive && route.subs && route.subs.length > 0 && (
      <SidebarMenuSub className="my-1 gap-y-0.5">
        {route.subs.map((subRoute: SubRouteWithActive) => (
          <SidebarMenuSubItem key={subRoute.link}>
            <Link
              href={subRoute.link}
              prefetch={true}
              className={twMerge(
                'ml-5 flex items-center gap-2 py-1 text-sm transition-colors',
                subRoute.isActive
                  ? 'font-medium text-blue-500 dark:text-white'
                  : 'dark:text-spaire-500 dark:hover:text-spaire-100 text-gray-400 hover:text-gray-900',
              )}
            >
              {subRoute.title}
              {subRoute.extra}
            </Link>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    )}
  </SidebarMenuItem>
)

// ── Group label divider ───────────────────────────────────────────────────────

const GroupLabel = ({
  label,
  isCollapsed,
}: {
  label: string
  isCollapsed: boolean
}) => {
  if (!label) return null
  if (isCollapsed) {
    return (
      <div className="dark:bg-spaire-700 mx-2 my-2 h-px bg-gray-200" />
    )
  }
  return (
    <div className="dark:text-spaire-600 mt-4 mb-1 px-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
      {label}
    </div>
  )
}

// ── Organization navigation ──────────────────────────────────────────────────

export const OrganizationNavigation = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const generalRoutes = useGeneralRoutes(org)
  const orgRoutes = useOrganizationRoutes(org)
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const allRoutes = [...generalRoutes, ...orgRoutes]

  // Build grouped sections in the prescribed order
  const groupOrder: RouteGroup[] = [
    'core',
    'monetization',
    'customers',
    'reporting',
    'founder-tools',
    'platform',
  ]

  const routesByGroup = groupOrder.reduce<Record<RouteGroup, RouteWithActive[]>>(
    (acc, g) => {
      acc[g] = allRoutes.filter((r) => r.group === g)
      return acc
    },
    {} as Record<RouteGroup, RouteWithActive[]>,
  )

  // Routes without a group go at top (backward compat)
  const ungrouped = allRoutes.filter((r) => !r.group)

  return (
    <SidebarMenu className="gap-y-0">
      {/* Ungrouped (core/overview) */}
      {ungrouped.map((route) => (
        <NavItem key={route.link} route={route} isCollapsed={isCollapsed} />
      ))}

      {/* Grouped sections */}
      {groupOrder.map((group) => {
        const routes = routesByGroup[group]
        if (!routes || routes.length === 0) return null
        return (
          <div key={group} className="flex flex-col">
            <GroupLabel
              label={GROUP_LABELS[group]}
              isCollapsed={isCollapsed}
            />
            {routes.map((route) => (
              <NavItem
                key={route.link}
                route={route}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )
      })}
    </SidebarMenu>
  )
}

// ── Account navigation ────────────────────────────────────────────────────────

export const AccountNavigation = () => {
  const accountRoutes = useAccountRoutes()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  return (
    <SidebarMenu className="gap-y-0">
      {/* Back to dashboard */}
      <SidebarMenuItem className="mb-3">
        <SidebarMenuButton tooltip="Back to Dashboard" asChild>
          <Link
            href="/dashboard"
            className="dark:text-spaire-500 dark:hover:text-spaire-100 flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!isCollapsed && (
              <span className="font-medium">Account Settings</span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {accountRoutes.map((route) => (
        <NavItem key={route.link} route={route} isCollapsed={isCollapsed} />
      ))}
    </SidebarMenu>
  )
}
