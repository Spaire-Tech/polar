import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { OmniSearch } from '@/components/Search/OmniSearch'
import { useAuth } from '@/hooks'
import { CONFIG } from '@/utils/config'
import { isImpersonating } from '@/utils/impersonation'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
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
} from '@polar-sh/ui/components/atoms/Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import {
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Search,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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

  // Annoying useEffect hack to allow access to client-side cookies from Server-Side component
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
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={twMerge(
          'flex md:pt-3.5',
          isTopBannerVisible ? 'md:pt-10' : '',
          isCollapsed
            ? 'flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start'
            : 'flex-row items-center justify-between',
        )}
      >
        <Link
          href={organization ? `/dashboard/${organization.slug}` : '/dashboard'}
          className="flex items-center"
        >
          {isCollapsed ? (
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              S
            </span>
          ) : (
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              Spaire
            </span>
          )}
        </Link>
        <motion.div
          key={isCollapsed ? 'header-collapsed' : 'header-expanded'}
          className={`flex ${isCollapsed ? 'flex-row md:flex-col-reverse' : 'flex-row'} items-center gap-2`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <NotificationsPopover />
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 py-4">
        {type === 'organization' && organization && (
          <>
            <button
              onClick={() => setSearchOpen(true)}
              className={twMerge(
                'flex cursor-pointer items-center gap-3 rounded-md border px-2.5 py-2 text-sm transition-colors',
                'border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-spaire-700 dark:bg-spaire-900 dark:hover:bg-spaire-800',
                isCollapsed && 'justify-center px-2',
              )}
            >
              <Search className="h-3.5 w-3.5 text-gray-400 dark:text-spaire-500" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-gray-500 dark:text-spaire-500">
                    Search...
                  </span>
                  <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-gray-200 bg-white px-1.5 font-mono text-[11px] text-gray-500 select-none dark:border-spaire-700 dark:bg-spaire-800 dark:text-spaire-400">
                    <span className="text-xs">&#8984;</span>K
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
        <motion.div
          key={isCollapsed ? 'nav-collapsed' : 'nav-expanded'}
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {type === 'account' && <AccountNavigation />}
          {type === 'organization' && organization && (
            <OrganizationNavigation organization={organization} />
          )}
        </motion.div>
      </SidebarContent>
      <SidebarFooter>
        <Link
          href="mailto:support@spairehq.com"
          className={twMerge(
            'mt-2 flex cursor-pointer flex-row items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors',
            'text-gray-500 hover:text-gray-900 dark:text-spaire-500 dark:hover:text-spaire-200',
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {!isCollapsed && <span className="font-medium">Support</span>}
        </Link>
        <Link
          className={twMerge(
            'flex flex-row items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors',
            'text-gray-500 hover:text-gray-900 dark:text-spaire-500 dark:hover:text-spaire-200',
          )}
          href="https://docs.spairehq.com"
          target="_blank"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {!isCollapsed && <span className="font-medium">Documentation</span>}
        </Link>
        <Separator />
        {type === 'organization' && organization && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <Avatar
                      name={organization.name}
                      avatar_url={organization.avatar_url}
                      className="h-6 w-6"
                    />
                    {!isCollapsed && (
                      <>
                        <span className="min-w-0 truncate text-sm">
                          {organization.name}
                        </span>
                        <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />
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
                      className="flex flex-row items-center gap-x-2"
                      onClick={() => navigateToOrganization(org)}
                    >
                      <Avatar
                        name={org.name}
                        avatar_url={org.avatar_url}
                        className="h-6 w-6"
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
