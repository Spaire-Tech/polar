'use client'

import { useProducts } from '@/hooks/queries'
import { useOrganizationCourses } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type Product = schemas['Product']

const formatPrice = (product: Product): string => {
  const first = product.prices?.[0]
  if (!first) return ''
  if ('price_amount' in first && typeof first.price_amount === 'number') {
    return `$${(first.price_amount / 100).toFixed(2)}`
  }
  return ''
}

export const CatalogTab = ({
  organization,
  onAddProducts,
  onCreateNew,
}: {
  organization: schemas['Organization']
  onAddProducts: (productIds: string[]) => void
  onCreateNew: () => void
}) => {
  const { data, isLoading } = useProducts(organization.id, {
    is_archived: false,
    limit: 100,
  })
  const { data: courses } = useOrganizationCourses(organization.id)

  const products = useMemo(() => {
    const courseProductIds = new Set((courses ?? []).map((c) => c.product_id))
    const all = data?.items ?? []
    return all.filter(
      (p) => !courseProductIds.has(p.id) && p.category !== 'course',
    )
  }, [data, courses])

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = () => {
    if (selected.size === 0) return
    onAddProducts(Array.from(selected))
  }

  return (
    <div className="wg-tab">
      <p className="wg-help">
        Pick from your catalog or start a new one.
        {selected.size > 0 && (
          <>
            {' '}
            <b>· {selected.size} selected</b>
          </>
        )}
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-full bg-black/[0.04]"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Always-first 'create' pill — same row layout as the
              other items so they all line up. */}
          <button
            type="button"
            className="wg-card create"
            onClick={onCreateNew}
          >
            <div className="wg-art dashed">+</div>
            <div className="wg-meta">
              <div className="wg-card-title">New product</div>
              <div className="wg-card-sub">
                Start blank · ebook, asset, anything
              </div>
            </div>
            <span className="wg-add-btn small ghost" aria-hidden>
              ›
            </span>
          </button>

          {products.map((product) => {
            const isSelected = selected.has(product.id)
            const cover = product.medias?.[0]?.public_url
            const price = formatPrice(product)
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => toggle(product.id)}
                aria-pressed={isSelected}
                className={twMerge('wg-card', isSelected && 'selected')}
              >
                <div
                  className="wg-art"
                  style={{
                    backgroundImage: cover
                      ? `url(${cover})`
                      : 'linear-gradient(135deg, #cdd, #abb)',
                  }}
                >
                  {!cover && (product.name?.[0]?.toUpperCase() ?? '·')}
                </div>
                <div className="wg-meta">
                  <div className="wg-card-title">{product.name}</div>
                  {price && <div className="wg-card-sub">{price}</div>}
                </div>
                <span
                  className={twMerge(
                    'wg-add-btn small',
                    !isSelected && 'ghost',
                  )}
                  aria-hidden
                >
                  {isSelected ? '✓' : '+'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <p className="wg-help">No products yet — create your first one.</p>
      )}

      {selected.size > 0 && (
        <div className="wg-footer">
          <button type="button" className="wg-cta" onClick={submit}>
            Add {selected.size} to Space
          </button>
        </div>
      )}
    </div>
  )
}
