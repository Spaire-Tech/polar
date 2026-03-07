'use client'

import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { OmniSearch } from '@/components/Search/OmniSearch'
import { useAuth } from '@/hooks'
import { CONFIG } from '@/utils/config'
import { isImpersonating } from '@/utils/impersonation'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@spaire/ui/components/atoms/Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@spaire/ui/components/ui/dropdown-menu'
import { Separator } from '@spaire/ui/components/ui/separator'
import {
  ArrowUpRight,
  ChevronDown,
  HelpCircle,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { SpaireLogotype } from '../Public/SpaireLogotype'
import {
  AccountNavigation,
  OrganizationNavigation,
} from './DashboardNavigation'

export const DashboardSidebar = ({
  type = 'organization',
  organization,
  organizations,
}: {
  type?: 'organization' | 'account'
  organization?: schemas['Organization']
  organizations: schemas['Organization'][]
}) => {
  const router = useRouter()
  const { state } = useSidebar()
  const { currentUser } = useAuth()

  const isCollapsed = state === 'collapsed'
  const [searchOpen, setSearchOpen] = useState(false)

  const navigateToOrganization = (org: schemas['Organization']) => {
    router.push(`/dashboard/${org.slug}`)
  }

  const [_isImpersonating, setIsImpersonating] = useState(false)
  useEffect(() => {
    setIsImpersonating(isImpersonating())
  }, [])
  const isTopBannerVisible = CONFIG.IS_SANDBOX || _isImpersonating

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

  return (
    /*
     * variant="sidebar" keeps the sidebar flush with the viewport edge —
     * no rounded corners, no floating shadow. This is the core visual
     * difference from the old "inset" variant which created the Polar look.
     */
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader
        className={twMerge(
          'flex border-b dark:border-spaire-800 border-gray-200',
          isTopBannerVisible ? 'md:pt-10' : 'md:pt-3.5',
          isCollapsed
            ? 'flex-col items-center gap-y-3 pb-3'
            : 'flex-row items-center justify-between pb-3',
        )}
      >
        <SpaireLogotype
          size={28}
          href={organization ? `/dashboard/${organization.slug}` : '/dashboard'}
        />
        <div className="flex items-center gap-1">
          <NotificationsPopover />
          <SidebarTrigger className="dark:text-spaire-500 dark:hover:text-spaire-100 text-gray-400 hover:text-gray-700" />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-2 py-3">
        {/* Search bar */}
        {type === 'organization' && organization && (
          <>
            <button
              onClick={() => setSearchOpen(true)}
              className={twMerge(
                'dark:bg-spaire-950 dark:border-spaire-800 dark:hover:bg-spaire-900 dark:text-spaire-500 flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100',
                isCollapsed && 'justify-center',
              )}
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-xs">Search...</span>
                  <kbd className="dark:border-spaire-700 dark:bg-spaire-800 dark:text-spaire-400 pointer-events-none inline-flex h-4 items-center gap-0.5 rounded border border-gray-200 bg-gray-100 px-1 font-mono text-[10px] text-gray-500 select-none">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </>
              )}
            </button>
            <OmniSearch
              open={searchOpen}
              onOpenChange={setSearchOpen}
              organization={organization}
            />
          </>
        )}

        {/* Navigation */}
        {type === 'account' && <AccountNavigation />}
        {type === 'organization' && organization && (
          <OrganizationNavigation organization={organization} />
        )}
      </SidebarContent>

      <SidebarFooter className="dark:border-spaire-800 border-t border-gray-200 py-3">
        {/* Support + Docs links */}
        <div className={twMerge('flex flex-col gap-0.5', isCollapsed && 'items-center')}>
          <Link
            href="mailto:support@spairehq.com"
            className={twMerge(
              'dark:text-spaire-500 dark:hover:text-spaire-200 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900',
            )}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            {!isCollapsed && <span className="font-medium">Support</span>}
          </Link>
          <Link
            href="https://docs.spairehq.com"
            target="_blank"
            className={twMerge(
              'dark:text-spaire-500 dark:hover:text-spaire-200 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900',
            )}
          >
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            {!isCollapsed && <span className="font-medium">Documentation</span>}
          </Link>
        </div>

        <Separator className="dark:bg-spaire-800 my-1" />

        {/* Org switcher */}
        {type === 'organization' && organization && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    className="dark:hover:bg-spaire-800 hover:bg-gray-100"
                    tooltip={organization.name}
                  >
                    <Avatar
                      name={organization.name}
                      avatar_url={organization.avatar_url}
                      className="h-5 w-5 shrink-0"
                    />
                    {!isCollapsed && (
                      <>
                        <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                          {organization.name}
                        </span>
                        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-spaire-500" />
                      </>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align={isCollapsed ? 'start' : 'center'}
                  className="w-(--radix-popper-anchor-width) min-w-[200px]"
                >
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      className="flex items-center gap-2"
                      onClick={() => navigateToOrganization(org)}
                    >
                      <Avatar
                        name={org.name}
                        avatar_url={org.avatar_url}
                        className="h-5 w-5"
                      />
                      <span className="min-w-0 truncate">{org.name}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      router.push('/dashboard/create?existing_org=true')
                    }
                  >
                    New Organization
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push('/dashboard/account')}
                  >
                    Account Settings
                  </DropdownMenuItem>
                  {!CONFIG.IS_SANDBOX && (
                    <DropdownMenuItem
                      onClick={() =>
                        router.push('https://sandbox.spairehq.com/start')
                      }
                    >
                      Go to Sandbox
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`${CONFIG.BASE_URL}/v1/auth/logout`)
                    }
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
