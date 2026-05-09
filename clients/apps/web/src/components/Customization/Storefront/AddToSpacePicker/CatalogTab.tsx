'use client'

import { useOrganizationCourses } from '@/hooks/queries/courses'
import { useProducts } from '@/hooks/queries'
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
  })
  const { data: courses } = useOrganizationCourses(organization.id)

  // Exclude any product that has a row in the courses table (course
  // products belong to the Course tab). Belt-and-suspenders: also
  // exclude products with category === 'course' in case a course was
  // created without a courses-row write.
  const products = useMemo(() => {
    const courseProductIds = new Set((courses ?? []).map((c) => c.product_id))
    const all = data?.items ?? []
    return all.filter(
      (p) => !courseProductIds.has(p.id) && (p as Product).category !== 'course',
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
    <div className="atsp-tab-panel">
      <p className="atsp-help">
        Pick from your catalog or start a new one.
        {selected.size > 0 && (
          <>
            {' '}
            <b>· {selected.size} selected</b>
          </>
        )}
      </p>

      {isLoading ? (
        <div className="atsp-grid three">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="atsp-skeleton" />
          ))}
        </div>
      ) : (
        <div className="atsp-grid three">
          <button type="button" className="atsp-tile create" onClick={onCreateNew}>
            <div className="atsp-tile-art empty">+</div>
            <div className="atsp-tile-meta">
              <div className="atsp-tile-title">New product</div>
              <div className="atsp-tile-sub">
                Start blank · ebook, asset, anything
              </div>
            </div>
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
                className={twMerge(
                  'atsp-tile',
                  isSelected && 'selected',
                )}
              >
                <div
                  className="atsp-tile-art"
                  style={{
                    backgroundImage: cover
                      ? `url(${cover})`
                      : 'linear-gradient(135deg, #cdd, #abb)',
                  }}
                >
                  {!cover && (product.name?.[0]?.toUpperCase() ?? '·')}
                </div>
                <div className="atsp-tile-meta">
                  <div className="atsp-tile-title">{product.name}</div>
                  {price && <div className="atsp-tile-sub">{price}</div>}
                </div>
                <span className="atsp-tile-check" aria-hidden>
                  {isSelected ? '✓' : '+'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <p
          className="atsp-help"
          style={{ color: 'var(--atsp-muted-2)' }}
        >
          No products yet — create your first one.
        </p>
      )}

      {selected.size > 0 && (
        <div className="atsp-footer">
          <button type="button" className="atsp-cta" onClick={submit}>
            Add {selected.size} to Space
          </button>
        </div>
      )}
    </div>
  )
}
