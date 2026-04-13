'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

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

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category')

  const showDetails =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.show_product_details ?? true)
      : true

  const thumbnailSize =
    'storefront_settings' in organization
      ? ((organization.storefront_settings?.thumbnail_size as 'small' | 'medium' | 'large') ?? 'medium')
      : 'medium'

  const featuredIds =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.featured_product_ids ?? [])
      : []

  // Products scoped by featuredIds (creator curation)
  const scopedProducts = useMemo(() => {
    if (featuredIds.length > 0) {
      return products.filter((p) => featuredIds.includes(p.id))
    }
    return products
  }, [products, featuredIds])

  // Category counts from scopedProducts, preserve CATEGORY_LABELS order
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of scopedProducts) {
      const cat = (p as any).category as string | null | undefined
      if (cat) counts[cat] = (counts[cat] ?? 0) + 1
    }
    return Object.keys(CATEGORY_LABELS)
      .filter((key) => counts[key] > 0)
      .map((key) => ({ key, label: CATEGORY_LABELS[key], count: counts[key] }))
  }, [scopedProducts])

  // Filtered products based on active category
  const displayProducts = useMemo(() => {
    if (!activeCategory) return scopedProducts
    return scopedProducts.filter(
      (p) => (p as any).category === activeCategory,
    )
  }, [scopedProducts, activeCategory])

  const setCategory = useCallback(
    (cat: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (cat) params.set('category', cat)
      else params.delete('category')
      const qs = params.toString()
      router.replace(`/${organization.slug}${qs ? `?${qs}` : ''}`, {
        scroll: false,
      })
    },
    [router, searchParams, organization.slug],
  )

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <HiveOutlined
          className="text-5xl text-gray-300"
          fontSize="large"
        />
        <div className="mt-6 flex flex-col items-center gap-y-2">
          <h3 className="text-lg font-medium text-gray-900">No products yet</h3>
          <p className="text-gray-500">
            {organization.name} is not offering any products yet
          </p>
        </div>
      </div>
    )
  }

  const pillBase =
    'whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors'
  const pillActive = 'bg-gray-900 text-white'
  const pillInactive = 'bg-gray-100 text-gray-700 hover:bg-gray-200'

  return (
    <div className="flex w-full flex-col gap-5">
      <h2 className="text-lg font-semibold text-gray-900 md:hidden">Products</h2>

      {categoryCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={twMerge(
              pillBase,
              !activeCategory ? pillActive : pillInactive,
            )}
          >
            All ({scopedProducts.length})
          </button>
          {categoryCounts.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={twMerge(
                pillBase,
                activeCategory === c.key ? pillActive : pillInactive,
              )}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      )}

      {displayProducts.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No products in this category yet.
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          {displayProducts.map((product) => (
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
      )}
    </div>
  )
}
