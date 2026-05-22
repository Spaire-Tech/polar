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
import { resolveSpaceItems, type ResolvedSpaceItem } from './spaceItems'

// Render the public Space.
//
// Order is driven by `space_items` (see ./spaceItems.ts) — products and
// links interleave in whatever sequence the creator chose. We preserve
// the existing 2-column product grid by walking the resolved list and
// chunking runs of consecutive products together; runs of links render
// in the creator's chosen layout. Single mixed items just sit in their
// own row.
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
  const settings =
    'storefront_settings' in organization
      ? organization.storefront_settings
      : null

  const showDetails = settings?.show_product_details ?? true
  const thumbnailSize = (settings?.thumbnail_size ?? 'medium') as
    | 'small'
    | 'medium'
    | 'large'
  const linksLayout: LinksLayout = (settings?.links_layout ?? 'classic') as LinksLayout

  const links = (settings?.storefront_links ?? []) as StorefrontLinkItem[]

  const items = useMemo(
    () => resolveSpaceItems({ settings, products, links }),
    [settings, products, links],
  )

  if (items.length === 0) {
    return <SpaceEmptyHero />
  }

  // Walk the resolved list and group runs of consecutive same-kind
  // items into chunks. Each chunk renders together so products keep
  // their 2-col grid while links keep their chosen layout — both
  // possible without losing the interleaved order.
  const chunks = chunkByKind(items)

  return (
    <div className="flex w-full flex-col gap-12">
      {chunks.map((chunk, idx) => {
        if (chunk.kind === 'product') {
          return (
            <div
              key={`p-${idx}`}
              className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
            >
              {chunk.items.map((entry) =>
                preview ? (
                  <div key={entry.id}>
                    <ProductCard
                      product={entry.product}
                      showDetails={showDetails}
                      thumbnailSize={thumbnailSize}
                    />
                  </div>
                ) : (
                  <Link
                    key={entry.id}
                    href={`/${organization.slug}/products/${entry.product.id}`}
                  >
                    <ProductCard
                      product={entry.product}
                      showDetails={showDetails}
                      thumbnailSize={thumbnailSize}
                    />
                  </Link>
                ),
              )}
            </div>
          )
        }
        return (
          <div key={`l-${idx}`}>
            <StorefrontLinks
              links={chunk.items.map((entry) => entry.link)}
              layout={linksLayout}
            />
          </div>
        )
      })}
    </div>
  )
}

type ProductChunk = {
  kind: 'product'
  items: Extract<ResolvedSpaceItem, { kind: 'product' }>[]
}
type LinkChunk = {
  kind: 'link'
  items: Extract<ResolvedSpaceItem, { kind: 'link' }>[]
}
type Chunk = ProductChunk | LinkChunk

const chunkByKind = (items: ResolvedSpaceItem[]): Chunk[] => {
  const out: Chunk[] = []
  for (const item of items) {
    const tail = out[out.length - 1]
    if (tail && tail.kind === item.kind) {
      // TS can't narrow inside the same branch without a redundant
      // type guard, so we push by kind on a fresh push below when the
      // tail kind differs. Here, tail.kind === item.kind, so the cast
      // is safe by construction.
      if (item.kind === 'product') {
        (tail as ProductChunk).items.push(item)
      } else {
        (tail as LinkChunk).items.push(item)
      }
      continue
    }
    if (item.kind === 'product') {
      out.push({ kind: 'product', items: [item] })
    } else {
      out.push({ kind: 'link', items: [item] })
    }
  }
  return out
}
