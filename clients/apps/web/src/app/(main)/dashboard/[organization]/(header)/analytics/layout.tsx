'use client'

import { SectionTabNav } from '@/components/Layout/SectionTabNav'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const analyticsTabs = [
  { title: 'Metrics', suffix: '/metrics' },
  { title: 'Events', suffix: '/events' },
  { title: 'Costs', suffix: '/costs' },
]

export default function AnalyticsLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/analytics`

  const activeTab =
    analyticsTabs.find((t) => pathname.startsWith(`${base}${t.suffix}`)) ??
    analyticsTabs[0]

  const tabs = analyticsTabs.map((t) => ({
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
