'use client'

import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface Tab {
  title: string
  href: string
}

interface SectionTabNavProps {
  tabs: Tab[]
  activeTitle: string
}

/**
 * Stripe-style horizontal underline tab navigation for section layouts.
 * Replaces the old pill-shaped Tabs/TabsTrigger pattern.
 */
export const SectionTabNav = ({ tabs, activeTitle }: SectionTabNavProps) => {
  return (
    <nav className="dark:border-spaire-800 flex shrink-0 border-b border-gray-200 px-6 md:px-8">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch={true}
          className={twMerge(
            'flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors',
            tab.title === activeTitle
              ? 'border-blue-500 text-gray-900 dark:text-white'
              : 'dark:text-spaire-400 dark:hover:text-spaire-100 border-transparent text-gray-500 hover:text-gray-900',
          )}
        >
          {tab.title}
        </Link>
      ))}
    </nav>
  )
}
