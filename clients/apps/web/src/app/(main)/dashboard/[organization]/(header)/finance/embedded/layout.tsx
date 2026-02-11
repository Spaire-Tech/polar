'use client'

import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import {
  CreditCard,
  LayoutDashboard,
  Landmark,
  Banknote,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const embeddedTabs = [
  {
    title: 'Overview',
    suffix: '/overview',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    title: 'Balances',
    suffix: '/balances',
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    title: 'Cards',
    suffix: '/cards',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    title: 'Pay',
    suffix: '/pay',
    icon: <Banknote className="h-4 w-4" />,
  },
  {
    title: 'Account',
    suffix: '/account',
    icon: <Settings className="h-4 w-4" />,
  },
]

export default function EmbeddedFinanceLayout({
  children,
}: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/finance/embedded`

  const activeTab =
    embeddedTabs.find((t) => pathname.startsWith(`${base}${t.suffix}`)) ??
    embeddedTabs[0]

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-6 md:px-8">
        <Tabs value={activeTab.title}>
          <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
            {embeddedTabs.map((tab) => (
              <Link
                key={tab.suffix}
                href={`${base}${tab.suffix}`}
                prefetch={true}
              >
                <TabsTrigger
                  className="flex flex-row items-center gap-x-2 px-4"
                  value={tab.title}
                >
                  {tab.icon}
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
