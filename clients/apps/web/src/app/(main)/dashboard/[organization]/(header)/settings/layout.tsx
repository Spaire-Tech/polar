'use client'

import { SectionTabNav } from '@/components/Layout/SectionTabNav'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const settingsTabs = [
  { title: 'Organization', suffix: '' },
  { title: 'Billing', suffix: '/billing' },
  { title: 'Members', suffix: '/members' },
  { title: 'Webhooks', suffix: '/webhooks' },
  { title: 'Custom Fields', suffix: '/custom-fields' },
]

export default function SettingsLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/settings`

  const activeTab =
    settingsTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? settingsTabs[0]

  const tabs = settingsTabs.map((t) => ({
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
