'use client'

import { SectionTabNav } from '@/components/Layout/SectionTabNav'
import { useParams, usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'

const productsTabs = [
  { title: 'Products', suffix: '' },
  { title: 'Checkout Links', suffix: '/checkout-links' },
  { title: 'Discounts', suffix: '/discounts' },
  { title: 'Benefits', suffix: '/benefits' },
  { title: 'Meters', suffix: '/meters' },
]

export default function ProductsLayout({ children }: PropsWithChildren) {
  const params = useParams<{ organization: string }>()
  const pathname = usePathname()
  const base = `/dashboard/${params.organization}/products`

  // Hide tabs on detail pages (new product, product edit, etc.)
  const isDetailPage = /\/products\/(new|[0-9a-f-]{36})/.test(pathname)
  if (isDetailPage) {
    return children
  }

  const activeTab =
    productsTabs.find((t) =>
      t.suffix === ''
        ? pathname === base || pathname === `${base}/`
        : pathname.startsWith(`${base}${t.suffix}`),
    ) ?? productsTabs[0]

  const tabs = productsTabs.map((t) => ({
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
