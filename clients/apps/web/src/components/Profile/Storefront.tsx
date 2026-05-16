'use client'

import { SpaceEmptyHero } from '@/components/Customization/SpaceEmptyHero'
import { ProductCard } from '@/components/Products/ProductCard'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo } from 'react'
import {
  LinksLayout,
  StorefrontLinkItem,
  StorefrontLinks,
} from './StorefrontLinks'

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

  // Products scoped by featured_mode. 'curated' (default) shows only IDs
  // the creator added; legacy 'all' shows every active product.
  // featured_product_ids is the global order — products appear in the
  // exact sequence the creator dragged them in the Arrange panel. Any
  // products not yet ranked fall through to the back in server order.
  // We render as a single flat grid so creators can reorder freely
  // across categories (e.g. put an ebook above a course).
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

  const hasContent = products.length > 0 || storefrontLinks.length > 0

  if (!hasContent) {
    return <SpaceEmptyHero />
  }

  // ── Per-block renderers ──
  const renderProductsBlock = () => {
    if (scopedProducts.length === 0) return null
    return (
      <div key="products" className="flex flex-col gap-6">
        {products.length > 0 && (
          <h2 className="text-lg font-semibold text-gray-900 md:hidden">
            Products
          </h2>
        )}
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          {scopedProducts.map((product) =>
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
