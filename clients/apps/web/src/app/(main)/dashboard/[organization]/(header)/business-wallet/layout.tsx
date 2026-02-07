'use client'

import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const walletTabs = [
  { title: 'Overview', suffix: '/overview' },
  { title: 'Cards', suffix: '/cards' },
  { title: 'Transactions', suffix: '/transactions' },
]

export default function BusinessWalletLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/business-wallet`

  const isOnboarding = pathname.includes('/onboarding')

  const activeTab =
    walletTabs.find((t) => pathname.startsWith(`${base}${t.suffix}`)) ??
    walletTabs[0]

  return (
    <div className="flex h-full flex-col">
      {!isOnboarding && (
        <div className="px-4 pt-6 md:px-8">
          <Tabs value={activeTab.title}>
            <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
              {walletTabs.map((tab) => (
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
      )}
      {children}
    </div>
  )
}
