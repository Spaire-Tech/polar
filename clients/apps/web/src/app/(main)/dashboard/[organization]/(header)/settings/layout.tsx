'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-gray-100 px-4 pt-4 dark:border-spaire-800 md:px-8">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.suffix}
            href={`${base}${tab.suffix}`}
            prefetch={true}
            className={twMerge(
              '-mb-px border-b-2 px-3 pb-3 text-sm font-medium transition-colors',
              activeTab.suffix === tab.suffix
                ? 'border-blue-500 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-spaire-500 dark:hover:text-spaire-200',
            )}
          >
            {tab.title}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
