'use client'

import { SectionTabNav } from '@/components/Layout/SectionTabNav'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const revenueTabs = [
  { title: 'Transactions', suffix: '' },
  { title: 'Subscriptions', suffix: '/subscriptions' },
  { title: 'Checkouts', suffix: '/checkouts' },
]

export default function RevenueLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/sales`

  // Hide tabs on detail pages (order detail)
  const isDetailPage = /\/sales\/[0-9a-f-]{36}/.test(pathname)
  if (isDetailPage) {
    return children
  }

  const activeTab =
    revenueTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? revenueTabs[0]

  const tabs = revenueTabs.map((t) => ({
    title: t.title,
    href: `${base}${t.suffix}`,
  }))

  return (
    <div className="flex h-full flex-col">
      <SectionTabNav tabs={tabs} activeTitle={activeTab.title} />
      {children}
    </div>
  )
}
