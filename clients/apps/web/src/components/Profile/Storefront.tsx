'use client'

import { SpaceEmptyHero } from '@/components/Customization/SpaceEmptyHero'
import { ProductCard } from '@/components/Products/ProductCard'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo } from 'react'
import { SectionLabel } from './SectionLabel'
import {
  LinksLayout,
  StorefrontLinkItem,
  StorefrontLinks,
} from './StorefrontLinks'

import { CATEGORY_LABELS, CATEGORY_ORDER } from './categoryLabels'

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
      ? (organization.storefront_settings?.featured_mode ?? 'curated')
      : 'curated'

  const featuredIds =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.featured_product_ids ?? [])
      : []

  const categoryOrder: string[] =
    'storefront_settings' in organization
      ? ((organization.storefront_settings as { category_order?: string[] } | null)
          ?.category_order ?? [])
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

  // block_order is the new explicit ordering; we keep a backfill from
  // links_position so old rows that never persisted block_order still
  // render in the right order.
  const blockOrder: ('products' | 'links' | 'forms')[] =
    ('storefront_settings' in organization
      ? (organization.storefront_settings as { block_order?: ('products' | 'links' | 'forms')[] } | undefined)
          ?.block_order
      : null) ??
    (linksPosition === 'before_products'
      ? (['links', 'products'] as const)
      : (['products', 'links'] as const)).slice() as (
        | 'products'
        | 'links'
        | 'forms'
      )[]

  // Products scoped by featured_mode. In 'all' mode every active product
  // is shown (including ones created after curation was set up); in
  // 'curated' mode only the IDs in featuredIds are shown.
  // featured_product_ids doubles as a ranking hint (same approach the
  // editor uses) — products listed there render in declared order;
  // anything missing falls through to the back in server order.
  const scopedProducts = useMemo(() => {
    const visible =
      featuredMode === 'curated'
        ? products.filter((p) => featuredIds.includes(p.id))
        : products
    if (featuredIds.length === 0) return visible
    const rank = new Map(featuredIds.map((id, i) => [id, i]))
    const ranked = visible
      .filter((p) => rank.has(p.id))
      .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    const unranked = visible.filter((p) => !rank.has(p.id))
    return [...ranked, ...unranked]
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

    const presentKeys = Object.keys(buckets).filter(
      (key) => key !== 'other' && buckets[key].length > 0 && key in CATEGORY_LABELS,
    )
    const rank = new Map(categoryOrder.map((k, i) => [k, i]))
    const ranked = presentKeys
      .filter((k) => rank.has(k))
      .sort((a, b) => rank.get(a)! - rank.get(b)!)
    const unranked = CATEGORY_ORDER.filter(
      (key) => key !== 'other' && presentKeys.includes(key) && !rank.has(key),
    )
    const orderedKeys = [...ranked, ...unranked]
    const ordered = orderedKeys.map((key) => ({
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
  }, [scopedProducts, categoryOrder])

  const hasContent = products.length > 0 || storefrontLinks.length > 0

  if (!hasContent) {
    return <SpaceEmptyHero />
  }

  // ── Per-block renderers ──
  // Each block type renders to a fragment so the parent can iterate
  // blockOrder and place them in sequence.
  const renderProductsBlock = () => {
    if (sections.length === 0) return null
    return (
      <div key="products" className="flex flex-col gap-12">
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
      </div>
    )
  }

  const renderLinksBlock = () => {
    if (storefrontLinks.length === 0) return null
    return (
      <div key="links">
        <StorefrontLinks links={storefrontLinks} layout={linksLayout} />
      </div>
    )
  }

  const renderBlock = (kind: 'products' | 'links' | 'forms') => {
    if (kind === 'products') return renderProductsBlock()
    if (kind === 'links') return renderLinksBlock()
    return null // forms: not shipping yet
  }

  // Render in block_order, but only blocks that actually have content.
  const orderedBlocks = blockOrder
    .map((kind) => renderBlock(kind))
    .filter(Boolean)

  return (
    <div className="flex w-full flex-col gap-12">{orderedBlocks}</div>
  )
}
