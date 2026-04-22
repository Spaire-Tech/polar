'use client'

import { Tabs, TabsList, TabsTrigger } from '@spaire/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const catalogTabs = [
  { title: 'Products', suffix: '' },
  { title: 'Payment Links', suffix: '/checkout-links' },
  { title: 'Discounts', suffix: '/discounts' },
  { title: 'Files', suffix: '/benefits' },
  { title: 'Spaire Space', suffix: '__storefront__' },
]

export default function CatalogLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/products`
  const storefrontLink = `/dashboard/${params.organization}/storefront`

  // Hide tabs on detail pages (new product, product edit, checkout-links/new, etc.)
  const isDetailPage =
    /\/products\/(new|[0-9a-f-]{36})/.test(pathname) ||
    pathname.endsWith('/checkout-links/new')

  if (isDetailPage) {
    return children
  }

  const activeTab =
    catalogTabs.find((t) => {
      if (t.suffix === '__storefront__') return false
      return t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`)
    }) ?? catalogTabs[0]

  return (
    <div className="flex h-full flex-col">
      <div className="overflow-x-auto px-4 pt-6 md:px-8">
        <Tabs value={activeTab.title}>
          <TabsList className="flex min-w-max flex-row bg-transparent ring-0 ">
            {catalogTabs.map((tab) => (
              <Link
                key={tab.title}
                href={tab.suffix === '__storefront__' ? storefrontLink : `${base}${tab.suffix}`}
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
