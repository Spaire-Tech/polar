'use client'

import { ArrowLeft } from 'lucide-react'
import { schemas } from '@polar-sh/client'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import {
  SubRouteWithActive,
  useAccountRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from '../../Dashboard/navigation'

export const OrganizationNavigation = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const generalRoutesList = useGeneralRoutes(org)
  const organizationRoutes = useOrganizationRoutes(org)

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'

  const dashboardRoutes = [...generalRoutesList, ...organizationRoutes]

  return (
    <SidebarMenu>
      {dashboardRoutes.map((route) => (
        <SidebarMenuItem key={route.link}>
          <SidebarMenuButton
            tooltip={route.title}
            asChild
            isActive={route.isActive}
          >
            <Link
              key={route.link}
              prefetch={true}
              className={twMerge(
                'flex flex-row items-center rounded-md px-2 py-1 transition-colors',
                route.isActive
                  ? 'bg-gray-100 text-gray-900 dark:bg-spaire-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-spaire-400 dark:hover:bg-spaire-800 dark:hover:text-spaire-200',
              )}
              href={route.link}
            >
              {'icon' in route && route.icon ? (
                <span
                  className={twMerge(
                    'flex items-center justify-center',
                    route.isActive
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-spaire-500',
                  )}
                >
                  {route.icon}
                </span>
              ) : undefined}
              <span className="ml-2 text-sm font-medium">{route.title}</span>
            </Link>
          </SidebarMenuButton>
          {route.isActive && route.subs && (
            <SidebarMenuSub className="my-1 gap-y-0.5">
              {route.subs.map((subRoute: SubRouteWithActive) => {
                return (
                  <SidebarMenuSubItem key={subRoute.link}>
                    <Link
                      href={subRoute.link}
                      prefetch={true}
                      className={twMerge(
                        'ml-4 inline-flex flex-row items-center gap-x-2 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-spaire-500 dark:hover:text-white',
                        subRoute.isActive && 'text-gray-900 dark:text-white',
                      )}
                    >
                      {subRoute.title}
                      {subRoute.extra}
                    </Link>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export const AccountNavigation = () => {
  const accountRoutes = useAccountRoutes()

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'

  return (
    <SidebarMenu>
      <SidebarMenuItem className="mb-4 flex flex-row items-center gap-2">
        <SidebarMenuButton tooltip="Back to Dashboard" asChild>
          <Link
            href="/dashboard"
            className="flex flex-row items-center gap-3 text-gray-900 dark:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Account Settings</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {accountRoutes.map((route) => (
        <SidebarMenuItem key={route.link}>
          <SidebarMenuButton
            tooltip={route.title}
            asChild
            isActive={route.isActive}
          >
            <Link
              key={route.link}
              prefetch={true}
              className={twMerge(
                'flex flex-row items-center rounded-md px-2 py-1 transition-colors',
                route.isActive
                  ? 'bg-gray-100 text-gray-900 dark:bg-spaire-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-spaire-400 dark:hover:bg-spaire-800 dark:hover:text-spaire-200',
              )}
              href={route.link}
            >
              {'icon' in route && route.icon ? (
                <span
                  className={twMerge(
                    'flex items-center justify-center',
                    route.isActive
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-spaire-500',
                  )}
                >
                  {route.icon}
                </span>
              ) : undefined}
              <span className="ml-2 text-sm font-medium">{route.title}</span>
            </Link>
          </SidebarMenuButton>
          {route.isActive && route.subs && (
            <SidebarMenuSub className="my-1 gap-y-0.5">
              {route.subs.map((subRoute: SubRouteWithActive) => {
                return (
                  <SidebarMenuSubItem key={subRoute.link}>
                    <Link
                      href={subRoute.link}
                      prefetch={true}
                      className={twMerge(
                        'ml-4 inline-flex flex-row items-center gap-x-2 text-[13px] font-medium text-gray-500 dark:text-spaire-500',
                        subRoute.isActive && 'text-gray-900 dark:text-white',
                      )}
                    >
                      {subRoute.title}
                      {subRoute.extra}
                    </Link>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
