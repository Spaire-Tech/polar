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
    <div className="flex h-full w-full flex-col items-center overflow-y-auto py-12 px-4">
      <div className="dark:border-spaire-700 dark:bg-spaire-900 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Card header */}
        <div className="dark:border-spaire-700 border-b border-gray-100 px-8 pt-8 pb-0">
          <h1 className="mb-6 text-xl font-semibold dark:text-white">
            Settings
          </h1>
          <nav className="flex flex-wrap gap-x-1">
            {settingsTabs.map((tab) => {
              const isActive = activeTab.title === tab.title
              return (
                <Link
                  key={tab.suffix}
                  href={`${base}${tab.suffix}`}
                  prefetch={true}
                  className={twMerge(
                    'rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'dark:border-spaire-600 dark:bg-spaire-800 border-x border-t border-gray-200 bg-gray-50 text-gray-900 dark:text-white'
                      : 'dark:text-spaire-400 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                  )}
                >
                  {tab.title}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Card body */}
        <div className="dark:bg-spaire-800 bg-gray-50 px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
