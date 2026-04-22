'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { StorefrontLinks, StorefrontLinkItem } from './StorefrontLinks'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo } from 'react'

const CATEGORY_LABELS: Record<string, string> = {
  ebook: 'eBooks',
  template: 'Templates',
  assets: 'Assets',
  course: 'Courses',
  guide: 'Guides',
  music: 'Music',
  video: 'Video',
  photo: 'Photo',
  software: 'Software',
  coaching: 'Coaching',
  membership: 'Memberships',
  other: 'Other',
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const showDetails =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.show_product_details ?? true)
      : true

  const enableReviews =
    'storefront_settings' in organization
      ? ((organization.storefront_settings as any)?.enable_reviews ?? false)
      : false

  const thumbnailSize =
    'storefront_settings' in organization
      ? ((organization.storefront_settings?.thumbnail_size as
          | 'small'
          | 'medium'
          | 'large') ?? 'medium')
      : 'medium'

  const featuredIds =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.featured_product_ids ?? [])
      : []

  const storefrontLinks: StorefrontLinkItem[] =
    'storefront_settings' in organization
      ? (((organization.storefront_settings as any)?.storefront_links ?? []) as StorefrontLinkItem[])
      : []

  const linksPosition: 'before_products' | 'after_products' =
    'storefront_settings' in organization
      ? (((organization.storefront_settings as any)?.links_position ?? 'after_products') as 'before_products' | 'after_products')
      : 'after_products'

  // Products scoped by featuredIds (creator curation)
  const scopedProducts = useMemo(() => {
    if (featuredIds.length > 0) {
      return products.filter((p) => featuredIds.includes(p.id))
    }
    return products
  }, [products, featuredIds])

  // Group products by category in CATEGORY_ORDER order. Products with no
  // category (or an unknown one) fall into the trailing "Other" section.
  const sections = useMemo(() => {
    const buckets: Record<string, schemas['ProductStorefront'][]> = {}
    const uncategorized: schemas['ProductStorefront'][] = []
    for (const p of scopedProducts) {
      const cat = (p as any).category as string | null | undefined
      if (cat && cat in CATEGORY_LABELS) {
        ;(buckets[cat] ??= []).push(p)
      } else {
        uncategorized.push(p)
      }
    }

    const ordered = CATEGORY_ORDER.filter(
      (key) => key !== 'other' && (buckets[key]?.length ?? 0) > 0,
    ).map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      items: buckets[key],
    }))

    const otherItems = [...(buckets['other'] ?? []), ...uncategorized]
    if (otherItems.length > 0) {
      ordered.push({
        key: 'other',
        label: CATEGORY_LABELS['other'],
        items: otherItems,
      })
    }
    return ordered
  }, [scopedProducts])

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <HiveOutlined className="text-5xl text-gray-300" fontSize="large" />
        <div className="mt-6 flex flex-col items-center gap-y-2">
          <h3 className="text-lg font-medium text-gray-900">No products yet</h3>
          <p className="text-gray-500">
            {organization.name} is not offering any products yet
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-12">
      <h2 className="text-lg font-semibold text-gray-900 md:hidden">
        Products
      </h2>

      {storefrontLinks.length > 0 && linksPosition === 'before_products' && (
        <StorefrontLinks links={storefrontLinks} />
      )}

      {sections.map((section) => (
        <section
          key={section.key}
          id={`section-${section.key}`}
          className="flex scroll-mt-24 flex-col gap-6"
        >
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/40 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700">
              {section.label}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-gray-400">
              {section.items.length}
            </span>
          </div>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            {section.items.map((product) => (
              <Link
                key={product.id}
                href={`/${organization.slug}/products/${product.id}`}
              >
                <ProductCard
                  product={product}
                  showDetails={showDetails}
                  thumbnailSize={thumbnailSize}
                />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {storefrontLinks.length > 0 && linksPosition === 'after_products' && (
        <StorefrontLinks links={storefrontLinks} />
      )}

      {/* Reviews section — shown when enabled */}
      {enableReviews && (
        <section className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/40 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700">
              Reviews
            </span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white/60 py-10 text-center">
            <span className="text-2xl">★★★★★</span>
            <p className="mt-3 text-sm font-medium text-gray-700">Reviews from your customers will appear here</p>
            <p className="mt-1 text-xs text-gray-400">Share your products to start collecting reviews</p>
          </div>
        </section>
      )}
    </div>
  )
}
