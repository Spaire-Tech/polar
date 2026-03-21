'use client'

import { useOrganizationAccount } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Tabs, TabsList, TabsTrigger } from '@spaire/ui/components/atoms/Tabs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PropsWithChildren, useContext } from 'react'

const allTabs = [
  { title: 'Overview', suffix: '/income', requiresPayouts: true },
  { title: 'Payouts', suffix: '/payouts', requiresPayouts: true },
  { title: 'Account', suffix: '/account', requiresPayouts: false },
]

export default function BalanceLayout({ children }: PropsWithChildren) {
  const { organization } = useContext(OrganizationContext)
  const pathname = usePathname()
  const base = `/dashboard/${organization.slug}/finance`

  const { data: account } = useOrganizationAccount(organization.id)
  const payoutsEnabled = account?.is_payouts_enabled ?? false

  const visibleTabs = allTabs.filter(
    (t) => !t.requiresPayouts || payoutsEnabled,
  )

  const activeTab =
    visibleTabs.find((t) => pathname.startsWith(`${base}${t.suffix}`)) ??
    visibleTabs[0]

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-6 md:px-8">
        <Tabs value={activeTab?.title ?? ''}>
          <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
            {visibleTabs.map((tab) => (
              <Link
                key={tab.suffix}
                href={`${base}${tab.suffix}`}
                prefetch={true}
              >
                <TabsTrigger
                  className="flex flex-row items-center gap-x-2 px-4"
                  value={tab.title}
                >
                  {tab.title}
                </TabsTrigger>
              </Link>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </div>
  )
}
