'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo } from 'react'
import { SectionLabel } from './SectionLabel'
import {
  LinksLayout,
  StorefrontLinkItem,
  StorefrontLinks,
} from './StorefrontLinks'

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
  preview = false,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
  /**
   * Editor-preview mode: product cards don't navigate. The card still
   * looks live, but clicking it doesn't take the org out of the editor.
   */
  preview?: boolean
}) => {
  const showDetails =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.show_product_details ?? true)
      : true

  const thumbnailSize =
    ('storefront_settings' in organization
      ? organization.storefront_settings?.thumbnail_size
      : null) ?? 'medium'

  const featuredMode: 'all' | 'curated' =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.featured_mode ?? 'all')
      : 'all'

  const featuredIds =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.featured_product_ids ?? [])
      : []

  const storefrontLinks: StorefrontLinkItem[] =
    'storefront_settings' in organization
      ? ((organization.storefront_settings?.storefront_links ??
          []) as StorefrontLinkItem[])
      : []

  const linksPosition =
    ('storefront_settings' in organization
      ? organization.storefront_settings?.links_position
      : null) ?? 'after_products'

  const linksLayout: LinksLayout =
    ('storefront_settings' in organization
      ? organization.storefront_settings?.links_layout
      : null) ?? 'classic'

  // Products scoped by featured_mode. In 'all' mode every active product
  // is shown (including ones created after curation was set up); in
  // 'curated' mode only the IDs in featuredIds are shown.
  const scopedProducts = useMemo(() => {
    if (featuredMode === 'curated') {
      return products.filter((p) => featuredIds.includes(p.id))
    }
    return products
  }, [products, featuredMode, featuredIds])

  // Group products by category in CATEGORY_ORDER order. Products with no
  // category (or an unknown one) fall into the trailing "Other" section.
  const sections = useMemo(() => {
    const buckets: Record<string, schemas['ProductStorefront'][]> = {}
    const uncategorized: schemas['ProductStorefront'][] = []
    for (const p of scopedProducts) {
      const cat = p.category
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

  const hasContent = products.length > 0 || storefrontLinks.length > 0

  if (!hasContent) {
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
      {storefrontLinks.length > 0 && linksPosition === 'before_products' && (
        <StorefrontLinks links={storefrontLinks} layout={linksLayout} />
      )}

      {products.length > 0 && (
        <h2 className="text-lg font-semibold text-gray-900 md:hidden">
          Products
        </h2>
      )}

      {sections.map((section) => (
        <section
          key={section.key}
          id={`section-${section.key}`}
          className="flex scroll-mt-24 flex-col gap-6"
        >
          <SectionLabel count={section.items.length}>
            {section.label}
          </SectionLabel>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            {section.items.map((product) =>
              preview ? (
                <div key={product.id}>
                  <ProductCard
                    product={product}
                    showDetails={showDetails}
                    thumbnailSize={thumbnailSize}
                  />
                </div>
              ) : (
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
              ),
            )}
          </div>
        </section>
      ))}

      {storefrontLinks.length > 0 && linksPosition === 'after_products' && (
        <StorefrontLinks links={storefrontLinks} layout={linksLayout} />
      )}
    </div>
  )
}
