'use client'

import { SectionTabNav } from '@/components/Layout/SectionTabNav'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const financeTabs = [
  { title: 'Overview', suffix: '/income' },
  { title: 'Payouts', suffix: '/payouts' },
  { title: 'Account', suffix: '/account' },
]

export default function FinanceLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/finance`

  const activeTab =
    financeTabs.find((t) => pathname.startsWith(`${base}${t.suffix}`)) ??
    financeTabs[0]

  const tabs = financeTabs.map((t) => ({
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
