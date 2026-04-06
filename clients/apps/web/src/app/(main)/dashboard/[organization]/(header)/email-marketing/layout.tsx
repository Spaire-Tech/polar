'use client'

import { Tabs, TabsList, TabsTrigger } from '@spaire/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const emailTabs = [
  { title: 'Subscribers', suffix: '' },
  { title: 'Broadcasts', suffix: '/broadcasts' },
  { title: 'Segments', suffix: '/segments' },
]

export default function EmailMarketingLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/email-marketing`

  // Hide tabs on detail pages
  const isDetailPage =
    /\/broadcasts\/(new|[0-9a-f-]{36})/.test(pathname)

  if (isDetailPage) {
    return children
  }

  const activeTab =
    emailTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? emailTabs[0]

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-6 md:px-8">
        <Tabs value={activeTab.title}>
          <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
            {emailTabs.map((tab) => (
              <Link
                key={tab.title}
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
