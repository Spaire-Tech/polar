'use client'

import { SectionTabNav } from '@/components/Layout/SectionTabNav'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const integrationsTabs = [
  { title: 'Agent Install', suffix: '' },
  { title: 'Frameworks', suffix: '/frameworks' },
]

export default function IntegrationsLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/integrations`

  // Hide tabs on detail pages (individual framework or agent command pages)
  const isTabPage =
    pathname === base ||
    pathname === `${base}/` ||
    pathname === `${base}/frameworks` ||
    pathname === `${base}/frameworks/`

  if (!isTabPage) {
    return children
  }

  const activeTab =
    integrationsTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? integrationsTabs[0]

  const tabs = integrationsTabs.map((t) => ({
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
