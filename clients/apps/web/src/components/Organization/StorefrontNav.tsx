'use client'

import { organizationPageLink } from '@/utils/nav'
import { schemas } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

interface OrganizationStorefrontNavProps {
  className?: string
  organization: schemas['Organization']
}

export const StorefrontNav = ({
  organization,
  className,
}: OrganizationStorefrontNavProps) => {
  const routeSegment = useSelectedLayoutSegment()
  const currentTab = routeSegment ?? 'products'

  const tabs = [
    { id: 'products', label: 'Products', href: organizationPageLink(organization) },
    { id: 'about', label: 'About', href: organizationPageLink(organization, 'about') },
  ]

  return (
    <div className={twMerge('flex w-full flex-row items-center justify-between', className)}>
      {/* Tabs */}
      <div className="flex flex-row items-center gap-x-6">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={twMerge(
              'dark:text-polar-400 border-b-2 border-transparent pb-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white',
              currentTab === tab.id &&
                'border-gray-900 text-gray-900 dark:border-white dark:text-white',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Sort dropdown */}
      <Select defaultValue="last_added">
        <SelectTrigger className="dark:border-polar-700 dark:bg-polar-900 h-9 w-32 rounded-lg border-gray-200 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last_added">Last added</SelectItem>
          <SelectItem value="price_asc">Price: Low</SelectItem>
          <SelectItem value="price_desc">Price: High</SelectItem>
          <SelectItem value="name_asc">Name: A-Z</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
