'use client'

import { useProducts } from '@/hooks/queries'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
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
  variant,
  onAddProducts,
  onCreateNew,
}: {
  organization: schemas['Organization']
  variant: 'product' | 'course'
  // The picker passes selected product IDs back to the editor, which
  // writes them into storefront_settings.featured_product_ids and
  // forces featured_mode = 'curated'.
  onAddProducts: (productIds: string[]) => void
  // Triggered by the always-present "+ Create new" tile.
  onCreateNew: () => void
}) => {
  const { data, isLoading } = useProducts(organization.id, {
    is_archived: false,
  })

  const products = useMemo(() => {
    const all = data?.items ?? []
    return all.filter((p) => {
      const cat = (p as Product).category
      if (variant === 'course') return cat === 'course'
      return cat !== 'course'
    })
  }, [data, variant])

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

  const emptyLabel =
    variant === 'course'
      ? 'No courses yet — create your first one.'
      : 'No products yet — create your first one.'
  const newLabel = variant === 'course' ? 'New course' : 'New product'
  const newSub =
    variant === 'course'
      ? 'Multi-lesson, drip, paid or free'
      : 'Start blank · ebook, asset, anything'

  return (
    <div className="flex flex-col gap-5 px-1 pt-2">
      <p className="text-sm text-gray-500">
        Pick from your catalog or start a new one.
        {selected.size > 0 && (
          <>
            {' '}
            <b className="font-medium text-gray-900">
              · {selected.size} selected
            </b>
          </>
        )}
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Always-first create tile */}
          <button
            type="button"
            className="atsp-tile create"
            onClick={onCreateNew}
          >
            <div className="atsp-tile-art empty">+</div>
            <div className="px-3.5 pt-3 pb-3.5">
              <div className="truncate text-sm font-medium text-gray-900">
                {newLabel}
              </div>
              <div className="truncate text-[12.5px] text-gray-500">
                {newSub}
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
                <div className="px-3.5 pt-3 pb-3.5">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {product.name}
                  </div>
                  {price && (
                    <div className="truncate text-[12.5px] text-gray-500">
                      {price}
                    </div>
                  )}
                </div>
                <span className="atsp-tile-check" aria-hidden>
                  {isSelected ? (
                    <CheckOutlined style={{ fontSize: 14 }} />
                  ) : (
                    <AddOutlined style={{ fontSize: 14 }} />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      )}

      {selected.size > 0 && (
        <div className="atsp-footer">
          <Button
            type="button"
            onClick={submit}
            className="rounded-full px-6"
            size="lg"
          >
            Add {selected.size} to Space
          </Button>
        </div>
      )}
    </div>
  )
}
